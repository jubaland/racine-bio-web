// Test non destructif de la modification des frais de livraison d'une commande (phase 40).
// Serveur local requis (port 3000). Comptes, produit et commandes temporaires supprimés,
// préparateurs désactivés pendant le test.
//   node scripts/phase40_test_delivery_fee.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { cheapestDelivery } from './test_helpers.mjs';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const BASE = process.argv[2] || 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label} ${extra}`); } };
const stamp = Date.now();
const state = { users: [], products: [], orders: [], preparers: [], accounts: [] };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
let n = 0;
const mkUser = async (name) => {
  const email = `test-fraisliv-${name}-${stamp}@example.com`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: `Tmp-${stamp}!${name}`, email_confirm: true, user_metadata: { full_name: `Test FraisLiv ${name}` } });
  if (error) throw error;
  state.users.push(u.user.id);
  return { id: u.user.id, email, token: await tokenFor(email), phone: `77${String(stamp).slice(-5)}${n++}` };
};

try {
  const { data: preps } = await admin.from('preparers').select('id').eq('is_active', true);
  state.preparers = (preps || []).map(p => p.id);
  if (state.preparers.length) await admin.from('preparers').update({ is_active: false }).in('id', state.preparers);
  const DEL = await cheapestDelivery(admin);
  const F = DEL.price;
  const { data: opts } = await admin.from('delivery_options').select('id, name, price').eq('is_active', true).order('price', { ascending: false });
  const EXPENSIVE = (opts || [])[0];                                   // option la plus chère (pour le changement d'option)
  const adminToken = await tokenFor('wilsandj@hotmail.com');
  const { data: P, error: pe } = await admin.from('products').insert({ name: 'TEST FraisLiv produit', price: 1000, cost_price: 600, unit: 'kg', stock_qty: 50, farm: 'Test', category: 'legumes', product_type: 'conventionnel', origin_country: 'DJ', region: 'Test', status: 'published', is_local: false, in_stock: true, description: 'TEST FRAISLIV — à supprimer', bg_color: '#ecf4d5' }).select('id').single();
  if (pe) throw pe;
  state.products.push(P.id);
  const [A, B] = [await mkUser('a'), await mkUser('b')];
  const walletOf = async (uid) => Number((await admin.from('wallets').select('balance').eq('user_id', uid).maybeSingle()).data?.balance) || 0;
  const order = (u, o = {}) => api('/api/orders', u.token, {
    order: { user_id: u.id, payment_method: 'cash', customer_name: 'Test FraisLiv', phone: u.phone, address: 'Test', ...DEL.fields, delivery_fee: 0, total: 1, ...o },
    items: [{ product_id: P.id, quantity: 2, price: 1, product_name: 'TEST FraisLiv produit', product_unit: 'kg' }],
  });
  const fee = (oid, body, token = adminToken) => api('/api/admin/orders/delivery-fee', token, { order_id: oid, ...body });
  const rowOf = async (oid) => (await admin.from('orders').select('total, delivery_fee, delivery_option_name').eq('id', oid).single()).data;
  const journalOf = async (oid) => (await admin.from('order_edits').select('*').eq('order_id', oid).eq('kind', 'delivery_fee').order('id')).data || [];
  const deliver = (oid) => api('/api/orders', adminToken, { id: oid, status: 'delivered' }, 'PATCH');
  const lastNotif = async (uid) => (await admin.from('user_notifications').select('title, body').eq('user_id', uid).order('created_at', { ascending: false }).limit(1)).data?.[0];

  console.log('\n1) Montant libre (commande en attente, espèces)');
  let r = await order(A);
  const o1 = r.j.order.id;
  r = await fee(o1, { fee: -5 });
  ok(r.status === 400 && r.j.error === 'fee_invalid', 'montant négatif refusé', JSON.stringify(r.j));
  r = await fee(o1, { fee: 'abc' });
  ok(r.status === 400 && r.j.error === 'fee_invalid', 'montant non numérique refusé');
  r = await fee(o1, { fee: F });
  ok(r.status === 400 && r.j.error === 'no_change', 'même montant : refus');
  r = await fee(o1, { fee: 0 });
  let row = await rowOf(o1);
  ok(r.status === 200 && r.j.delta === -F && Number(row.delivery_fee) === 0 && Number(row.total) === 2000, 'livraison offerte (0) : total recalculé', JSON.stringify({ r: r.j, row }));
  let jr = await journalOf(o1);
  ok(jr.length === 1 && Number(jr[0].from_qty) === F && Number(jr[0].to_qty) === 0 && jr[0].amount === -F && jr[0].by_role === 'admin', 'journal : ancien → nouveau montant, auteur', JSON.stringify(jr[0]));
  await sleep(600);
  let nt = await lastNotif(A.id);
  ok(nt && /Livraison .* ajustée|ajustée/.test(nt.title) && nt.body.includes('0 Fdj'), 'client prévenu (baisse)', JSON.stringify(nt));
  if (EXPENSIVE) {
    r = await fee(o1, { option_id: EXPENSIVE.id });
    row = await rowOf(o1);
    ok(r.status === 200 && Number(row.delivery_fee) === Number(EXPENSIVE.price) && row.delivery_option_name === EXPENSIVE.name, `changement d'option : tarif et nom de « ${EXPENSIVE.name} » appliqués`, JSON.stringify(row));
  }

  console.log('\n2) Garde-fous après livraison');
  r = await order(A);
  const o2 = r.j.order.id;
  await deliver(o2);
  r = await fee(o2, { fee: 0 });
  ok(r.status === 400 && r.j.error === 'reason_required', 'commande livrée sans motif : refus');
  r = await fee(o2, { fee: 0, reason: 'Retrait sur place finalement' });
  ok(r.status === 200 && (await journalOf(o2))[0]?.reason === 'Retrait sur place finalement', 'livrée + motif : accepté et motif conservé', JSON.stringify(r.j));

  console.log('\n3) L\'argent suit (cagnotte et crédit)');
  await admin.rpc('wallet_adjust', { p_user: B.id, p_amount: 5000, p_type: 'deposit', p_order: null, p_note: 'TEST dépôt' });
  r = await order(B, { payment_method: 'wallet' });
  const o3 = r.j.order.id;
  const bal0 = await walletOf(B.id);
  r = await fee(o3, { fee: F + 400 });
  ok(r.status === 200 && await walletOf(B.id) === bal0 - 400, 'hausse de 400 : cagnotte débitée', `${bal0} → ${await walletOf(B.id)}`);
  r = await fee(o3, { fee: F });
  ok(r.status === 200 && await walletOf(B.id) === bal0, 'retour au tarif : 400 recrédités', String(await walletOf(B.id)));
  r = await fee(o3, { fee: 100000 });
  ok(r.status === 409 && r.j.error === 'wallet_insufficient', 'hausse au-delà du solde : refus', JSON.stringify(r.j));
  // Crédit : la charge suit
  r = await api('/api/admin/credit', adminToken, { action: 'create', holder_type: 'user', email: A.email, credit_limit: 4000 });
  const acc = (r.j.accounts || []).find(x => x.account.user_id === A.id);
  if (acc) state.accounts.push(acc.account.id);
  r = await order(A, { payment_method: 'credit' });
  const o4 = r.j.order.id;
  const chargeOf = async () => Number((await admin.from('credit_entries').select('amount').eq('order_id', o4).eq('type', 'charge').single()).data.amount);
  const c0 = await chargeOf();
  r = await fee(o4, { fee: F + 300 });
  ok(r.status === 200 && await chargeOf() === c0 + 300, 'crédit : charge du carnet augmentée de 300', `${c0} → ${await chargeOf()}`);
  r = await fee(o4, { fee: F + 300 + 100000 });
  ok(r.status === 409 && r.j.error === 'credit_unavailable', 'au-delà du plafond : refus');
  r = await fee(o4, { fee: F });
  ok(r.status === 200 && await chargeOf() === c0, 'baisse : charge revenue à sa valeur initiale, d\'autant', String(await chargeOf()));

  console.log('\n4) Droits et divers');
  r = await fee(o1, { option_id: 999999 });
  ok(r.status === 400 && r.j.error === 'delivery_option_invalid', 'option inconnue refusée');
  r = await fee(o1, { fee: 0 }, B.token);
  ok(r.status === 401 || r.status === 403, 'un client ne modifie pas les frais', String(r.status));
  r = await api('/api/orders', adminToken, { id: o1, status: 'cancelled' }, 'PATCH');
  r = await fee(o1, { fee: 200, reason: 'x' });
  ok(r.status === 409 && r.j.error === 'order_cancelled', 'commande annulée : intouchable');
  r = await api('/api/admin/orders/edits', adminToken);
  const mine = (r.j.edits || []).filter(e => e.kind === 'delivery_fee' && /TEST|Standard|Point/.test(String(e.product_name)) && e.orders?.customer_name === 'Test FraisLiv');
  ok(mine.length >= 5, 'journal global : écritures « livraison » présentes', String(mine.length));
  r = await api('/api/orders', adminToken);
  const listed = (r.j.orders || []).find(o => o.id === o2);
  ok(listed && (listed.order_edits || []).some(e => e.kind === 'delivery_fee'), 'liste des commandes : écriture livraison embarquée');
} catch (e) {
  fail++; console.error('\n💥 Erreur inattendue :', e);
} finally {
  console.log('\nNettoyage…');
  try {
    const { data: its } = state.products.length ? await admin.from('order_items').select('order_id').in('product_id', state.products) : { data: [] };
    const oids = [...new Set([...(its || []).map(i => i.order_id), ...state.orders])];
    if (state.accounts.length) await admin.from('credit_accounts').delete().in('id', state.accounts);
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
    const leftP = (await admin.from('products').select('id', { count: 'exact', head: true }).ilike('name', 'TEST FraisLiv%')).count;
    const leftO = (await admin.from('orders').select('id', { count: 'exact', head: true }).eq('customer_name', 'Test FraisLiv')).count;
    ok(leftP === 0 && leftO === 0, 'produit et commandes de test supprimés', `${leftP}/${leftO}`);
  } catch (e) { fail++; console.error('Nettoyage incomplet :', e); }
  console.log(`\n${pass} réussis, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
}
