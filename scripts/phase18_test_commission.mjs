// Test non destructif de la formule commission (phase 18). Serveur local requis (npm run dev, port 3000).
// Marchand, client et produit temporaires. Les réglages merchant.commission_* sont modifiés le temps
// du test puis RÉTABLIS. Préparateurs désactivés pendant le test (aucun bordereau envoyé).
// Vérifie : réglages et droits, choix de formule, visibilité, taux photographié sur la commande,
// taux particulier, brut / commission / net du relevé et du reversement, priorité de l'abonnement payé,
// bascule programmée à l'échéance (cron), suspension, formule non proposée.
//   node scripts/phase18_test_commission.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { cheapestDelivery } from './test_helpers.mjs';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// Frais de livraison calculés par le serveur : chaque commande de test désigne une option réelle
const DEL = await cheapestDelivery(admin);
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const BASE = process.argv[2] || 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label} ${extra}`); } };
const stamp = Date.now();
const state = { merchant: null, client: null, product: null, orders: [], preparers: [], before: [] };
const today = new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

const tokenFor = async (email) => {
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const { data: v } = await anon().auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  return v.session.access_token;
};
const api = async (path, token, body, method = body ? 'POST' : 'GET') => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch { /* ignore */ }
  if (j?.order?.id) state.orders.push(j.order.id);
  return { status: r.status, j };
};
const mkUser = async (tag, meta) => {
  const email = `test-commission-${tag}-${stamp}@example.com`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: `Tmp-${stamp}!${tag}`, email_confirm: true, user_metadata: meta });
  if (error) throw error;
  return { id: u.user.id, email, token: await tokenFor(email) };
};
const formulaRow = async () => (await admin.from('merchant_formulas').select('*').eq('user_id', state.merchant.id).maybeSingle()).data;
const isActiveSql = async () => (await admin.rpc('merchant_is_active', { p_user: state.merchant.id })).data;
const rateOfOrder = async (orderId) => { const { data } = await admin.from('order_items').select('commission_rate').eq('order_id', orderId).single(); return data.commission_rate == null ? null : Number(data.commission_rate); };

try {
  const { data: preps } = await admin.from('preparers').select('id').eq('is_active', true);
  state.preparers = (preps || []).map(p => p.id);
  if (state.preparers.length) await admin.from('preparers').update({ is_active: false }).in('id', state.preparers);
  state.before = (await admin.from('app_settings').select('key, value_num').like('key', 'merchant.%')).data || [];

  state.merchant = await mkUser('m', { full_name: 'Test Commission Marchand', role: 'producer' });
  state.client = await mkUser('c', { full_name: 'Test Commission Client' });
  const adminToken = await tokenFor('wilsandj@hotmail.com');
  await admin.from('merchant_profiles').insert({ user_id: state.merchant.id, shop_name: 'Boutique Test Commission' });
  const { data: P, error: pe } = await admin.from('products').insert({ name: 'TEST Commission produit', price: 1000, unit: 'kg', stock_qty: 500, farm: 'Boutique Test Commission', category: 'legumes', product_type: 'conventionnel', origin_country: 'DJ', region: 'Test', status: 'published', is_local: false, in_stock: true, description: 'TEST COMMISSION — à supprimer', bg_color: '#ecf4d5', owner_id: state.merchant.id }).select('id').single();
  if (pe) throw pe;
  state.product = P.id;
  const { data: plan } = await admin.from('merchant_plans').select('id, price_fdj, duration_days').eq('is_active', true).order('price_fdj').limit(1).single();

  const M = state.merchant, C = state.client;
  const adm = (body) => api('/api/admin/merchants', adminToken, body);
  const order = async (qty) => api('/api/orders', C.token, {
    order: { user_id: C.id, payment_method: 'cash', ...DEL.fields, customer_name: 'Test Commission Client', phone: '77000000', address: 'Test' },
    items: [{ product_id: P.id, quantity: qty, price: 1000, product_name: 'TEST Commission produit', product_unit: 'kg' }],
  });
  const deliver = (id) => api('/api/orders', adminToken, { id, status: 'delivered' }, 'PATCH');
  const mine = async () => (await api('/api/producer/subscription', M.token)).j;

  console.log('\n1) Réglages et droits');
  let r = await api('/api/admin/merchants', C.token, { action: 'save_commission', rate: 1 });
  ok(r.status === 401 || r.status === 403, 'un client ne peut pas modifier le taux', String(r.status));
  r = await api('/api/admin/merchants', M.token, { action: 'save_commission', rate: 1 });
  ok(r.status === 401 || r.status === 403, 'un marchand ne peut pas modifier le taux', String(r.status));
  r = await adm({ action: 'save_commission', rate: 150 });
  ok(r.status === 400, 'taux supérieur à 100 refusé', String(r.status));
  r = await adm({ action: 'save_commission', rate: '' });
  ok(r.status === 400, 'taux vide refusé', String(r.status));
  r = await adm({ action: 'save_commission', rate: 12, enabled: true });
  ok(r.status === 200 && r.j.commission?.rate === 12 && r.j.commission?.enabled === true, 'réglage enregistré : 12 %, formule proposée', JSON.stringify(r.j));
  r = await api('/api/merchant-offer', null);
  ok(r.status === 200 && r.j.commission?.available === true && r.j.commission?.rate === 12, 'offre publique : commission 12 %', JSON.stringify(r.j.commission));
  ok(Array.isArray(r.j.plans), 'offre publique : plans d\'abonnement listés');
  const mClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${M.token}` } } });
  const { error: insErr } = await mClient.from('merchant_formulas').insert({ user_id: M.id, kind: 'commission', commission_rate: 0 });
  ok(!!insErr && !(await formulaRow()), 'un marchand ne peut pas écrire sa formule ni son taux en base', insErr?.message || 'insertion acceptée');

  console.log('\n2) Marchand sans formule');
  let me = await mine();
  ok(me.state === 'none' && me.commission?.available === true && me.commission?.rate === 12, 'état « aucune formule », commission proposée à 12 %', JSON.stringify({ s: me.state, c: me.commission }));
  ok(await isActiveSql() === false, 'produits non visibles (merchant_is_active = false)');
  r = await order(1);
  ok(r.status !== 200 && !r.j.order, 'commande refusée : marchand inactif', String(r.status));

  console.log('\n3) Choix de la commission');
  r = await api('/api/producer/subscription', M.token, { action: 'choose_formula', kind: 'autre' });
  ok(r.status === 400, 'formule inconnue refusée', String(r.status));
  r = await api('/api/producer/subscription', M.token, { action: 'choose_formula', kind: 'commission' });
  ok(r.status === 200 && r.j.state === 'active' && r.j.formula?.kind === 'commission', 'commission choisie : marchand actif immédiatement', JSON.stringify({ s: r.j.state, f: r.j.formula }));
  ok(await isActiveSql() === true, 'produits visibles (merchant_is_active = true)');
  r = await api('/api/producer/subscription', M.token, { action: 'choose_formula', kind: 'commission' });
  ok(r.status === 409, 'second choix identique refusé', String(r.status));
  const o1 = (await order(2)).j.order;                       // 2 000 Fdj brut à 12 %
  ok(!!o1 && await rateOfOrder(o1.id) === 12, 'commande acceptée, taux 12 % enregistré sur la ligne', o1 ? String(await rateOfOrder(o1.id)) : 'pas de commande');

  console.log('\n4) Changement de taux : les commandes passées ne bougent pas');
  await adm({ action: 'save_commission', rate: 20 });
  const o2 = (await order(1)).j.order;                       // 1 000 Fdj brut à 20 %
  ok(!!o2 && await rateOfOrder(o2.id) === 20, 'nouvelle commande au nouveau taux général (20 %)');
  ok(await rateOfOrder(o1.id) === 12, 'ancienne commande toujours à 12 %');
  r = await adm({ action: 'set_commission_rate', user_id: M.id, rate: 101 });
  ok(r.status === 400, 'taux particulier invalide refusé', String(r.status));
  r = await adm({ action: 'set_commission_rate', user_id: M.id, rate: 5 });
  ok(r.status === 200 && Number((await formulaRow()).commission_rate) === 5, 'taux particulier 5 % enregistré');
  const o3 = (await order(3)).j.order;                       // 3 000 Fdj brut à 5 %
  ok(!!o3 && await rateOfOrder(o3.id) === 5, 'nouvelle commande au taux particulier (5 %)');
  me = await mine();
  ok(me.commission?.rate === 5, 'le marchand voit son taux particulier', JSON.stringify(me.commission));
  r = await adm({ action: 'set_commission_rate', user_id: M.id, rate: '' });
  ok(r.status === 200 && (await formulaRow()).commission_rate == null, 'taux particulier retiré : retour au taux général');

  console.log('\n5) Relevé et reversement : brut, commission, net');
  await deliver(o1.id); await deliver(o2.id); await deliver(o3.id);
  // 2 000 × 12 % = 240 ; 1 000 × 20 % = 200 ; 3 000 × 5 % = 150 → commission 590, brut 6 000, net 5 410
  r = await api('/api/producer/statement', M.token);
  ok(r.status === 200 && r.j.gross === 6000 && r.j.commission === 590 && r.j.due === 5410, 'relevé marchand : brut 6 000, commission 590, net 5 410', JSON.stringify({ g: r.j.gross, c: r.j.commission, d: r.j.due }));
  r = await api(`/api/admin/merchants/payouts?user_id=${M.id}`, adminToken);
  ok(r.status === 200 && r.j.due === 5410 && r.j.commission === 590 && r.j.lines.every(l => l.net === l.total - l.commission), 'admin : même calcul, net par ligne cohérent', JSON.stringify({ d: r.j.due, c: r.j.commission }));
  r = await api('/api/admin/merchants/payouts', adminToken, { user_id: M.id, method: 'cash', note: 'test commission' });
  ok(r.status === 200 && Number(r.j.payout?.amount) === 5410 && Number(r.j.payout?.gross_amount) === 6000 && Number(r.j.payout?.commission_amount) === 590, 'reversement : 5 410 versés, 6 000 de ventes, 590 de commission', JSON.stringify(r.j.payout && { a: r.j.payout.amount, g: r.j.payout.gross_amount, c: r.j.payout.commission_amount }));
  r = await api('/api/admin/finances?period=30d', adminToken);
  ok(r.status === 200 && Number(r.j.kpis?.commissions) >= 590, 'finances : commissions comptées dans la marge', JSON.stringify({ c: r.j.kpis?.commissions }));

  console.log('\n6) Un abonnement payé prime sur la commission');
  r = await adm({ action: 'grant', user_id: M.id, plan_id: plan.id, payment_method: 'cash', reference: 'TEST' });
  ok(r.status === 200, 'abonnement activé par l\'admin', `${r.status} ${JSON.stringify(r.j)}`);
  me = await mine();
  ok(me.state === 'active' && me.formula?.kind === 'subscription' && me.formula?.chosen === 'subscription' && !!me.active, 'formule en vigueur : abonnement', JSON.stringify(me.formula));
  const o4 = (await order(1)).j.order;
  ok(!!o4 && await rateOfOrder(o4.id) === null, 'commande sous abonnement : aucune commission');

  console.log('\n7) Bascule programmée à l\'échéance');
  r = await api('/api/producer/subscription', M.token, { action: 'choose_formula', kind: 'commission' });
  ok(r.status === 200 && r.j.formula?.pending_kind === 'commission' && r.j.formula?.kind === 'subscription', 'commission demandée pendant l\'abonnement : programmée, pas immédiate', JSON.stringify(r.j.formula));
  r = await api('/api/producer/subscription', M.token, { action: 'choose_formula', kind: 'subscription' });
  ok(r.status === 200 && r.j.formula?.pending_kind == null, 'bascule annulée par le marchand');
  await api('/api/producer/subscription', M.token, { action: 'choose_formula', kind: 'commission' });
  const o5 = (await order(1)).j.order;
  ok(!!o5 && await rateOfOrder(o5.id) === null, 'avant l\'échéance : toujours sans commission');
  await admin.from('merchant_subscriptions').update({ starts_at: addDays(today, -10), ends_at: addDays(today, -1) }).eq('user_id', M.id).eq('status', 'active');
  const cronHeaders = env.CRON_SECRET ? { Authorization: `Bearer ${env.CRON_SECRET}` } : {};
  let cr = await fetch(`${BASE}/api/cron/merchants?user=${M.id}&dry=1`, { headers: cronHeaders }); let cj = await cr.json();
  ok(cr.status === 200 && cj.expired?.length === 1 && cj.expired[0].to_commission === true && (await formulaRow()).kind === 'subscription', 'cron à blanc : bascule prévue, rien écrit', JSON.stringify(cj.expired));
  cr = await fetch(`${BASE}/api/cron/merchants?user=${M.id}`, { headers: cronHeaders }); cj = await cr.json();
  const f7 = await formulaRow();
  ok(cr.status === 200 && f7.kind === 'commission' && f7.pending_kind == null && f7.status === 'active', 'cron : marchand passé en commission', JSON.stringify({ e: cj.errors, f: f7 }));
  ok((cj.digests || []).length === 0 && (cj.expired_bundles || []).length === 0, 'cron restreint au marchand de test (ni récapitulatifs ni paniers)');
  const { data: subs7 } = await admin.from('merchant_subscriptions').select('status').eq('user_id', M.id);
  ok(subs7.every(s => s.status === 'expired'), 'abonnement marqué expiré');
  ok(await isActiveSql() === true, 'produits restés visibles, sans interruption');
  const o6 = (await order(1)).j.order;
  ok(!!o6 && await rateOfOrder(o6.id) === 20, 'commande après bascule : taux général (20 %)', o6 ? String(await rateOfOrder(o6.id)) : 'pas de commande');

  console.log('\n8) Suspension en formule commission');
  r = await adm({ action: 'suspend', user_id: M.id, note: 'test' });
  ok(r.status === 200 && (await formulaRow()).status === 'suspended', 'marchand suspendu', String(r.status));
  ok(await isActiveSql() === false, 'produits masqués');
  r = await order(1);
  ok(r.status !== 200 && !r.j.order, 'commande refusée pendant la suspension', String(r.status));
  me = await mine();
  ok(me.state === 'suspended', 'le marchand voit l\'état suspendu', me.state);
  r = await adm({ action: 'reactivate', user_id: M.id });
  ok(r.status === 200 && await isActiveSql() === true, 'marchand réactivé, produits visibles');

  console.log('\n9) Décision admin et formule non proposée');
  r = await adm({ action: 'set_formula', user_id: M.id, kind: 'subscription' });
  ok(r.status === 200 && (await formulaRow()).kind === 'subscription' && await isActiveSql() === false, 'admin : retour en abonnement (sans période payée, produits masqués)');
  await adm({ action: 'save_commission', enabled: false });
  r = await api('/api/producer/subscription', M.token, { action: 'choose_formula', kind: 'commission' });
  ok(r.status === 409 && r.j.error === 'commission_unavailable', 'formule non proposée : choix refusé au marchand', `${r.status} ${r.j.error}`);
  r = await api('/api/merchant-offer', null);
  ok(r.j.commission?.available === false && r.j.commission?.rate == null, 'offre publique : commission masquée');
  r = await adm({ action: 'set_formula', user_id: M.id, kind: 'commission' });
  ok(r.status === 200 && (await formulaRow()).kind === 'commission', 'l\'admin peut tout de même l\'accorder');
  r = await api('/api/admin/merchants', adminToken);
  const row = (r.j.merchants || []).find(m => m.id === M.id);
  ok(!!row && row.state === 'active' && row.formula?.kind === 'commission' && row.formula?.rate === 20, 'liste admin : marchand actif, commission 20 %', JSON.stringify(row?.formula));

  console.log('\n10) Plans : aucune valeur par défaut');
  r = await adm({ action: 'save_plan', name: 'TEST plan sans prix', duration_days: 10 });
  ok(r.status === 400, 'plan sans prix refusé', String(r.status));
  r = await adm({ action: 'save_plan', name: 'TEST plan sans durée', price_fdj: 100 });
  ok(r.status === 400, 'plan sans durée refusé', String(r.status));

  console.log('\n11) Délais paramétrables (rappels, alerte paiement, prolongation)');
  r = await api('/api/admin/merchants', M.token, { action: 'save_delays', extend_days: 2 });
  ok(r.status === 401 || r.status === 403, 'un marchand ne peut pas modifier les délais', String(r.status));
  r = await adm({ action: 'save_delays', extend_days: 0 });
  ok(r.status === 400, 'durée nulle refusée', String(r.status));
  r = await adm({ action: 'save_delays', extend_days: 2.5 });
  ok(r.status === 400, 'durée non entière refusée', String(r.status));
  r = await adm({ action: 'save_delays', reminder_first_days: 3, reminder_last_days: 5 });
  ok(r.status === 400, 'dernier rappel plus éloigné que le premier : refusé', String(r.status));
  r = await adm({ action: 'save_delays', reminder_first_days: 12, reminder_last_days: 4, stale_payment_days: 6, extend_days: 9 });
  ok(r.status === 200 && r.j.delays?.reminder_first_days === 12 && r.j.delays?.reminder_last_days === 4 && r.j.delays?.stale_payment_days === 6 && r.j.delays?.extend_days === 9, 'délais enregistrés : 12, 4, 6, 9 jours', JSON.stringify(r.j.delays));
  // Abonnement qui expire dans 12 jours → premier rappel ; puis prolongation rapide de 9 jours
  await adm({ action: 'set_formula', user_id: M.id, kind: 'subscription' });
  await admin.from('merchant_subscriptions').delete().eq('user_id', M.id);
  await admin.from('merchant_subscriptions').insert({ user_id: M.id, plan_id: plan.id, amount: plan.price_fdj, status: 'active', starts_at: addDays(today, -5), ends_at: addDays(today, 12), payment_method: 'cash' });
  let c11 = await (await fetch(`${BASE}/api/cron/merchants?user=${M.id}&dry=1`, { headers: cronHeaders })).json();
  ok(c11.reminded_first?.length === 1 && c11.reminded_last?.length === 0, 'cron : premier rappel à 12 jours de l\'échéance', JSON.stringify({ f: c11.reminded_first, l: c11.reminded_last }));
  await admin.from('merchant_subscriptions').update({ ends_at: addDays(today, 4) }).eq('user_id', M.id);
  c11 = await (await fetch(`${BASE}/api/cron/merchants?user=${M.id}&dry=1`, { headers: cronHeaders })).json();
  ok(c11.reminded_last?.length === 1 && c11.reminded_first?.length === 0, 'cron : dernier rappel à 4 jours de l\'échéance', JSON.stringify({ f: c11.reminded_first, l: c11.reminded_last }));
  r = await adm({ action: 'extend', user_id: M.id });
  ok(r.status === 200 && r.j.ends_at === addDays(today, 13), 'prolongation rapide : 9 jours ajoutés', JSON.stringify(r.j));
  await admin.from('merchant_subscriptions').insert({ user_id: M.id, plan_id: plan.id, amount: plan.price_fdj, status: 'pending_payment', payment_method: 'cash', created_at: new Date(Date.now() - 6 * 86400000).toISOString() });
  c11 = await (await fetch(`${BASE}/api/cron/merchants?user=${M.id}&dry=1`, { headers: cronHeaders })).json();
  ok(c11.stale_payments?.length === 1, 'cron : paiement déclaré depuis 6 jours signalé', JSON.stringify(c11.stale_payments));
  r = await adm({ action: 'save_delays', reminder_first_days: '', reminder_last_days: '', stale_payment_days: '', extend_days: '' });
  ok(r.status === 200 && Object.values(r.j.delays || { x: 1 }).every(v => v === null), 'champs vidés : fonctions désactivées', JSON.stringify(r.j.delays));
  c11 = await (await fetch(`${BASE}/api/cron/merchants?user=${M.id}&dry=1`, { headers: cronHeaders })).json();
  ok(c11.stale_payments?.length === 0 && c11.reminded_first?.length === 0 && c11.reminded_last?.length === 0, 'cron : plus aucun rappel ni alerte');
  r = await adm({ action: 'extend', user_id: M.id });
  ok(r.status === 400, 'prolongation rapide sans durée réglée : refusée', String(r.status));
} catch (e) {
  fail++; console.error('\n💥 Erreur inattendue :', e);
} finally {
  console.log('\nNettoyage…');
  try {
    // Réglages rétablis à l'identique
    for (const s of state.before) await admin.from('app_settings').upsert({ key: s.key, value_num: s.value_num, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    const keep = new Set(state.before.map(s => s.key));
    for (const k of ['commission_enabled', 'commission_rate', 'reminder_first_days', 'reminder_last_days', 'stale_payment_days', 'extend_days']) if (!keep.has(`merchant.${k}`)) await admin.from('app_settings').delete().eq('key', `merchant.${k}`);
    const ids = [state.merchant?.id, state.client?.id].filter(Boolean);
    if (state.product) {
      const { data: its } = await admin.from('order_items').select('order_id').eq('product_id', state.product);
      const oids = [...new Set([...(its || []).map(i => i.order_id), ...state.orders])];
      if (oids.length) {
        await admin.from('order_items').delete().in('order_id', oids);
        await admin.from('orders').delete().in('id', oids);
      }
    }
    if (state.merchant) {
      await admin.from('merchant_payouts').delete().eq('user_id', state.merchant.id);
      await admin.from('merchant_subscriptions').delete().eq('user_id', state.merchant.id);
      await admin.from('merchant_formulas').delete().eq('user_id', state.merchant.id);
    }
    if (state.product) await admin.from('products').delete().eq('id', state.product);
    await admin.from('merchant_plans').delete().like('name', 'TEST plan sans %');
    for (const id of ids) {
      await admin.from('merchant_profiles').delete().eq('user_id', id);
      await admin.from('user_notifications').delete().eq('user_id', id);
      await admin.from('loyalty_stamps').delete().eq('user_id', id);
      await admin.from('profiles').delete().eq('id', id);
      const { error: delErr } = await admin.auth.admin.deleteUser(id);
      ok(!delErr, 'compte temporaire supprimé', delErr?.message);
    }
    if (state.preparers.length) await admin.from('preparers').update({ is_active: true }).in('id', state.preparers);
    const after = (await admin.from('app_settings').select('key, value_num').like('key', 'merchant.%')).data || [];
    const same = JSON.stringify([...after].sort((a, b) => a.key.localeCompare(b.key))) === JSON.stringify([...state.before].sort((a, b) => a.key.localeCompare(b.key)));
    ok(same, 'réglages rétablis', JSON.stringify(after));
  } catch (e) { fail++; console.error('Nettoyage incomplet :', e); }
  console.log(`\n${pass} réussis, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
}
