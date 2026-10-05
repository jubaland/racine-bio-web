// Test non destructif de la modification des quantités d'une commande quel que soit le statut
// (phase 37). Serveur local requis (port 3000). Comptes, produit et commandes temporaires supprimés,
// préparateurs désactivés pendant le test, réglage fidélité min_order posé à 1 000 puis rétabli.
//   node scripts/phase37_test_order_edits.mjs
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
const state = { users: [], products: [], orders: [], preparers: [], accounts: [], minOrder: undefined };
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
  const email = `test-editqty-${name}-${stamp}@example.com`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: `Tmp-${stamp}!${name}`, email_confirm: true, user_metadata: { full_name: `Test ModifQté ${name}` } });
  if (error) throw error;
  state.users.push(u.user.id);
  return { id: u.user.id, email, token: await tokenFor(email), phone: `77${String(stamp).slice(-5)}${n++}` };
};

try {
  const { data: preps } = await admin.from('preparers').select('id').eq('is_active', true);
  state.preparers = (preps || []).map(p => p.id);
  if (state.preparers.length) await admin.from('preparers').update({ is_active: false }).in('id', state.preparers);
  const { data: lm } = await admin.from('app_settings').select('value_num').eq('key', 'loyalty.min_order').maybeSingle();
  state.minOrder = lm ? lm.value_num : undefined;
  await admin.from('app_settings').upsert({ key: 'loyalty.min_order', value_num: 1000, updated_at: new Date().toISOString() }, { onConflict: 'key' });

  const DEL = await cheapestDelivery(admin);
  const F = DEL.price;
  const adminToken = await tokenFor('wilsandj@hotmail.com');
  const { data: P, error: pe } = await admin.from('products').insert({ name: 'TEST ModifQté produit', price: 500, cost_price: 300, unit: 'kg', stock_qty: 300, farm: 'Test', category: 'legumes', product_type: 'conventionnel', origin_country: 'DJ', region: 'Test', status: 'published', is_local: false, in_stock: true, description: 'TEST MODIFQTÉ — à supprimer', bg_color: '#ecf4d5' }).select('id').single();
  if (pe) throw pe;
  state.products.push(P.id);
  const stockOf = async () => Number((await admin.from('products').select('stock_qty').eq('id', P.id).single()).data.stock_qty);
  const [A, B] = [await mkUser('a'), await mkUser('b')];
  const walletOf = async (uid) => Number((await admin.from('wallets').select('balance').eq('user_id', uid).maybeSingle()).data?.balance) || 0;

  const order = (u, qty, o = {}) => api('/api/orders', u.token, {
    order: { user_id: u.id, payment_method: 'cash', customer_name: 'Test ModifQté', phone: u.phone, address: 'Test', ...DEL.fields, delivery_fee: 0, total: 1, ...o },
    items: [{ product_id: P.id, quantity: qty, price: 1, product_name: 'TEST ModifQté produit', product_unit: 'kg' }],
  });
  const itemOf = async (oid) => (await admin.from('order_items').select('id, quantity').eq('order_id', oid).single()).data;
  const edit = (oid, itemId, qty, reason, token = adminToken) => api('/api/admin/orders/remove-item', token, { order_id: oid, item_id: itemId, new_quantity: qty, reason });
  const deliver = (oid) => api('/api/orders', adminToken, { id: oid, status: 'delivered' }, 'PATCH');
  const rowOf = async (oid) => (await admin.from('orders').select('total, status').eq('id', oid).single()).data;
  const journalOf = async (oid) => (await admin.from('order_edits').select('*').eq('order_id', oid).order('id')).data || [];
  const lastNotif = async (uid) => (await admin.from('user_notifications').select('title, body').eq('user_id', uid).order('created_at', { ascending: false }).limit(1)).data?.[0];

  console.log('\n1) Commande livrée, payée par cagnotte : réduction avec garde-fous');
  await admin.rpc('wallet_adjust', { p_user: A.id, p_amount: 10000, p_type: 'deposit', p_order: null, p_note: 'TEST dépôt' });
  let r = await order(A, 4, { payment_method: 'wallet' });     // 4 × 500 = 2 000 + livraison
  const o1 = r.j.order.id;
  ok(r.status === 200 && (await stockOf()) === 296, 'commande de 4 kg créée, stock 300 → 296', `${r.status} ${await stockOf()}`);
  await deliver(o1);
  ok((await admin.from('loyalty_stamps').select('id').eq('order_id', o1)).data.length === 1, 'commande livrée : tampon de fidélité posé (2 000 ≥ 1 000)');
  const it1 = await itemOf(o1);
  r = await edit(o1, it1.id, 1, '');
  ok(r.status === 400 && r.j.error === 'reason_required', 'commande livrée sans motif : refus', JSON.stringify(r.j));
  const balBefore = await walletOf(A.id);
  r = await edit(o1, it1.id, 1, 'Le client n\'a pris que 1 kg à la livraison');
  ok(r.status === 200 && r.j.newQty === 1 && r.j.refundAmount === 1500, 'livrée + motif : 4 → 1 kg accepté', JSON.stringify(r.j));
  ok((await stockOf()) === 299 && Number((await rowOf(o1)).total) === 500 + F, 'stock rendu (296 → 299), total recalculé (500 + livraison)', `${await stockOf()} / ${(await rowOf(o1)).total}`);
  ok(await walletOf(A.id) === balBefore + 1500, '1 500 Fdj recrédités sur la cagnotte', String(await walletOf(A.id)));
  ok((await admin.from('loyalty_stamps').select('id').eq('order_id', o1)).data.length === 0, 'articles passés sous la commande minimale : tampon retiré');
  let jr = await journalOf(o1);
  ok(jr.length === 1 && jr[0].from_qty == 4 && jr[0].to_qty == 1 && jr[0].amount === -1500 && jr[0].by_role === 'admin' && jr[0].order_status === 'delivered' && /1 kg à la livraison/.test(jr[0].reason), 'journal : qui, quoi, statut, motif', JSON.stringify(jr[0]));

  console.log('\n2) Augmentation');
  r = await order(B, 2);                                        // espèces, en attente
  const o2 = r.j.order.id;
  const it2 = await itemOf(o2);
  r = await edit(o2, it2.id, 2);
  ok(r.status === 400 && r.j.error === 'no_change', 'même quantité : refus');
  r = await edit(o2, it2.id, 5);                                // +3, sans motif (commande en attente)
  ok(r.status === 200 && r.j.refundAmount === -1500, 'en attente : 2 → 5 kg sans motif, complément 1 500', JSON.stringify(r.j));
  ok((await stockOf()) === 294 && Number((await rowOf(o2)).total) === 2500 + F, 'stock réservé (297 → 294), total 2 500 + livraison', `${await stockOf()} / ${(await rowOf(o2)).total}`);
  const sBefore = await stockOf();
  r = await edit(o2, it2.id, 5 + sBefore + 1);
  ok(r.status === 409 && r.j.error === 'stock_insufficient' && r.j.available === 5 + sBefore, 'au-delà du stock : refus avec le maximum possible', JSON.stringify(r.j));
  ok((await stockOf()) === sBefore, 'rien réservé par le refus');
  await sleep(600);
  let nt = await lastNotif(B.id);
  ok(nt && /porté à 5|modifiée/.test(nt.body + nt.title) && /1.500/.test(nt.body.replace(/ | /g, '.')), 'client prévenu de l\'augmentation', JSON.stringify(nt));
  await deliver(o2);
  r = await edit(o2, it2.id, 6, '');
  ok(r.status === 400 && r.j.error === 'reason_required', 'augmentation sur commande livrée sans motif : refus');
  r = await edit(o2, it2.id, 6, 'Finalement il prend 6');
  ok(r.status === 200 && Number((await rowOf(o2)).total) === 3000 + F, 'livrée + motif : 5 → 6 kg', JSON.stringify(r.j));

  console.log('\n3) Augmentation et moyens de paiement');
  r = await order(A, 2, { payment_method: 'wallet' });          // cagnotte A : reste 10000-2000-F+1500 = selon F
  const o3 = r.j.order.id;
  const it3 = await itemOf(o3);
  const bal3 = await walletOf(A.id);
  r = await edit(o3, it3.id, 3);
  ok(r.status === 200 && await walletOf(A.id) === bal3 - 500, 'cagnotte : complément de 500 débité', `${bal3} → ${await walletOf(A.id)}`);
  r = await edit(o3, it3.id, 3 + Math.ceil((await walletOf(A.id)) / 500) + 1);
  ok(r.status === 409 && r.j.error === 'wallet_insufficient', 'cagnotte insuffisante : refus', JSON.stringify(r.j));
  // Crédit : la charge du carnet suit l'augmentation
  r = await api('/api/admin/credit', adminToken, { action: 'create', holder_type: 'user', email: B.email, credit_limit: 3000 });
  const acc = (r.j.accounts || []).find(a => a.account.user_id === B.id);
  if (acc) state.accounts.push(acc.account.id);
  r = await order(B, 2, { payment_method: 'credit' });
  const o4 = r.j.order.id;
  const it4 = await itemOf(o4);
  const chargeOf = async () => Number((await admin.from('credit_entries').select('amount').eq('order_id', o4).eq('type', 'charge').single()).data.amount);
  const charge0 = await chargeOf();
  r = await edit(o4, it4.id, 3);
  ok(r.status === 200 && await chargeOf() === charge0 + 500, 'crédit : charge du carnet augmentée de 500', `${charge0} → ${await chargeOf()}`);
  r = await edit(o4, it4.id, 20);
  ok(r.status === 409 && r.j.error === 'credit_unavailable', 'au-delà du plafond de crédit : refus', JSON.stringify(r.j));

  console.log('\n4) Garde-fous restants');
  r = await order(B, 1);
  const o5 = r.j.order.id;
  await api('/api/orders', adminToken, { id: o5, status: 'cancelled' }, 'PATCH');
  const it5 = (await admin.from('order_items').select('id').eq('order_id', o5).single()).data;
  r = await edit(o5, it5.id, 2, 'x');
  ok(r.status === 409 && r.j.error === 'order_cancelled', 'commande annulée : intouchable', JSON.stringify(r.j));
  r = await api('/api/admin/orders/edits', adminToken);
  const mine = (r.j.edits || []).filter(e => /TEST ModifQté/.test(e.product_name || ''));
  ok(r.status === 200 && mine.length >= 5 && mine.every(e => e.by_name && e.order_status), 'journal global admin : toutes les modifications tracées', String(mine.length));
  ok(mine.some(e => e.orders?.customer_name === 'Test ModifQté'), 'journal : client de la commande visible');
  r = await api('/api/admin/orders/edits', A.token);
  ok(r.status === 401 || r.status === 403, 'un client ne voit pas le journal global', String(r.status));
  r = await api('/api/admin/orders/remove-item', A.token, { order_id: o2, item_id: it2.id, new_quantity: 1, reason: 'pirate' });
  ok(r.status === 401 || r.status === 403, 'un client ne modifie pas les quantités', String(r.status));
  // La liste admin des commandes embarque le journal
  r = await api('/api/orders', adminToken);
  const listed = (r.j.orders || []).find(o => o.id === o1);
  ok(listed && Array.isArray(listed.order_edits) && listed.order_edits.length === 1, 'liste des commandes : journal par commande présent', JSON.stringify(listed?.order_edits?.length));
} catch (e) {
  fail++; console.error('\n💥 Erreur inattendue :', e);
} finally {
  console.log('\nNettoyage…');
  try {
    if (state.minOrder === undefined) await admin.from('app_settings').delete().eq('key', 'loyalty.min_order');
    else await admin.from('app_settings').upsert({ key: 'loyalty.min_order', value_num: state.minOrder, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    const { data: its } = state.products.length ? await admin.from('order_items').select('order_id').in('product_id', state.products) : { data: [] };
    const oids = [...new Set([...(its || []).map(i => i.order_id), ...state.orders])];
    if (state.accounts.length) await admin.from('credit_accounts').delete().in('id', state.accounts);
    if (oids.length) {
      await admin.from('order_refunds').delete().in('order_id', oids);
      await admin.from('loyalty_stamps').delete().in('order_id', oids);
      await admin.from('order_items').delete().in('order_id', oids);
      await admin.from('orders').delete().in('id', oids);   // order_edits suivent (cascade)
    }
    if (state.products.length) await admin.from('products').delete().in('id', state.products);
    for (const id of state.users) {
      for (const t of ['wallet_transactions', 'wallets', 'user_notifications', 'loyalty_stamps', 'referral_codes', 'profiles']) await admin.from(t).delete().eq(t === 'profiles' ? 'id' : 'user_id', id);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) ok(false, 'compte temporaire supprimé', error.message);
    }
    if (state.preparers.length) await admin.from('preparers').update({ is_active: true }).in('id', state.preparers);
    const leftP = (await admin.from('products').select('id', { count: 'exact', head: true }).ilike('name', 'TEST ModifQté%')).count;
    const leftO = (await admin.from('orders').select('id', { count: 'exact', head: true }).eq('customer_name', 'Test ModifQté')).count;
    ok(leftP === 0 && leftO === 0, 'produit et commandes de test supprimés', `${leftP}/${leftO}`);
  } catch (e) { fail++; console.error('Nettoyage incomplet :', e); }
  console.log(`\n${pass} réussis, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
}
