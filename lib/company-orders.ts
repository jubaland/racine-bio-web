import { supabaseAdmin } from './supabase-admin';
import { FREQ_LABEL, addDays, dowOf, isDue, nextDeliveryDate } from './subscription-schedule';
import { adjustCompanyWallet, companyBalance, notifyCompany, fdj } from './company';
import { applyStockDeltas, reserveStock } from './bundles';

// ── Commandes récurrentes des sociétés (cron deliveries) ─────────────────────
// Même calendrier que les commandes modèles des particuliers ; débit de la cagnotte SOCIÉTÉ,
// livraison sur un site de la société. Rappel la veille, pause « solde insuffisant » levée
// automatiquement à la recharge.

const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const CRON_HOUR_UTC = 6;

/** Lignes livrables d'une commande récurrente (publié, hors paniers, plafonné au stock). */
export async function computeCompanyTemplate(companyId: number, frequency: string) {
  const { data: items } = await supabaseAdmin.from('company_subscription_items').select('product_id, quantity').eq('company_id', companyId).eq('frequency', frequency);
  if (!items?.length) return { lines: [] as { p: any; qty: number }[], itemsTotal: 0, omitted: [] as string[] };
  const { data: prods } = await supabaseAdmin.from('products').select('id, name, price, unit, image_url, farm, stock_qty, status, is_bundle, cost_price, owner_id').in('id', items.map((i: any) => i.product_id));
  const pmap: Record<number, any> = Object.fromEntries((prods || []).map((p: any) => [p.id, p]));
  // Produits marchands : livrés seulement si le marchand est actif (abonnement en cours ou formule commission)
  const { merchantTerms } = await import('./merchant-formula');
  const terms = await merchantTerms((prods || []).map((p: any) => p.owner_id).filter(Boolean));
  const lines: { p: any; qty: number }[] = []; const omitted: string[] = [];
  for (const it of items) {
    const p = pmap[it.product_id];
    if (!p || p.status !== 'published' || p.is_bundle || (p.owner_id && !terms[p.owner_id]?.active)) { omitted.push(p?.name || `Produit #${it.product_id}`); continue; }
    const q = Math.min(Number(it.quantity), Number(p.stock_qty) || 0);
    if (q <= 0) { omitted.push(p.name); continue; }
    lines.push({ p, qty: q });
  }
  return { lines, itemsTotal: lines.reduce((s, l) => s + Number(l.p.price) * l.qty, 0), omitted };
}

async function activeSubs(filter: (q: any) => any) {
  const { data } = await filter(supabaseAdmin.from('company_subscriptions').select('*, companies(id, name, status), company_sites(id, recipient_name, phone, address)').eq('active', true));
  return ((data || []) as any[]).filter(s => s.companies?.status === 'active');
}

/** Livraisons récurrentes dues aujourd'hui. */
export async function processCompanyDeliveries(todayStr: string, opts: { onlyCompany?: number } = {}) {
  const subs = await activeSubs(q => { let x = q.eq('paused', false).eq('delivery_day', dowOf(todayStr)); if (opts.onlyCompany) x = x.eq('company_id', opts.onlyCompany); return x; });
  const results: any[] = [];
  for (const s of subs) {
    if (!isDue(s.frequency, s.last_delivery, todayStr)) continue;
    const label = FREQ_LABEL[s.frequency] || s.frequency;
    const site = s.company_sites;
    if (!site) { results.push({ company: s.company_id, frequency: s.frequency, skipped: 'no_site' }); continue; }
    const { lines, itemsTotal } = await computeCompanyTemplate(s.company_id, s.frequency);
    if (!lines.length) { results.push({ company: s.company_id, frequency: s.frequency, skipped: 'out_of_stock' }); continue; }
    const total = itemsTotal + (Number(s.delivery_fee) || 0);
    const balance = await companyBalance(s.company_id);
    if (balance < total) {
      await supabaseAdmin.from('company_subscriptions').update({ paused: true, paused_reason: 'low_balance', updated_at: new Date().toISOString() }).eq('company_id', s.company_id).eq('frequency', s.frequency);
      await notifyCompany(s.company_id, ['manager'], { title: '⏸️ Commande récurrente en pause', body: `Livraison ${label} non passée : il faut ${fdj(total)}, solde ${fdj(balance)}. Elle reprendra à la prochaine recharge.` });
      results.push({ company: s.company_id, frequency: s.frequency, paused: 'low_balance', needed: total, balance });
      continue;
    }
    const reservation = await reserveStock(supabaseAdmin, lines.map(l => ({ product_id: l.p.id, quantity: l.qty })));
    if (!reservation.ok) { results.push({ company: s.company_id, frequency: s.frequency, skipped: 'stock_race' }); continue; }
    const release = () => applyStockDeltas(supabaseAdmin, lines.map(l => ({ product_id: l.p.id, delta: l.qty }))).catch(() => {});
    const { data: order, error } = await supabaseAdmin.from('orders').insert({
      user_id: s.updated_by, company_id: s.company_id, company_site_id: site.id, total, delivery_fee: Number(s.delivery_fee) || 0,
      delivery_option_name: `Récurrente (${label})`, special_instructions: `Commande automatique — ${s.companies.name}`,
      status: 'processing', payment_method: 'company_wallet', phone: site.phone, address: site.address,
      customer_name: `${s.companies.name} — ${site.recipient_name}`, email: null,
    }).select().single();
    if (error || !order) { await release(); results.push({ company: s.company_id, frequency: s.frequency, error: error?.message }); continue; }
    const { commissionRatesForProducts } = await import('./merchant-formula');
    const rates = await commissionRatesForProducts(lines.map(l => l.p));
    await supabaseAdmin.from('order_items').insert(lines.map(l => ({
      order_id: order.id, product_id: l.p.id, quantity: l.qty, price: l.p.price, product_cost: l.p.cost_price ?? null, commission_rate: rates[l.p.id] ?? null,
      product_name: l.p.name, product_image_url: l.p.image_url, product_unit: l.p.unit, product_farm: l.p.farm,
    })));
    const debit = await adjustCompanyWallet(s.company_id, -total, 'debit', { orderId: order.id, userId: s.updated_by, note: `Livraison ${label} (récurrente)` });
    if (!debit.ok) {
      await release();
      await supabaseAdmin.from('order_items').delete().eq('order_id', order.id);
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      results.push({ company: s.company_id, frequency: s.frequency, error: 'wallet_race' }); continue;
    }
    await supabaseAdmin.from('company_subscriptions').update({ last_delivery: todayStr, updated_at: new Date().toISOString() }).eq('company_id', s.company_id).eq('frequency', s.frequency);
    try {
      const { sendPrepSlipToPreparers } = await import('./emails');
      const { data: preps } = await supabaseAdmin.from('preparers').select('email').eq('is_active', true);
      const emails = (preps || []).map((p: any) => p.email).filter(Boolean);
      if (emails.length) await sendPrepSlipToPreparers(order, lines.map(l => ({ product_id: l.p.id, quantity: l.qty, price: l.p.price, product_name: l.p.name, product_unit: l.p.unit, product_farm: l.p.farm })), emails);
      const { sendPushToAdmin } = await import('./push');
      await sendPushToAdmin({ title: '🏢 Commande récurrente entreprise', body: `#${order.id} — ${s.companies.name} — ${fdj(total)}`, url: '/admin' });
    } catch (e) { console.error('[company-orders] notify:', e); }
    await notifyCompany(s.company_id, ['manager'], { title: `📦 Livraison ${label}`, body: `Commande #${order.id} en préparation pour ${site.recipient_name} — ${fdj(total)}. Solde : ${fdj(debit.balance || 0)}.` });
    results.push({ company: s.company_id, frequency: s.frequency, ordered: order.id, total });
  }
  return results;
}

/** Rappel de la veille aux gérants : solde OK ou manque à recharger. Idempotent (reminder_sent_for). */
export async function remindCompaniesTomorrow(todayStr: string, opts: { onlyCompany?: number; dry?: boolean } = {}) {
  const tomorrow = addDays(todayStr, 1);
  const subs = (await activeSubs(q => { let x = q.eq('paused', false).eq('delivery_day', dowOf(tomorrow)); if (opts.onlyCompany) x = x.eq('company_id', opts.onlyCompany); return x; }))
    .filter(s => s.reminder_sent_for !== tomorrow && isDue(s.frequency, s.last_delivery, tomorrow));
  const report: any[] = [];
  for (const s of subs) {
    const { lines, itemsTotal, omitted } = await computeCompanyTemplate(s.company_id, s.frequency);
    const total = itemsTotal + (Number(s.delivery_fee) || 0);
    const balance = await companyBalance(s.company_id);
    const missing = Math.max(0, total - balance);
    const label = FREQ_LABEL[s.frequency] || s.frequency;
    const stockNote = omitted.length ? ` Indisponible(s), omis : ${omitted.join(', ')}.` : '';
    const kind = !lines.length ? 'empty' : missing > 0 ? 'missing' : 'ok';
    report.push({ company: s.company_id, frequency: s.frequency, kind, total, balance, missing });
    if (opts.dry) continue;
    await notifyCompany(s.company_id, ['manager'], kind === 'empty'
      ? { title: '⚠️ Livraison demain : aucun article disponible', body: `La commande récurrente ${label} de ${s.companies.name} part demain, mais aucun article n'est disponible.${stockNote}` }
      : kind === 'missing'
      ? { title: `⏳ Livraison demain : il manque ${fdj(missing)}`, body: `Commande récurrente ${label} de ${s.companies.name} : ${fdj(total)}, solde ${fdj(balance)}. Rechargez aujourd'hui pour ne pas la manquer.${stockNote}` }
      : { title: `📦 Livraison demain — ${fdj(total)}`, body: `Commande récurrente ${label} de ${s.companies.name} : ${fdj(total)} seront débités de la cagnotte société (solde ${fdj(balance)}).${stockNote}` });
    await supabaseAdmin.from('company_subscriptions').update({ reminder_sent_for: tomorrow }).eq('company_id', s.company_id).eq('frequency', s.frequency);
  }
  return { tomorrow, reminders: report };
}

/** Après une recharge : relance les commandes récurrentes en pause pour solde insuffisant. */
export async function resumeCompanyAfterTopUp(companyId: number) {
  const { data } = await supabaseAdmin.from('company_subscriptions').select('*').eq('company_id', companyId).eq('active', true).eq('paused', true).eq('paused_reason', 'low_balance');
  if (!data?.length) return [];
  const now = new Date(); const todayStr = now.toISOString().slice(0, 10);
  const from = now.getUTCHours() >= CRON_HOUR_UTC ? addDays(todayStr, 1) : todayStr;
  let balance = await companyBalance(companyId);
  const resumed: any[] = [];
  for (const s of data as any[]) {
    const { itemsTotal } = await computeCompanyTemplate(companyId, s.frequency);
    const total = itemsTotal + (Number(s.delivery_fee) || 0);
    if (total <= 0 || total > balance) continue;
    balance -= total;
    await supabaseAdmin.from('company_subscriptions').update({ paused: false, paused_reason: null, updated_at: now.toISOString() }).eq('company_id', companyId).eq('frequency', s.frequency);
    const next = nextDeliveryDate(s, from);
    resumed.push({ frequency: s.frequency, next, total });
    await notifyCompany(companyId, ['manager'], { title: '▶️ Commande récurrente reprise', body: `Cagnotte rechargée : la commande ${FREQ_LABEL[s.frequency] || s.frequency} reprend${next ? `, prochaine livraison le ${fmtDate(next)}` : ''} (${fdj(total)}).` });
  }
  return resumed;
}
