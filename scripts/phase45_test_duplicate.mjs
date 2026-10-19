// Test non destructif de la création de commande par copie (phase 45, mode « pour le compte de »),
// y compris articles ajoutés hors commande d'origine, code promo (limites sur le client) et remise.
// Serveur local requis (port 3000). Migration phase45_duplicate.sql requise (created_by, copied_from).
// Comptes, produit, commandes et carnet temporaires supprimés ; préparateurs désactivés pendant le test.
//   node scripts/phase45_test_duplicate.mjs
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
const mkUser = async (name, meta = {}) => {
  const email = `test-dup-${name}-${stamp}@example.com`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: `Tmp-${stamp}!${name}`, email_confirm: true, user_metadata: { full_name: `Test Copie ${name}`, ...meta } });
  if (error) throw error;
  state.users.push(u.user.id);
  return { id: u.user.id, email, token: await tokenFor(email), phone: `77${String(stamp).slice(-5)}${n++}` };
};

try {
  const { data: preps } = await admin.from('preparers').select('id').eq('is_active', true);
  state.preparers = (preps || []).map(p => p.id);
  if (state.preparers.length) await admin.from('preparers').update({ is_active: false }).in('id', state.preparers);

  const DEL = await cheapestDelivery(admin);
  const { data: P, error: pe } = await admin.from('products').insert({ name: 'TEST Copie produit', price: 500, cost_price: 300, unit: 'kg', stock_qty: 50, farm: 'Test', category: 'legumes', product_type: 'conventionnel', origin_country: 'DJ', region: 'Test', status: 'published', is_local: false, in_stock: true, description: 'TEST COPIE — à supprimer', bg_color: '#ecf4d5' }).select('id').single();
  if (pe) throw pe;
  state.products.push(P.id);
  const stockOf = async () => Number((await admin.from('products').select('stock_qty').eq('id', P.id).single()).data.stock_qty);

  const C = await mkUser('client');                                         // le client
  const M = await mkUser('manager', { role: 'manager', permissions: { orders: ['view', 'edit'] } }); // gestionnaire
  const X = await mkUser('intrus');                                          // simple client, sans droits

  // ── Commande d'origine passée PAR le client (circuit normal) ─────────────
  console.log('\n— Commande d\'origine (client) —');
  let r = await api('/api/orders', C.token, {
    order: { user_id: C.id, payment_method: 'cash', customer_name: 'Eleyeh Test', phone: C.phone, address: 'Quartier Test', ...DEL.fields, delivery_fee: 0, total: 1 },
    items: [{ product_id: P.id, quantity: 4, price: 1, product_name: 'TEST Copie produit', product_unit: 'kg' }],
  });
  ok(r.status === 200 && r.j.order?.id, 'commande d\'origine créée', JSON.stringify(r.j).slice(0, 120));
  const src = r.j.order;
  ok(src.created_by == null && src.copied_from == null, 'commande normale : sans created_by/copied_from');

  // ── Garde-fous ───────────────────────────────────────────────────────────
  console.log('\n— Garde-fous —');
  const dupBody = (over = {}, items = [{ product_id: P.id, quantity: 2, price: 1, product_name: 'TEST Copie produit', product_unit: 'kg' }]) => ({
    on_behalf: true, copied_from: Number(src.id), items,
    order: { user_id: C.id, payment_method: 'cash', customer_name: 'Eleyeh Test', phone: C.phone, address: 'Quartier Test', ...DEL.fields, ...over },
  });
  r = await api('/api/orders', X.token, dupBody());
  ok(r.status === 403, 'copie refusée sans droit commandes/edit', `${r.status} ${JSON.stringify(r.j).slice(0, 80)}`);
  r = await api('/api/orders', C.token, { ...dupBody(), on_behalf: false, order: { ...dupBody().order, user_id: M.id } });
  ok(r.status === 401 && r.j.error === 'identity_mismatch', 'hors copie : identité toujours verrouillée');
  r = await api('/api/orders', M.token, { ...dupBody(), promo_code: 'CODEINTROUVABLE99' });
  ok(r.status === 409 && r.j.error === 'promo_invalid', 'copie : code promo inconnu rejeté proprement', r.status + ' ' + JSON.stringify(r.j).slice(0, 60));
  r = await api('/api/orders', M.token, dupBody({ user_id: null, payment_method: 'credit' }));
  ok(r.status === 400 && r.j.error === 'credit_requires_account', 'copie : carnet sans compte refusé');

  // ── Copie par le gestionnaire : espèces ──────────────────────────────────
  console.log('\n— Copie (espèces) —');
  const s0 = await stockOf();
  r = await api('/api/orders', M.token, dupBody({}, [{ product_id: P.id, quantity: 3, price: 1, product_name: 'TEST Copie produit', product_unit: 'kg' }]));
  ok(r.status === 200 && r.j.order?.id, 'copie créée par le gestionnaire', JSON.stringify(r.j).slice(0, 140));
  const dup = r.j.order || {};
  ok(dup.user_id === C.id, 'commande au nom du CLIENT (user_id)');
  ok(dup.created_by === M.id, 'created_by = gestionnaire');
  ok(Number(dup.copied_from) === Number(src.id), 'copied_from = commande d\'origine');
  ok(await stockOf() === s0 - 3, 'stock décrémenté de la copie');
  const { data: lines } = await admin.from('order_items').select('price, quantity').eq('order_id', dup.id);
  ok(lines?.length === 1 && Number(lines[0].price) === 500, 'prix serveur imposé (500, pas 1)', JSON.stringify(lines));
  ok(Number(dup.total) === 3 * 500 + Number(dup.delivery_fee), 'total = articles + livraison calculée');

  // Visible dans la liste admin avec ses champs de traçabilité
  r = await api('/api/orders', M.token);
  const inList = (r.j.orders || []).find(o => String(o.id) === String(dup.id));
  ok(!!inList && Number(inList.copied_from) === Number(src.id) && inList.created_by === M.id, 'GET admin : copied_from/created_by exposés');

  // ── Copie payée par la cagnotte du CLIENT ────────────────────────────────
  console.log('\n— Copie (cagnotte du client) —');
  r = await api('/api/orders', M.token, dupBody({ payment_method: 'wallet' }));
  ok(r.status === 400 && r.j.error === 'wallet_insufficient', 'cagnotte vide : refus propre');
  await admin.rpc('wallet_adjust', { p_user: C.id, p_amount: 5000, p_type: 'credit', p_order: null, p_note: 'TEST copie' });
  r = await api('/api/orders', M.token, dupBody({ payment_method: 'wallet' }));
  const wOrder = r.j.order || {};
  const wBal = Number((await admin.from('wallets').select('balance').eq('user_id', C.id).maybeSingle()).data?.balance) || 0;
  ok(r.status === 200 && wBal === 5000 - Number(wOrder.total), 'cagnotte du CLIENT débitée', `solde ${wBal}, total ${wOrder.total}`);

  // ── Copie sur le carnet (crédit) du CLIENT ───────────────────────────────
  console.log('\n— Copie (carnet du client) —');
  const { data: acct } = await admin.from('credit_accounts').insert({ holder_type: 'user', user_id: C.id, credit_limit: 50000, term: 'month_end', status: 'active' }).select('id').single();
  state.accounts.push(acct.id);
  r = await api('/api/orders', M.token, dupBody({ payment_method: 'credit' }));
  ok(r.status === 200 && r.j.order?.id, 'copie sur carnet acceptée', JSON.stringify(r.j).slice(0, 120));
  const { data: entries } = await admin.from('credit_entries').select('account_id, amount, order_id').eq('order_id', r.j.order?.id ?? -1);
  ok(entries?.length === 1 && entries[0].account_id === acct.id, 'dette inscrite sur le carnet du CLIENT (pas du gestionnaire)', JSON.stringify(entries));

  // ── Article ajouté hors commande d'origine ───────────────────────────────
  console.log("\n— Article ajouté (hors commande d'origine) —");
  const { data: P2 } = await admin.from('products').insert({ name: 'TEST Copie produit 2', price: 200, cost_price: 100, unit: 'botte', stock_qty: 30, farm: 'Test', category: 'legumes', product_type: 'conventionnel', origin_country: 'DJ', region: 'Test', status: 'published', is_local: false, in_stock: true, description: 'TEST COPIE 2 — à supprimer', bg_color: '#ecf4d5' }).select('id').single();
  state.products.push(P2.id);
  r = await api('/api/orders', M.token, dupBody({}, [
    { product_id: P.id, quantity: 2, price: 1, product_name: 'TEST Copie produit', product_unit: 'kg' },
    { product_id: P2.id, quantity: 3, price: 1, product_name: 'TEST Copie produit 2', product_unit: 'botte' },
  ]));
  ok(r.status === 200 && r.j.order?.id, 'copie avec article ajouté acceptée', JSON.stringify(r.j).slice(0, 120));
  const { data: mixLines } = await admin.from('order_items').select('product_id, price').eq('order_id', r.j.order?.id ?? -1).order('product_id');
  ok(mixLines?.length === 2 && Number(mixLines.find(l => l.product_id === P2.id)?.price) === 200, 'deux lignes, prix serveur du nouvel article', JSON.stringify(mixLines));

  // ── Code promo appliqué pour le client ───────────────────────────────────
  console.log('\n— Code promo (livraison offerte) —');
  const CODE = `T45L${String(stamp).slice(-6)}`;
  const adminToken = await tokenFor('wilsandj@hotmail.com');
  r = await api('/api/admin/promo-codes', adminToken, { action: 'save', code: CODE, max_uses_per_user: 1 });
  ok(r.status === 200, 'code promo de test créé', JSON.stringify(r.j).slice(0, 80));
  r = await api('/api/orders', M.token, { ...dupBody(), promo_code: CODE });
  const pOrder = r.j.order || {};
  ok(r.status === 200 && Number(pOrder.delivery_fee) === 0 && pOrder.delivery_discount_source === 'promo', 'copie : livraison offerte par le code', JSON.stringify({ fee: pOrder.delivery_fee, src: pOrder.delivery_discount_source }));
  const { data: reds } = await admin.from('promo_redemptions').select('user_id, order_id').eq('order_id', pOrder.id ?? -1);
  ok(reds?.length === 1 && reds[0].user_id === C.id, 'utilisation comptée sur le CLIENT (pas le gestionnaire)', JSON.stringify(reds));
  r = await api('/api/orders', M.token, { ...dupBody(), promo_code: CODE });
  ok(r.status === 409 && r.j.error === 'promo_invalid', 'limite par client respectée (2e usage refusé)');
  r = await api('/api/orders', M.token, { ...dupBody(), ref_code: CODE });
  ok(r.status === 400 && r.j.error === 'on_behalf_unsupported', 'parrainage toujours refusé en copie');

  // ── Remise globale juste après création (outil remise existant) ──────────
  console.log('\n— Remise accordée à la création —');
  r = await api('/api/admin/orders/discount', M.token, { order_id: pOrder.id, mode: 'global', amount: 150, note: 'Geste copie test' });
  ok(r.status === 200, 'remise globale appliquée par le gestionnaire', JSON.stringify(r.j).slice(0, 80));
  const { data: discRow } = await admin.from('orders').select('admin_discount, discount_history').eq('id', pOrder.id).single();
  ok(Number(discRow?.admin_discount) === 150 && (discRow?.discount_history || []).some(h => h.note === 'Geste copie test'), 'remise historisée sur la commande', JSON.stringify(discRow).slice(0, 120));

  // ── Stock replafonné proprement ──────────────────────────────────────────
  console.log('\n— Stock insuffisant —');
  r = await api('/api/orders', M.token, dupBody({}, [{ product_id: P.id, quantity: 500, price: 1, product_name: 'TEST Copie produit', product_unit: 'kg' }]));
  ok(r.status === 400 && r.j.error === 'stock_insufficient' && Array.isArray(r.j.items), 'quantité excessive : stock_insufficient + détail');
} catch (e) {
  fail++; console.error('  ❌ exception', e);
} finally {
  console.log('\n— Nettoyage —');
  for (const id of state.orders) { await admin.from('credit_entries').delete().eq('order_id', id); await admin.from('order_items').delete().eq('order_id', id); await admin.from('orders').delete().eq('id', id); }
  for (const id of state.accounts) { await admin.from('credit_entries').delete().eq('account_id', id); await admin.from('credit_accounts').delete().eq('id', id); }
  const { data: tcodes } = await admin.from('promo_codes').select('id').like('code', 'T45L%');
  if (tcodes?.length) { await admin.from('promo_redemptions').delete().in('promo_id', tcodes.map(c => c.id)); await admin.from('promo_codes').delete().in('id', tcodes.map(c => c.id)); }
  for (const id of state.products) await admin.from('products').delete().eq('id', id);
  for (const id of state.users) { await admin.from('wallet_transactions').delete().eq('user_id', id); await admin.from('wallets').delete().eq('user_id', id); await admin.from('profiles').delete().eq('id', id); await admin.auth.admin.deleteUser(id); }
  if (state.preparers.length) await admin.from('preparers').update({ is_active: true }).in('id', state.preparers);
  console.log(`\nRésultat : ${pass} ✅ / ${fail} ❌`);
  process.exit(fail ? 1 : 0);
}
