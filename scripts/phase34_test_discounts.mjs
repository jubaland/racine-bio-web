// Test non destructif des codes promo en pourcentage / montant et des remises accordées par l'admin
// (phase 34). Serveur local requis (port 3000). Comptes, produit, codes (préfixe T34) et commandes
// temporaires, supprimés à la fin. Préparateurs désactivés pendant le test.
//   node scripts/phase34_test_discounts.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { computePromoItems } from '../lib/delivery-pricing.ts';
import { orderTotals } from '../lib/order-totals.ts';
import { cheapestDelivery } from './test_helpers.mjs';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const BASE = process.argv[2] || 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label} ${extra}`); } };
const stamp = Date.now();
const tag = String(stamp).slice(-6);
const state = { users: [], products: [], orders: [], preparers: [] };
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
  const email = `test-remise-${name}-${stamp}@example.com`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: `Tmp-${stamp}!${name}`, email_confirm: true, user_metadata: { full_name: `Test Remise ${name}` } });
  if (error) throw error;
  state.users.push(u.user.id);
  return { id: u.user.id, email, token: await tokenFor(email), phone: `77${String(stamp).slice(-5)}${n++}` };
};

try {
  console.log('\n1) Calculs (fonctions partagées)');
  const P10 = { code: 'X', kind: 'percent', scope: 'standard', max_discount: 300, min_subtotal: null, value: 10, products_scope: 'all' };
  ok(computePromoItems({ promo: P10, subtotal: 2000 }).discount === 200, '10 % de 2 000 = 200');
  ok(computePromoItems({ promo: P10, subtotal: 5000 }).discount === 300, '10 % de 5 000 plafonné à 300');
  ok(computePromoItems({ promo: { ...P10, min_subtotal: 3000 }, subtotal: 2000 }).missing === 1000, 'panier minimum : 1 000 manquants');
  ok(computePromoItems({ promo: { ...P10, products_scope: 'hornafresh', eligible_subtotal: 800 }, subtotal: 2000 }).discount === 80, 'pourcentage sur les seuls articles concernés (800)');
  ok(computePromoItems({ promo: { ...P10, kind: 'amount', value: 700, max_discount: null }, subtotal: 2000 }).discount === 700, 'montant fixe 700');
  ok(computePromoItems({ promo: { ...P10, kind: 'amount', value: 7000, max_discount: null }, subtotal: 2000 }).discount === 2000, 'montant fixe plafonné aux articles');
  ok(computePromoItems({ promo: { ...P10, kind: 'free_delivery' }, subtotal: 2000 }).discount === 0, 'un code livraison ne touche pas les articles');
  let tt = orderTotals({ items: [{ price: 300, quantity: 10, discount: 300 }, { price: 100, quantity: 2 }], promo_discount: 200, admin_discount: 150, delivery_fee: 500 });
  ok(tt.items_sum === 3200 && tt.discounts === 650 && tt.goods === 2550 && tt.total === 3050, 'totaux : articles 3 200, remises 650, total 3 050', JSON.stringify(tt));
  tt = orderTotals({ items: [{ price: 100, quantity: 1 }], promo_discount: 500, admin_discount: 500, delivery_fee: 500 });
  ok(tt.goods === 0 && tt.total === 500, 'les remises ne dépassent jamais les articles ; la livraison reste due');

  // ── Préparation ──────────────────────────────────────────────────────────────────
  const { data: preps } = await admin.from('preparers').select('id').eq('is_active', true);
  state.preparers = (preps || []).map(p => p.id);
  if (state.preparers.length) await admin.from('preparers').update({ is_active: false }).in('id', state.preparers);
  const DEL = await cheapestDelivery(admin);
  const F = DEL.price;
  const adminToken = await tokenFor('wilsandj@hotmail.com');
  const { data: P, error: pe } = await admin.from('products').insert({ name: 'TEST Remise produit', price: 1000, cost_price: 600, unit: 'kg', stock_qty: 300, farm: 'Test', category: 'legumes', product_type: 'conventionnel', origin_country: 'DJ', region: 'Test', status: 'published', is_local: false, in_stock: true, description: 'TEST REMISE — à supprimer', bg_color: '#ecf4d5' }).select('id').single();
  if (pe) throw pe;
  state.products.push(P.id);
  const [A, B, C] = [await mkUser('a'), await mkUser('b'), await mkUser('c')];
  const order = (u, extra = {}, qty = 1, o = {}) => api('/api/orders', u.token, {
    order: { user_id: u.id, payment_method: 'cash', customer_name: 'Test Remise', phone: u.phone, address: 'Test', ...DEL.fields, delivery_fee: 0, total: 1, ...o },
    items: [{ product_id: P.id, quantity: qty, price: 1, product_name: 'TEST Remise produit', product_unit: 'kg' }],
    ...extra,
  });
  const pc = (body) => api('/api/admin/promo-codes', adminToken, body);
  const disc = (body, token = adminToken) => api('/api/admin/orders/discount', token, body);
  const row = async (id) => (await admin.from('orders').select('*, order_items ( id, price, quantity, discount )').eq('id', id).single()).data;
  const lastNotif = async (uid) => (await admin.from('user_notifications').select('title, body').eq('user_id', uid).order('created_at', { ascending: false }).limit(1)).data?.[0];

  console.log('\n2) Codes en pourcentage / montant (admin)');
  const C1 = `T34P${tag}`, C2 = `T34M${tag}`;
  let r = await pc({ action: 'save', code: C1, kind: 'percent', value: 10 });
  ok(r.status === 400 && r.j.error === 'cap_required', 'pourcentage sans plafond refusé', JSON.stringify(r.j));
  r = await pc({ action: 'save', code: C1, kind: 'percent', value: 150, max_discount: 300 });
  ok(r.status === 400 && r.j.error === 'percent_range', 'pourcentage > 100 refusé');
  r = await pc({ action: 'save', code: C2, kind: 'amount' });
  ok(r.status === 400 && r.j.error === 'value_required', 'montant sans valeur refusé');
  r = await pc({ action: 'save', code: C1, kind: 'percent', value: 10, max_discount: 300, label: 'TEST −10 %' });
  ok(r.status === 200 && (r.j.codes || []).some(c => c.code === C1 && c.kind === 'percent' && c.value === 10), 'code −10 % plafonné à 300 créé', JSON.stringify(r.j).slice(0, 160));
  r = await pc({ action: 'save', code: C2, kind: 'amount', value: 700, products_scope: 'hornafresh' });
  ok(r.status === 200 && (r.j.codes || []).some(c => c.code === C2 && c.kind === 'amount' && c.products_scope === 'hornafresh'), 'code −700 Fdj sur les produits Hornafresh créé');

  console.log('\n3) Au paiement');
  r = await api('/api/promo', A.token, { code: C1, phone: A.phone, items: [{ product_id: P.id, quantity: 5, price: 1000 }] });
  ok(r.j.valid && r.j.promo?.kind === 'percent' && r.j.promo?.eligible_subtotal === 5000, 'vérification : type et montant concerné renvoyés', JSON.stringify(r.j));
  const { data: merchantProd } = await admin.from('products').select('id, price').not('owner_id', 'is', null).limit(1).maybeSingle();
  if (merchantProd) {
    r = await api('/api/promo', A.token, { code: C2, phone: A.phone, items: [{ product_id: P.id, quantity: 2, price: 1000 }, { product_id: merchantProd.id, quantity: 1, price: merchantProd.price }] });
    ok(r.j.valid && r.j.promo?.eligible_subtotal === 2000, 'produits Hornafresh seulement : l\'article marchand est exclu du montant concerné', JSON.stringify(r.j.promo));
  }
  r = await order(A, { promo_code: C1 }, 5);
  ok(r.status === 200 && r.j.order.promo_discount === 300 && r.j.order.promo_code === C1 && Number(r.j.order.total) === 5000 - 300 + F && r.j.order.delivery_fee === F && r.j.order.delivery_discount === 0,
    'commande 5 000 avec −10 % : 300 de remise (plafond), livraison due au tarif normal', JSON.stringify(r.j.order || r.j).slice(0, 220));
  const oA = r.j.order.id;
  let ov = ((await api('/api/admin/promo-codes', adminToken)).j.codes || []).find(c => c.code === C1);
  ok(ov?.uses === 1 && ov?.amount_offered === 300, 'admin : utilisation et montant comptés', JSON.stringify(ov));
  r = await order(B, { promo_code: C2 }, 1);
  ok(r.status === 200 && r.j.order.promo_discount === 700 && Number(r.j.order.total) === 300 + F, 'montant fixe 700 sur 1 000 d\'articles : total 300 + livraison', JSON.stringify(r.j.order || r.j).slice(0, 200));
  const { data: liste } = await admin.from('order_items').select('price').eq('order_id', oA);
  ok(liste.every(it => Number(it.price) === 1000), 'le prix des lignes reste le prix réel (remise à part)');

  console.log('\n4) Remise accordée par l\'admin (marchandage)');
  r = await order(B, {}, 3);
  const oB = r.j.order.id;
  const itB = (await row(oB)).order_items[0];
  r = await disc({ order_id: oB, mode: 'line', item_id: itB.id, new_price: 900 });
  ok(r.status === 400 && r.j.error === 'note_required', 'motif obligatoire');
  r = await disc({ order_id: oB, mode: 'line', item_id: itB.id, new_price: 1000, note: 'x' });
  ok(r.status === 400 && r.j.error === 'price_invalid', 'nouveau prix ≥ prix actuel refusé');
  r = await disc({ order_id: oB, mode: 'line', item_id: itB.id, new_price: 900, note: 'Gros volume, négocié par téléphone' });
  let o = await row(oB);
  ok(r.status === 200 && r.j.total === 2700 + F && Number(o.total) === 2700 + F && o.order_items[0].discount === 300 && Number(o.order_items[0].price) === 1000,
    '1 000 → 900 sur 3 unités : 300 de remise, prix réel conservé, total recalculé', JSON.stringify({ r: r.j, o: { t: o.total, d: o.order_items[0].discount } }));
  ok(Array.isArray(o.discount_history) && o.discount_history.length === 1 && o.discount_history[0].note === 'Gros volume, négocié par téléphone' && o.discount_history[0].to === 900, 'journal : qui, quoi, pourquoi', JSON.stringify(o.discount_history));
  await sleep(800);
  let nt = await lastNotif(B.id);
  const newTotal = (2700 + F).toLocaleString('fr-FR').replace(/ | /g, ' ');
  ok(nt && /Remise/.test(nt.title) && /300/.test(nt.body) && nt.body.replace(/ | /g, ' ').includes(newTotal), 'client prévenu : remise et nouveau total', JSON.stringify(nt));
  r = await disc({ order_id: oB, mode: 'global', amount: 10000, note: 'trop' });
  ok(r.status === 400 && r.j.error === 'amount_too_high', 'remise globale supérieure aux articles refusée');
  r = await disc({ order_id: oB, mode: 'global', amount: 200, note: 'Geste commercial' });
  o = await row(oB);
  ok(r.status === 200 && Number(o.total) === 2500 + F && o.admin_discount === 200 && o.order_items[0].discount === 300, 'remise globale 200 en plus de la remise sur la ligne : total 2 500 + livraison', JSON.stringify({ t: o.total, a: o.admin_discount }));
  r = await disc({ order_id: oB, mode: 'reset' });
  o = await row(oB);
  ok(r.status === 200 && Number(o.total) === 3000 + F && o.admin_discount === 0 && o.order_items[0].discount === 0 && o.discount_history.length === 3, 'remises annulées : total initial, journal conservé', JSON.stringify({ t: o.total, h: o.discount_history.length }));
  await sleep(800);
  nt = await lastNotif(B.id);
  ok(nt && /mise à jour/.test(nt.title), 'client prévenu du retrait de la remise', JSON.stringify(nt));

  console.log('\n5) Commande prépayée (cagnotte) : différence recréditée');
  await admin.rpc('wallet_adjust', { p_user: C.id, p_amount: 10000, p_type: 'deposit', p_order: null, p_note: 'TEST dépôt' });
  const bal = async () => Number((await admin.from('wallets').select('balance').eq('user_id', C.id).maybeSingle()).data?.balance) || 0;
  r = await order(C, {}, 2, { payment_method: 'wallet' });
  const oC = r.j.order?.id;
  ok(r.status === 200 && await bal() === 10000 - (2000 + F), 'commande de 2 000 + livraison payée par la cagnotte', `${r.status} ${await bal()}`);
  const itC = (await row(oC)).order_items[0];
  r = await disc({ order_id: oC, mode: 'line', item_id: itC.id, new_price: 800, note: 'Négocié' });
  ok(r.status === 200 && r.j.refund === 'wallet' && await bal() === 10000 - (2000 + F) + 400, '1 000 → 800 × 2 : 400 recrédités sur la cagnotte', `${JSON.stringify(r.j)} ${await bal()}`);
  const { data: tx } = await admin.from('wallet_transactions').select('type, amount').eq('user_id', C.id).eq('type', 'refund');
  ok((tx || []).some(t => Number(t.amount) === 400), 'transaction de remboursement tracée', JSON.stringify(tx));
  r = await disc({ order_id: oC, mode: 'reset' });
  ok(r.status === 409 && r.j.error === 'prepaid_increase', 'prépayé : impossible de retirer la remise (il faudrait re-débiter)');

  console.log('\n6) Modification d\'une ligne remisée, annulation, droits');
  r = await api('/api/admin/orders/remove-item', adminToken, { order_id: oC, item_id: itC.id, new_quantity: 1 });
  o = await row(oC);
  ok(r.status === 200 && Number(o.total) === 800 + F && o.order_items[0].discount === 200 && await bal() === 10000 - (800 + F), 'quantité 2 → 1 : remise au prorata, remboursement au prix net (800)', JSON.stringify({ s: r.status, t: o.total, d: o.order_items[0].discount, b: await bal() }));
  r = await api('/api/orders', adminToken, { id: oA, status: 'cancelled' }, 'PATCH');
  r = await disc({ order_id: oA, mode: 'global', amount: 100, note: 'x' });
  ok(r.status === 409 && r.j.error === 'order_cancelled', 'pas de remise sur une commande annulée');
  r = await disc({ order_id: oB, mode: 'global', amount: 100, note: 'pirate' }, B.token);
  ok(r.status === 401 || r.status === 403, 'un client n\'accorde pas de remise', String(r.status));
  r = await api('/api/orders', adminToken);
  const listed = (r.j.orders || []).find(x => x.id === oC);
  ok(listed && listed.order_items?.[0]?.discount === 200 && Array.isArray(listed.discount_history), 'liste admin : remise de ligne et journal présents', JSON.stringify(listed?.order_items?.[0]));
  r = await api('/api/admin/finances?period=7d', adminToken);
  ok(r.status === 200 && 'discountsTotal' in (r.j.kpis || {}), 'Finances : indicateur « remises accordées » présent', JSON.stringify(Object.keys(r.j.kpis || {})).slice(0, 120));
} catch (e) {
  fail++; console.error('\n💥 Erreur inattendue :', e);
} finally {
  console.log('\nNettoyage…');
  try {
    const { data: its } = state.products.length ? await admin.from('order_items').select('order_id').in('product_id', state.products) : { data: [] };
    const oids = [...new Set([...(its || []).map(i => i.order_id), ...state.orders])];
    if (oids.length) {
      await admin.from('order_refunds').delete().in('order_id', oids);
      await admin.from('loyalty_stamps').delete().in('order_id', oids);
      await admin.from('order_items').delete().in('order_id', oids);
      await admin.from('orders').delete().in('id', oids);
    }
    const { data: tcodes } = await admin.from('promo_codes').select('id').like('code', `T34%${tag}`);
    if (tcodes?.length) {
      await admin.from('promo_redemptions').delete().in('promo_id', tcodes.map(c => c.id));
      await admin.from('promo_codes').delete().in('id', tcodes.map(c => c.id));
    }
    if (state.products.length) await admin.from('products').delete().in('id', state.products);
    for (const id of state.users) {
      for (const t of ['wallet_transactions', 'wallets', 'user_notifications', 'loyalty_stamps', 'referral_codes', 'profiles']) await admin.from(t).delete().eq(t === 'profiles' ? 'id' : 'user_id', id);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) ok(false, 'compte temporaire supprimé', error.message);
    }
    if (state.preparers.length) await admin.from('preparers').update({ is_active: true }).in('id', state.preparers);
    const leftP = (await admin.from('products').select('id', { count: 'exact', head: true }).ilike('name', 'TEST Remise%')).count;
    const leftC = (await admin.from('promo_codes').select('id', { count: 'exact', head: true }).like('code', `T34%${tag}`)).count;
    const leftO = (await admin.from('orders').select('id', { count: 'exact', head: true }).eq('customer_name', 'Test Remise')).count;
    ok(leftP === 0 && leftC === 0 && leftO === 0, 'produit, codes et commandes de test supprimés', `${leftP}/${leftC}/${leftO}`);
  } catch (e) { fail++; console.error('Nettoyage incomplet :', e); }
  console.log(`\n${pass} réussis, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
}
