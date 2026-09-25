import { supabaseAdmin } from './supabase-admin';
import { notifyUser } from './notify';
import { FREQ_LABEL, addDays, dowOf, isDue, nextDeliveryDate } from './subscription-schedule';

// ── Réassort intelligent des commandes modèles ───────────────────────────────
// 1. computeTemplateOrder : lignes livrables (publié, plafonné au stock) + total — même règle que le cron.
// 2. remindTomorrow        : la veille d'une livraison, prévenir le client (solde OK / il manque X Fdj).
// 3. resumeAfterTopUp      : après une recharge, relancer les commandes modèles en pause pour solde insuffisant.

export type TemplateLine = { p: any; qty: number };
export type TemplateOrder = { lines: TemplateLine[]; itemsTotal: number; omitted: string[]; reduced: string[] };

const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const CRON_HOUR_UTC = 6; // heure du cron deliveries (vercel.json)

/** Ce que livrerait la commande modèle aujourd'hui : produits publiés, quantités plafonnées au stock. */
export async function computeTemplateOrder(userId: string, frequency: string): Promise<TemplateOrder> {
  const { data: items } = await supabaseAdmin.from('subscription_items').select('product_id, quantity').eq('user_id', userId).eq('frequency', frequency);
  if (!items || !items.length) return { lines: [], itemsTotal: 0, omitted: [], reduced: [] };
  const ids = items.map((i: any) => i.product_id);
  const { data: prods } = await supabaseAdmin.from('products').select('id, name, price, unit, image_url, farm, stock_qty, status, is_bundle, cost_price').in('id', ids);
  const pmap: Record<number, any> = Object.fromEntries((prods || []).map((p: any) => [p.id, p]));
  const lines: TemplateLine[] = []; const omitted: string[] = []; const reduced: string[] = [];
  for (const it of items) {
    const p = pmap[it.product_id];
    // Paniers composés : composition variable, jamais en commande modèle
    if (!p || p.status !== 'published' || p.is_bundle) { omitted.push(p?.name || `Produit #${it.product_id}`); continue; }
    const wanted = Number(it.quantity), q = Math.min(wanted, Number(p.stock_qty) || 0);
    if (q <= 0) { omitted.push(p.name); continue; }
    if (q < wanted) reduced.push(`${p.name} (${q} ${p.unit || ''} sur ${wanted})`.replace(/\s+/g, ' '));
    lines.push({ p, qty: q });
  }
  return { lines, itemsTotal: lines.reduce((s, l) => s + Number(l.p.price) * l.qty, 0), omitted, reduced };
}

async function balanceOf(userId: string): Promise<number> {
  const { data: w } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', userId).maybeSingle();
  return Number(w?.balance) || 0;
}
async function emailOf(userId: string): Promise<string | null> {
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
  return u?.user?.email || null;
}

type Sub = { user_id: string; frequency: string; delivery_day: number; last_delivery: string | null; valid_until: string | null; delivery_fee: number | null; reminder_sent_for: string | null };

/**
 * Rappel de la veille : pour chaque client dont une (ou plusieurs) commande(s) modèle(s) part demain,
 * un seul message : montant total (frais comptés une fois), solde, manque éventuel, articles omis.
 * Idempotent via subscriptions.reminder_sent_for = date de livraison. `onlyUser` : restreindre (tests).
 */
export async function remindTomorrow(todayStr: string, opts: { onlyUser?: string; dry?: boolean } = {}) {
  const tomorrow = addDays(todayStr, 1);
  let q = supabaseAdmin.from('subscriptions')
    .select('user_id, frequency, delivery_day, last_delivery, valid_until, delivery_fee, reminder_sent_for')
    .eq('active', true).eq('paused', false).eq('delivery_day', dowOf(tomorrow));
  if (opts.onlyUser) q = q.eq('user_id', opts.onlyUser);
  const { data } = await q;
  const due = ((data || []) as Sub[]).filter(s =>
    s.reminder_sent_for !== tomorrow && !(s.valid_until && tomorrow > s.valid_until) && isDue(s.frequency, s.last_delivery, tomorrow));

  const byUser: Record<string, Sub[]> = {};
  for (const s of due) (byUser[s.user_id] ||= []).push(s);
  const report: any[] = [];

  for (const [userId, subs] of Object.entries(byUser)) {
    const parts: { label: string; total: number; omitted: string[]; reduced: string[]; lines: number }[] = [];
    let itemsTotal = 0, fee = 0;
    for (const s of subs) {
      const o = await computeTemplateOrder(userId, s.frequency);
      parts.push({ label: FREQ_LABEL[s.frequency] || s.frequency, total: o.itemsTotal, omitted: o.omitted, reduced: o.reduced, lines: o.lines.length });
      itemsTotal += o.itemsTotal; fee = Math.max(fee, Number(s.delivery_fee) || 0); // un seul trajet par jour
    }
    const total = itemsTotal + fee;
    const balance = await balanceOf(userId);
    const missing = Math.max(0, total - balance);
    const labels = parts.map(p => p.label).join(' + ');
    const omitted = parts.flatMap(p => p.omitted), reduced = parts.flatMap(p => p.reduced);
    const stockNote = [
      omitted.length ? `Indisponible(s) demain, omis : ${omitted.join(', ')}.` : '',
      reduced.length ? `Quantité réduite (stock) : ${reduced.join(', ')}.` : '',
    ].filter(Boolean).join(' ');

    let kind: 'ok' | 'missing' | 'empty';
    let title: string, body: string;
    if (parts.every(p => p.lines === 0)) {
      kind = 'empty';
      title = '⚠️ Livraison demain : aucun article disponible';
      body = `Votre commande modèle ${labels} part demain, mais aucun de ses articles n'est disponible pour le moment. ${stockNote} Ajustez votre panier dans « Ma commande modèle ».`.replace(/\s+/g, ' ');
    } else if (missing > 0) {
      kind = 'missing';
      title = `⏳ Livraison demain : il manque ${fdj(missing)}`;
      body = `Votre commande modèle ${labels} part demain (${fdj(total)}). Solde de la cagnotte : ${fdj(balance)}. Rechargez ${fdj(missing)} aujourd'hui pour ne pas manquer la livraison. ${stockNote}`.replace(/\s+/g, ' ').trim();
    } else {
      kind = 'ok';
      title = `📦 Livraison demain — ${fdj(total)}`;
      body = `Votre commande modèle ${labels} part demain : ${fdj(total)} seront débités de votre cagnotte (solde ${fdj(balance)}). Modifiez votre panier avant ce soir si besoin. ${stockNote}`.replace(/\s+/g, ' ').trim();
    }
    report.push({ user: userId, kind, total, balance, missing, omitted, reduced, freqs: subs.map(s => s.frequency) });
    if (opts.dry) continue;

    try { await notifyUser(userId, { title, body, url: '/abonnement' }); } catch (e) { console.error('[restock] notify:', e); }
    if (kind !== 'ok') {
      try {
        const email = await emailOf(userId);
        if (email) { const { sendSubscriptionReminder } = await import('./emails'); await sendSubscriptionReminder(email, { label: labels, dateStr: fmtDate(tomorrow), total, balance, missing, stockNote, empty: kind === 'empty' }); }
      } catch (e) { console.error('[restock] email:', e); }
    }
    for (const s of subs) await supabaseAdmin.from('subscriptions').update({ reminder_sent_for: tomorrow }).eq('user_id', userId).eq('frequency', s.frequency);
  }
  return { tomorrow, reminders: report };
}

/**
 * Après une recharge de cagnotte : relance les commandes modèles de ce client mises en pause pour
 * solde insuffisant (paused_reason = 'low_balance') si le nouveau solde couvre leur montant.
 * Une pause décidée par le client ou une expiration n'est jamais levée ici.
 */
export async function resumeAfterTopUp(userId: string) {
  const { data } = await supabaseAdmin.from('subscriptions')
    .select('user_id, frequency, delivery_day, last_delivery, valid_until, delivery_fee, active')
    .eq('user_id', userId).eq('paused', true).eq('paused_reason', 'low_balance').eq('active', true);
  const subs = (data || []) as (Sub & { active: boolean })[];
  if (!subs.length) return [];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  // Si le cron du jour est déjà passé, la prochaine livraison possible est demain au plus tôt
  const from = now.getUTCHours() >= CRON_HOUR_UTC ? addDays(todayStr, 1) : todayStr;
  let balance = await balanceOf(userId);
  const resumed: { frequency: string; next: string | null; total: number }[] = [];
  for (const s of subs) {
    if (s.valid_until && todayStr > s.valid_until) continue;
    const o = await computeTemplateOrder(userId, s.frequency);
    const total = o.itemsTotal + (Number(s.delivery_fee) || 0);
    if (total <= 0 || total > balance) continue;
    balance -= total; // cagnotte partagée entre fréquences : on n'en relance que ce qu'elle couvre
    const { error } = await supabaseAdmin.from('subscriptions')
      .update({ paused: false, paused_reason: null, updated_at: now.toISOString() })
      .eq('user_id', userId).eq('frequency', s.frequency).eq('paused_reason', 'low_balance');
    if (error) continue;
    const next = nextDeliveryDate(s, from);
    resumed.push({ frequency: s.frequency, next, total });
    const label = FREQ_LABEL[s.frequency] || s.frequency;
    try {
      await notifyUser(userId, {
        title: '▶️ Commande modèle reprise',
        body: `Cagnotte rechargée : votre commande modèle ${label} reprend${next ? `, prochaine livraison le ${fmtDate(next)}` : ''} (${fdj(total)}).`,
        url: '/abonnement',
      });
      const email = await emailOf(userId);
      if (email) { const { sendSubscriptionResumed } = await import('./emails'); await sendSubscriptionResumed(email, label, next ? fmtDate(next) : null, total); }
    } catch (e) { console.error('[restock] resume notify:', e); }
  }
  return resumed;
}
