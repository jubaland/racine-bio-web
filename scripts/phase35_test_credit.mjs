// Test non destructif du crédit client (phase 35). Serveur local requis (port 3000).
// Comptes, produit, lignes de crédit et commandes temporaires, supprimés à la fin. Préparateurs désactivés.
// Les réglages credit.* sont rétablis. Le cron est appelé avec une date simulée, limité au compte de test.
//   node scripts/phase35_test_credit.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dueDateFor, summarize } from '../lib/credit-math.ts';
import { cheapestDelivery } from './test_helpers.mjs';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY; process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const BASE = process.argv[2] || 'http://localhost:3000';
const CRON = env.CRON_SECRET ? { Authorization: `Bearer ${env.CRON_SECRET}` } : {};

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label} ${extra}`); } };
const stamp = Date.now();
const state = { users: [], products: [], orders: [], preparers: [], accounts: [], settings: null };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const addDays = (day, n) => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const tokenFor = async (email) => {
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const { data: v } = await anon().auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  return v.session.access_token;
};
const api = async (path, token, body, method = body ? 'POST' : 'GET', extraHeaders = {}) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch { /* ignore */ }
  if (j?.order?.id) state.orders.push(j.order.id);
  return { status: r.status, j };
};
let n = 0;
const mkUser = async (name) => {
  const email = `test-credit-${name}-${stamp}@example.com`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: `Tmp-${stamp}!${name}`, email_confirm: true, user_metadata: { full_name: `Test Crédit ${name}` } });
  if (error) throw error;
  state.users.push(u.user.id);
  return { id: u.user.id, email, token: await tokenFor(email), phone: `77${String(stamp).slice(-5)}${n++}` };
};

try {
  console.log('\n1) Calculs');
  ok(dueDateFor('month_end', null, '2026-10-03') === '2026-10-31' && dueDateFor('month_end', null, '2026-02-10') === '2026-02-28', 'échéance fin de mois');
  ok(dueDateFor('days', 30, '2026-10-03') === '2026-11-02', 'échéance à 30 jours');
  const acc = { id: 1, credit_limit: 10000, status: 'active' };
  const E = (type, amount, extra = {}) => ({ id: Math.random(), account_id: 1, type, amount, paid_amount: 0, created_at: '2026-09-01T10:00:00Z', ...extra });
  let s = summarize(acc, [E('charge', 3000, { due_at: '2026-09-30', paid_amount: 1000 }), E('charge', 2000, { due_at: '2026-10-31' }), E('payment', 1000)], '2026-10-05');
  ok(s.outstanding === 4000 && s.overdue === 2000 && s.overdue_since === '2026-09-30' && s.available === 6000 && s.next_due === '2026-10-31' && s.next_due_amount === 4000 && s.usable === false,
    'encours 4 000, retard 2 000 (échéance du 30/09), disponible 6 000, bloqué pour retard', JSON.stringify({ o: s.outstanding, r: s.overdue, a: s.available, n: s.next_due_amount, u: s.usable }));
  s = summarize({ ...acc, status: 'suspended' }, [E('charge', 1000, { due_at: '2026-12-31' })], '2026-10-05');
  ok(s.usable === false && s.available === 9000, 'compte suspendu : inutilisable');

  // ── Préparation ──────────────────────────────────────────────────────────────────
  const { data: preps } = await admin.from('preparers').select('id').eq('is_active', true);
  state.preparers = (preps || []).map(p => p.id);
  if (state.preparers.length) await admin.from('preparers').update({ is_active: false }).in('id', state.preparers);
  const { data: st } = await admin.from('app_settings').select('key, value_num, value_text').like('key', 'credit.%');
  state.settings = st || [];
  const DEL = await cheapestDelivery(admin);
  const F = DEL.price;
  const adminToken = await tokenFor('wilsandj@hotmail.com');
  const { data: P, error: pe } = await admin.from('products').insert({ name: 'TEST Crédit produit', price: 1000, cost_price: 600, unit: 'kg', stock_qty: 300, farm: 'Test', category: 'legumes', product_type: 'conventionnel', origin_country: 'DJ', region: 'Test', status: 'published', is_local: false, in_stock: true, description: 'TEST CRÉDIT — à supprimer', bg_color: '#ecf4d5' }).select('id').single();
  if (pe) throw pe;
  state.products.push(P.id);
  const [A, B] = [await mkUser('a'), await mkUser('b')];
  const order = (u, qty = 1, o = {}) => api('/api/orders', u.token, {
    order: { user_id: u.id, payment_method: 'credit', customer_name: 'Test Crédit', phone: u.phone, address: 'Test', ...DEL.fields, delivery_fee: 0, total: 1, ...o },
    items: [{ product_id: P.id, quantity: qty, price: 1, product_name: 'TEST Crédit produit', product_unit: 'kg' }],
  });
  const cr = (body) => api('/api/admin/credit', adminToken, body);
  const mine = (u) => api('/api/credit', u.token);
  const cron = (date, account) => api(`/api/cron/deliveries?only=credit&date=${date}&account=${account}`, null, undefined, 'GET', CRON);
  const lastNotif = async (uid) => (await admin.from('user_notifications').select('title, body').eq('user_id', uid).order('created_at', { ascending: false }).limit(1)).data?.[0];
  const today = new Date().toISOString().slice(0, 10);
  const accOf = (j, uid) => (j.accounts || []).find(a => a.account.user_id === uid);

  console.log('\n2) Sans ligne de crédit');
  let r = await order(A, 1);
  ok(r.status === 409 && r.j.error === 'credit_unavailable' && r.j.reason === 'no_account', 'commande à crédit refusée : pas de ligne de crédit', JSON.stringify(r.j));
  r = await mine(A);
  ok(r.status === 200 && r.j.user === null, '« mon crédit » : aucun compte');

  console.log('\n3) Activation par l\'admin');
  r = await cr({ action: 'create', holder_type: 'user', email: `inconnu-${stamp}@example.com`, credit_limit: 5000 });
  ok(r.status === 400 && r.j.error === 'user_not_found', 'e-mail inconnu refusé');
  r = await cr({ action: 'create', holder_type: 'user', email: A.email, credit_limit: 0 });
  ok(r.status === 400 && r.j.error === 'limit_invalid', 'plafond nul refusé');
  r = await cr({ action: 'create', holder_type: 'user', email: A.email, credit_limit: 5000, term: 'month_end', note: 'TEST' });
  const accA = accOf(r.j, A.id);
  ok(r.status === 200 && accA && accA.account.credit_limit === 5000 && accA.available === 5000, 'ligne de crédit créée : 5 000 Fdj, fin de mois', JSON.stringify(r.j).slice(0, 160));
  if (accA) state.accounts.push(accA.account.id);
  r = await cr({ action: 'create', holder_type: 'user', email: A.email, credit_limit: 5000 });
  ok(r.status === 409 && r.j.error === 'already_exists', 'doublon refusé');
  await sleep(600);
  let nt = await lastNotif(A.id);
  ok(nt && /Crédit Hornafresh activé/.test(nt.title) && /5.000/.test(nt.body.replace(/ | /g, '.')), 'client prévenu de l\'activation', JSON.stringify(nt));
  r = await mine(A);
  ok(r.j.user?.usable === true && r.j.user?.available === 5000 && r.j.user?.due_if_ordered_today === dueDateFor('month_end', null, today), '« mon crédit » : utilisable, échéance fin de mois');

  console.log('\n4) Commandes à crédit');
  r = await order(A, 3);     // 3 000 + livraison
  const o1 = r.j.order?.id;
  ok(r.status === 200 && r.j.order.payment_method === 'credit' && Number(r.j.order.total) === 3000 + F, 'commande à crédit acceptée', JSON.stringify(r.j).slice(0, 160));
  const { data: ch } = await admin.from('credit_entries').select('*').eq('order_id', o1).maybeSingle();
  ok(ch && ch.type === 'charge' && ch.amount === 3000 + F && ch.due_at === dueDateFor('month_end', null, today), 'charge inscrite avec la date limite', JSON.stringify(ch));
  r = await order(A, 3);
  ok(r.status === 409 && r.j.reason === 'limit' && r.j.available === 5000 - (3000 + F), 'plafond dépassé : refus avec le disponible', JSON.stringify(r.j));
  r = await order(A, 1);
  const o2 = r.j.order?.id;
  ok(r.status === 200, 'commande dans le disponible : acceptée');
  r = await mine(A);
  ok(r.j.user.outstanding === 4000 + 2 * F && r.j.user.open.length === 2, 'encours 4 000 + livraisons, 2 commandes ouvertes', JSON.stringify({ o: r.j.user.outstanding, n: r.j.user.open.length }));
  r = await api('/api/orders', adminToken, { id: o2, status: 'cancelled' }, 'PATCH');
  r = await mine(A);
  ok(r.j.user.outstanding === 3000 + F && r.j.user.open.length === 1, 'commande annulée : charge retirée du carnet', JSON.stringify({ o: r.j.user.outstanding }));
  const itemB = (await admin.from('order_items').select('id').eq('order_id', o1).single()).data;
  r = await api('/api/admin/orders/discount', adminToken, { order_id: o1, mode: 'line', item_id: itemB.id, new_price: 900, note: 'Négocié' });
  r = await mine(A);
  ok(r.j.user.outstanding === 2700 + F, 'remise de 300 : charge réduite', JSON.stringify({ o: r.j.user.outstanding }));
  r = await order(B, 1);
  ok(r.status === 409 && r.j.reason === 'no_account', 'un autre client sans ligne de crédit est refusé');

  console.log('\n5) Paiements reçus');
  r = await cr({ action: 'pay', id: accA.account.id, amount: 0 });
  ok(r.status === 400, 'paiement nul refusé');
  r = await cr({ action: 'pay', id: accA.account.id, amount: 1000, method: 'cash', note: 'TEST reçu' });
  let a = accOf(r.j, A.id);
  ok(r.status === 200 && a.outstanding === 1700 + F && a.open[0].paid_amount === 1000, 'paiement partiel affecté à la commande', JSON.stringify({ o: a.outstanding, p: a.open[0]?.paid_amount }));
  await sleep(600);
  nt = await lastNotif(A.id);
  ok(nt && /Paiement reçu/.test(nt.title), 'client prévenu du paiement', JSON.stringify(nt));
  const led = (await api(`/api/admin/credit?entries=${accA.account.id}`, adminToken)).j;
  ok(Array.isArray(led?.entries) && led.entries.some(e => e.type === 'payment' && e.amount === 1000) && led.entries.some(e => e.type === 'refund'), 'journal : paiement et avoir (annulation) tracés', JSON.stringify((led?.entries || []).map(e => e.type)));

  console.log('\n6) Rappels, relevé, retard, suspension (cron à date simulée)');
  const due = dueDateFor('month_end', null, today);
  await cr({ action: 'save_settings', remind_before_days: 3, overdue_remind_days: 7, suspend_after_days: 15 });
  r = await cron(addDays(due, -3), accA.account.id);
  ok(r.status === 200 && (r.j.credit?.events || []).some(e => e.kind === 'before' && e.amount === 1700 + F), 'J-3 : rappel avant échéance', JSON.stringify(r.j).slice(0, 200));
  r = await cron(addDays(due, -3), accA.account.id);
  ok((r.j.credit?.events || []).length === 0, 'rejoué le même jour : pas de doublon');
  r = await cron(due, accA.account.id);
  ok((r.j.credit?.events || []).some(e => e.kind === 'statement'), 'jour J : relevé envoyé', JSON.stringify(r.j).slice(0, 200));
  r = await cron(addDays(due, 7), accA.account.id);
  ok((r.j.credit?.events || []).some(e => e.kind === 'overdue'), 'J+7 : relance de retard');
  r = await order(A, 1, { phone: A.phone });
  ok(r.status === 200, 'pas encore de retard réel aujourd\'hui : commande encore possible');
  r = await cron(addDays(due, 15), accA.account.id);
  ok((r.j.credit?.events || []).some(e => e.kind === 'suspended'), 'J+15 : suspension automatique');
  const { data: accRow } = await admin.from('credit_accounts').select('status, auto_suspended').eq('id', accA.account.id).single();
  ok(accRow.status === 'suspended' && accRow.auto_suspended === true, 'compte suspendu par le système', JSON.stringify(accRow));
  r = await order(A, 1);
  ok(r.status === 409 && r.j.reason === 'suspended', 'commande à crédit refusée : suspendu');
  const { data: reminders } = await admin.from('credit_reminders').select('kind').eq('account_id', accA.account.id);
  ok((reminders || []).map(x => x.kind).sort().join() === 'before,overdue,statement,suspended', 'quatre rappels enregistrés, une fois chacun', JSON.stringify(reminders));

  console.log('\n7) Règlement complet → réactivation');
  r = await mine(A);
  const rest = r.j.user.outstanding;
  r = await cr({ action: 'pay', id: accA.account.id, amount: rest, method: 'waafi' });
  a = accOf(r.j, A.id);
  ok(r.status === 200 && r.j.payment?.reactivated === true && a.outstanding === 0 && a.account.status === 'active', 'réglé en totalité : encours 0, crédit réactivé automatiquement', JSON.stringify({ p: r.j.payment, o: a?.outstanding, s: a?.account.status }));
  r = await cr({ action: 'pay', id: accA.account.id, amount: 500, method: 'cash' });
  a = accOf(r.j, A.id);
  ok(r.j.payment?.unallocated === 500 && a.outstanding === -500 && a.available === 5500, 'trop-perçu : avoir de 500, disponible augmenté', JSON.stringify({ u: r.j.payment?.unallocated, o: a?.outstanding, av: a?.available }));

  console.log('\n8) Suspension manuelle, réglages, droits');
  r = await cr({ action: 'suspend', id: accA.account.id, reason: 'TEST motif' });
  ok(r.status === 200 && accOf(r.j, A.id).account.status === 'suspended', 'suspension manuelle');
  r = await cr({ action: 'reactivate', id: accA.account.id });
  ok(r.status === 200 && accOf(r.j, A.id).account.status === 'active', 'réactivation manuelle');
  r = await cr({ action: 'update', id: accA.account.id, credit_limit: 8000, term: 'days', term_days: 10 });
  a = accOf(r.j, A.id);
  ok(a.account.credit_limit === 8000 && a.account.term === 'days' && a.account.term_days === 10, 'plafond et échéance modifiés');
  r = await mine(A);
  ok(r.j.user.due_if_ordered_today === addDays(today, 10), 'échéance à 10 jours visible côté client');
  r = await cr({ action: 'save_settings', enabled: false });
  r = await order(A, 1);
  ok(r.status === 409 && r.j.reason === 'disabled', 'crédit désactivé globalement : refus');
  await cr({ action: 'save_settings', enabled: true });
  r = await cr({ action: 'save_settings', suspend_after_days: -1 });
  ok(r.status === 400, 'délai négatif refusé');
  r = await api('/api/admin/credit', A.token);
  ok(r.status === 401 || r.status === 403, 'un client ne voit pas le module');
  r = await api('/api/admin/credit', A.token, { action: 'pay', id: accA.account.id, amount: 100000 });
  ok(r.status === 401 || r.status === 403, 'un client n\'enregistre pas de paiement');
  const anonRead = await anon().from('credit_accounts').select('id').limit(1);
  ok(!anonRead.error ? (anonRead.data || []).length === 0 : true, 'comptes illisibles depuis le navigateur');
  r = await api('/api/cron/deliveries?only=credit', null, undefined, 'GET', env.CRON_SECRET ? { Authorization: 'Bearer mauvais' } : {});
  ok(!env.CRON_SECRET || r.status === 401, 'cron protégé par son secret');
  r = await api('/api/admin/finances?period=30d', adminToken);
  ok(r.status === 200 && 'creditOutstanding' in (r.j.kpis || {}), 'Finances : encours crédit présent');
} catch (e) {
  fail++; console.error('\n💥 Erreur inattendue :', e);
} finally {
  console.log('\nNettoyage…');
  try {
    // Réglages crédit rétablis
    await admin.from('app_settings').delete().like('key', 'credit.%');
    if (state.settings.length) await admin.from('app_settings').upsert(state.settings.map(s => ({ ...s, updated_at: new Date().toISOString() })), { onConflict: 'key' });
    const { data: its } = state.products.length ? await admin.from('order_items').select('order_id').in('product_id', state.products) : { data: [] };
    const oids = [...new Set([...(its || []).map(i => i.order_id), ...state.orders])];
    if (state.accounts.length) await admin.from('credit_accounts').delete().in('id', state.accounts);   // écritures et rappels en cascade
    if (oids.length) {
      await admin.from('order_refunds').delete().in('order_id', oids);
      await admin.from('loyalty_stamps').delete().in('order_id', oids);
      await admin.from('order_items').delete().in('order_id', oids);
      await admin.from('orders').delete().in('id', oids);
    }
    if (state.products.length) await admin.from('products').delete().in('id', state.products);
    for (const id of state.users) {
      for (const t of ['wallet_transactions', 'wallets', 'user_notifications', 'loyalty_stamps', 'referral_codes', 'profiles']) await admin.from(t).delete().eq(t === 'profiles' ? 'id' : 'user_id', id);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) ok(false, 'compte temporaire supprimé', error.message);
    }
    if (state.preparers.length) await admin.from('preparers').update({ is_active: true }).in('id', state.preparers);
    const leftP = (await admin.from('products').select('id', { count: 'exact', head: true }).ilike('name', 'TEST Crédit%')).count;
    const leftO = (await admin.from('orders').select('id', { count: 'exact', head: true }).eq('customer_name', 'Test Crédit')).count;
    const leftA = state.accounts.length ? (await admin.from('credit_accounts').select('id', { count: 'exact', head: true }).in('id', state.accounts)).count : 0;
    ok(leftP === 0 && leftO === 0 && leftA === 0, 'produit, commandes et ligne de crédit de test supprimés', `${leftP}/${leftO}/${leftA}`);
  } catch (e) { fail++; console.error('Nettoyage incomplet :', e); }
  console.log(`\n${pass} réussis, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
}
