// Test non destructif de la fidélité (phase 17). Serveur local requis (npm run dev, port 3000).
// Compte temporaire + produit de test. Réglages passés à 3 commandes / 700 Fdj / minimum 1 000 le temps
// du test puis RÉTABLIS. Vérifie : tampon à la livraison, minimum, un par jour, récompense créditée,
// nouvelle carte, annulation, invité et société exclus, programme en pause, droits.
//   node scripts/phase17_test_loyalty.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { cheapestDelivery } from './test_helpers.mjs';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// Frais de livraison calculés par le serveur : chaque commande de test désigne une option réelle
const DEL = await cheapestDelivery(admin);
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const BASE = 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label} ${extra}`); } };
const stamp = Date.now();
const state = { user: null, product: null, orders: [], preparers: [], before: [] };

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
const stampsOpen = async () => (await admin.from('loyalty_stamps').select('id', { count: 'exact', head: true }).eq('user_id', state.user.id).is('reward_id', null)).count;
const walletOf = async () => Number((await admin.from('wallets').select('balance').eq('user_id', state.user.id).maybeSingle()).data?.balance) || 0;
// Vieillit les tampons existants d'un jour chacun : simule des commandes livrées des jours différents
const ageStamps = async () => { const { data } = await admin.from('loyalty_stamps').select('id, stamp_date').eq('user_id', state.user.id).order('stamp_date'); for (const s of data || []) { const d = new Date(s.stamp_date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 40); await admin.from('loyalty_stamps').update({ stamp_date: new Date(d.getTime() - (s.id % 30) * 86400000).toISOString().slice(0, 10) }).eq('id', s.id); } };

try {
  const { data: preps } = await admin.from('preparers').select('id').eq('is_active', true);
  state.preparers = (preps || []).map(p => p.id);
  if (state.preparers.length) await admin.from('preparers').update({ is_active: false }).in('id', state.preparers);
  state.before = (await admin.from('app_settings').select('key, value_num').like('key', 'loyalty.%')).data || [];

  const email = `test-fidelite-${stamp}@example.com`;
  const { data: u } = await admin.auth.admin.createUser({ email, password: `Tmp-${stamp}!f`, email_confirm: true, user_metadata: { full_name: 'Test Fidélité' } });
  state.user = { id: u.user.id, email, token: await tokenFor(email) };
  const adminToken = await tokenFor('wilsandj@hotmail.com');
  const { data: P } = await admin.from('products').insert({ name: 'TEST Fidélité produit', price: 500, cost_price: 300, unit: 'kg', stock_qty: 200, farm: 'Test', category: 'legumes', product_type: 'conventionnel', origin_country: 'DJ', region: 'Test', status: 'published', is_local: false, in_stock: true, description: 'TEST FIDÉLITÉ — à supprimer', bg_color: '#ecf4d5' }).select('id').single();
  state.product = P.id;

  const order = async (qty, token = state.user.token, userId = state.user.id) => (await api('/api/orders', token, {
    order: { user_id: userId, payment_method: 'cash', ...DEL.fields, customer_name: 'Test Fidélité', phone: '77000000', address: 'Test' },
    items: [{ product_id: P.id, quantity: qty, price: 500, product_name: 'TEST Fidélité produit', product_unit: 'kg' }],
  })).j.order;
  const deliver = (id) => api('/api/orders', adminToken, { id, status: 'delivered' }, 'PATCH');
  const cancel = (id) => api('/api/orders', adminToken, { id, status: 'cancelled' }, 'PATCH');

  console.log('\n1) Réglages (admin)');
  let r = await api('/api/admin/loyalty', state.user.token, { reward_amount: 99999 });
  ok(r.status === 401 || r.status === 403, 'un client ne peut pas modifier les réglages', String(r.status));
  r = await api('/api/admin/loyalty', adminToken, { orders_required: 0 });
  ok(r.status === 400, 'nombre de commandes invalide refusé', String(r.status));
  r = await api('/api/admin/loyalty', adminToken, { enabled: true, orders_required: 3, reward_amount: 700, min_order: 1000 });
  ok(r.status === 200 && r.j.orders_required === 3 && r.j.reward_amount === 700, 'réglages enregistrés : 3 commandes, 700 Fdj, minimum 1 000', JSON.stringify(r.j));
  r = await api('/api/loyalty', state.user.token);
  ok(r.status === 200 && r.j.stamps === 0 && r.j.remaining === 3 && r.j.reward_amount === 700, 'carte du client : 0/3', JSON.stringify(r.j));
  r = await api('/api/loyalty', null);
  ok(r.status === 401, 'carte inaccessible sans connexion', String(r.status));

  console.log('\n2) Tampon à la livraison');
  const o1 = await order(2);                                   // 1 000 Fdj
  ok(await stampsOpen() === 0, 'commande passée mais non livrée : pas de tampon');
  await deliver(o1.id);
  ok(await stampsOpen() === 1, 'commande livrée : 1 tampon', String(await stampsOpen()));
  await deliver(o1.id);
  ok(await stampsOpen() === 1, 'livraison rejouée : toujours 1 tampon');

  console.log('\n3) Garde-fous');
  const o2 = await order(2);
  await deliver(o2.id);
  ok(await stampsOpen() === 1, 'deuxième commande le même jour : pas de second tampon', String(await stampsOpen()));
  await ageStamps();
  const o3 = await order(1);   // 500 d'articles + la livraison (facturée par le serveur) : sous le minimum hors livraison
  await deliver(o3.id);
  ok(await stampsOpen() === 1, 'commande sous le minimum (hors livraison) : pas de tampon', String(await stampsOpen()));
  const g = (await api('/api/orders', null, { order: { user_id: null, payment_method: 'cash', ...DEL.fields, customer_name: 'Test Invité', phone: '77000000', address: 'Test' }, items: [{ product_id: P.id, quantity: 4, price: 500, product_name: 'TEST', product_unit: 'kg' }] })).j.order;
  await deliver(g.id);
  ok((await admin.from('loyalty_stamps').select('id').eq('order_id', g.id)).data.length === 0, 'commande invité : pas de tampon');

  console.log('\n4) Annulation');
  const o4 = await order(3);
  await deliver(o4.id);
  ok(await stampsOpen() === 2, '2 tampons', String(await stampsOpen()));
  await cancel(o4.id);
  ok(await stampsOpen() === 1, 'commande annulée : son tampon est retiré', String(await stampsOpen()));

  console.log('\n5) Récompense');
  await ageStamps();
  const o5 = await order(2); await deliver(o5.id); await ageStamps();
  ok(await stampsOpen() === 2 && await walletOf() === 0, '2/3 : pas encore de récompense');
  const o6 = await order(2); r = await deliver(o6.id);
  ok(await walletOf() === 700, 'carte pleine : 700 Fdj crédités sur la cagnotte', String(await walletOf()));
  ok(await stampsOpen() === 0, 'nouvelle carte à 0/3', String(await stampsOpen()));
  const { data: rw } = await admin.from('loyalty_rewards').select('*').eq('user_id', state.user.id);
  ok(rw.length === 1 && Number(rw[0].amount) === 700 && rw[0].stamps_used === 3, 'récompense enregistrée (3 tampons utilisés)', JSON.stringify(rw));
  const { data: tx } = await admin.from('wallet_transactions').select('type, amount, note').eq('user_id', state.user.id);
  ok(tx.length === 1 && tx[0].type === 'loyalty' && /fidélité/i.test(tx[0].note), 'mouvement de cagnotte tracé « Récompense fidélité »', JSON.stringify(tx));
  const { data: nt } = await admin.from('user_notifications').select('title').eq('user_id', state.user.id).order('created_at', { ascending: false });
  ok(nt.some(n => /Récompense fidélité/.test(n.title)) && nt.some(n => /Plus qu'une commande/.test(n.title)), 'notifications : « plus qu\'une commande » puis « récompense »', JSON.stringify(nt.map(n => n.title)).slice(0, 300));
  await cancel(o6.id);
  ok(await walletOf() === 700 && (await admin.from('loyalty_rewards').select('id').eq('user_id', state.user.id)).data.length === 1, 'annulation après récompense : la récompense versée est conservée');
  r = await api('/api/loyalty', state.user.token);
  ok(r.j.stamps === 0 && r.j.total_rewarded === 700 && r.j.rewards.length === 1, 'carte du client : 0/3, 700 Fdj déjà gagnés', JSON.stringify(r.j).slice(0, 200));

  console.log('\n6) Réglage modifié, programme en pause');
  await api('/api/admin/loyalty', adminToken, { reward_amount: 1200 });
  r = await api('/api/loyalty', state.user.token);
  ok(r.j.reward_amount === 1200, 'nouveau montant de récompense visible côté client', String(r.j.reward_amount));
  await api('/api/admin/loyalty', adminToken, { enabled: false });
  await ageStamps();
  const o7 = await order(2); await deliver(o7.id);
  ok(await stampsOpen() === 0 && (await api('/api/loyalty', state.user.token)).j.enabled === false, 'programme en pause : aucun tampon, carte masquée');

  console.log('\n7) RLS');
  const asUser = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${state.user.token}` } } });
  const ins = await asUser.from('loyalty_stamps').insert({ user_id: state.user.id, order_id: o7.id });
  ok(!!ins.error, 'un client ne peut pas se poser un tampon', ins.error?.message);
  const rpc = await asUser.rpc('loyalty_award', { p_user: state.user.id, p_order: o7.id, p_required: 1, p_amount: 5000 });
  ok(!!rpc.error && await walletOf() === 700, 'un client ne peut pas s\'attribuer une récompense', rpc.error?.message);
  const others = await anon().from('loyalty_rewards').select('id');
  ok((others.data || []).length === 0, 'les récompenses ne sont pas lisibles anonymement');
} catch (e) { fail++; console.error('  ❌ exception', e); }

console.log(`\n${pass} OK / ${fail} KO\n\n🧹 Nettoyage`);
try {
  for (const row of state.before) await admin.from('app_settings').update({ value_num: row.value_num }).eq('key', row.key);
  for (const oid of state.orders) { await admin.from('order_refunds').delete().eq('order_id', oid); await admin.from('order_items').delete().eq('order_id', oid); await admin.from('orders').delete().eq('id', oid); }
  if (state.product) await admin.from('products').delete().eq('id', state.product);
  if (state.user) {
    for (const t of ['loyalty_stamps', 'loyalty_rewards', 'user_notifications', 'wallet_transactions', 'wallets']) await admin.from(t).delete().eq('user_id', state.user.id).then(() => {}, () => {});
    await admin.from('profiles').delete().eq('id', state.user.id).then(() => {}, () => {});
    await admin.auth.admin.deleteUser(state.user.id);
  }
  if (state.preparers.length) await admin.from('preparers').update({ is_active: true }).in('id', state.preparers);
  const now = (await admin.from('app_settings').select('key, value_num').like('key', 'loyalty.%')).data;
  console.log('  compte, produit, commandes supprimés ; préparateurs réactivés ; réglages rétablis :', JSON.stringify(Object.fromEntries(now.map(r => [r.key.replace('loyalty.', ''), Number(r.value_num)]))));
} catch (e) { console.error('  ⚠️ nettoyage incomplet', e); }
process.exit(fail ? 1 : 0);
