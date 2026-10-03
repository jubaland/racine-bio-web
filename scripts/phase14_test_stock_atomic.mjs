// Test non destructif du stock atomique (phase 14). Serveur local requis (npm run dev, port 3000).
// Vérifie qu'on ne peut plus survendre : commandes simultanées sur un stock limité (produit simple
// puis panier composé), tout-ou-rien d'une commande multi-articles, remise en stock. Nettoyage final.
//   node scripts/phase14_test_stock_atomic.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { cheapestDelivery } from './test_helpers.mjs';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// Frais de livraison calculés par le serveur : chaque commande de test désigne une option réelle
const DEL = await cheapestDelivery(admin);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const BASE = 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label} ${extra}`); } };
const stockOf = async (id) => Number((await admin.from('products').select('stock_qty').eq('id', id).single()).data.stock_qty);
const state = { products: [], bundle: null, orders: [], preparers: [] };

const body = (lines) => ({
  order: { user_id: null, total: lines.reduce((s, l) => s + l.price * l.qty, 0), ...DEL.fields, special_instructions: 'TEST STOCK ATOMIQUE', status: 'pending', payment_method: 'cash', phone: '77000000', email: null, address: 'Test', customer_name: 'Test Stock' },
  items: lines.map(l => ({ product_id: l.id, quantity: l.qty, price: l.price, product_name: l.name, product_unit: l.unit })),
});
const post = async (lines) => { const r = await fetch(`${BASE}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body(lines)) }); const j = await r.json(); if (j.order?.id) state.orders.push(j.order.id); return { status: r.status, j }; };

try {
  const { data: preps } = await admin.from('preparers').select('id').eq('is_active', true);
  state.preparers = (preps || []).map(p => p.id);
  if (state.preparers.length) await admin.from('preparers').update({ is_active: false }).in('id', state.preparers);

  const base = { farm: 'Test Stock', category: 'legumes', product_type: 'conventionnel', origin_country: 'DJ', region: 'Test', status: 'published', is_local: false, in_stock: true, description: 'TEST STOCK ATOMIQUE — à supprimer', bg_color: '#ecf4d5' };
  const { data: A } = await admin.from('products').insert({ ...base, name: 'TEST Atomique A', price: 100, cost_price: 50, unit: 'kg', stock_qty: 3 }).select('id').single();
  const { data: B } = await admin.from('products').insert({ ...base, name: 'TEST Atomique B', price: 100, cost_price: 50, unit: 'kg', stock_qty: 10 }).select('id').single();
  state.products = [A.id, B.id];
  const a = (qty) => ({ id: A.id, qty, price: 100, name: 'TEST Atomique A', unit: 'kg' });
  const b = (qty) => ({ id: B.id, qty, price: 100, name: 'TEST Atomique B', unit: 'kg' });

  console.log('\n1) Fonction SQL : réservée au serveur');
  { const { error } = await anon.rpc('stock_apply', { p_lines: [{ product_id: A.id, delta: -1 }], p_strict: true }); ok(!!error, 'appel anonyme refusé', error?.message); }
  ok(await stockOf(A.id) === 3, 'stock inchangé après la tentative anonyme');

  console.log('\n2) 6 commandes simultanées de 1 kg sur un stock de 3 kg');
  const r = await Promise.all(Array.from({ length: 6 }, () => post([a(1)])));
  const won = r.filter(x => x.status === 200).length, lost = r.filter(x => x.status === 400 && x.j.error === 'stock_insufficient').length;
  ok(won === 3 && lost === 3, `exactement 3 acceptées, 3 refusées (obtenu ${won} / ${lost})`, JSON.stringify(r.map(x => x.status)));
  ok(await stockOf(A.id) === 0, 'stock final = 0, aucune survente', String(await stockOf(A.id)));
  const { count } = await admin.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', A.id);
  ok(count === 3, '3 lignes de commande seulement', String(count));

  console.log('\n3) Commande multi-articles : tout ou rien');
  const r3 = await post([b(2), a(1)]);      // A est à 0 → toute la commande est refusée
  ok(r3.status === 400 && r3.j.error === 'stock_insufficient' && r3.j.items?.some(i => i.product_id === A.id), 'commande refusée, article manquant désigné', JSON.stringify(r3.j).slice(0, 200));
  ok(await stockOf(B.id) === 10, 'stock de l\'autre article intact (rien de réservé)', String(await stockOf(B.id)));

  console.log('\n4) Panier composé : 5 commandes simultanées, composants pour 2 paniers');
  await admin.from('products').update({ stock_qty: 4 }).eq('id', A.id);   // 2 kg par panier → 2 paniers
  const { data: P } = await admin.from('products').insert({ ...base, name: 'TEST Atomique Panier', price: 250, unit: 'panier', stock_qty: 10, is_bundle: true, bundle_kind: 'theme' }).select('id').single();
  state.bundle = P.id;
  await admin.from('bundle_items').insert([{ bundle_id: P.id, product_id: A.id, quantity: 2, sort_order: 0 }, { bundle_id: P.id, product_id: B.id, quantity: 1, sort_order: 1 }]);
  const p = (qty) => ({ id: P.id, qty, price: 250, name: 'TEST Atomique Panier', unit: 'panier' });
  const r4 = await Promise.all(Array.from({ length: 5 }, () => post([p(1)])));
  const won4 = r4.filter(x => x.status === 200).length;
  ok(won4 === 2, `exactement 2 paniers vendus (obtenu ${won4})`, JSON.stringify(r4.map(x => x.status)));
  ok(await stockOf(A.id) === 0 && await stockOf(B.id) === 8 && await stockOf(P.id) === 8, 'stocks : A 4→0, B 10→8, panier 10→8', `${await stockOf(A.id)}/${await stockOf(B.id)}/${await stockOf(P.id)}`);

  console.log('\n5) Annulation → remise en stock atomique');
  const { data: v } = await anon.auth.verifyOtp({ token_hash: (await admin.auth.admin.generateLink({ type: 'magiclink', email: 'wilsandj@hotmail.com' })).data.properties.hashed_token, type: 'magiclink' });
  const last = r4.find(x => x.status === 200).j.order.id;
  const rc = await fetch(`${BASE}/api/orders`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${v.session.access_token}` }, body: JSON.stringify({ id: last, status: 'cancelled' }) });
  ok(rc.status === 200 && await stockOf(A.id) === 2 && await stockOf(B.id) === 9 && await stockOf(P.id) === 9, 'un panier annulé : A 2, B 9, panier 9', `${rc.status} ${await stockOf(A.id)}/${await stockOf(B.id)}/${await stockOf(P.id)}`);

  console.log('\n6) Le stock ne descend jamais sous 0 (mode non strict)');
  const { data: d6 } = await admin.rpc('stock_apply', { p_lines: [{ product_id: A.id, delta: -50 }], p_strict: false });
  ok(d6?.ok === true && await stockOf(A.id) === 0, 'delta -50 sur stock 2 → 0', JSON.stringify(d6));
} catch (e) { fail++; console.error('  ❌ exception', e); }

console.log(`\n${pass} OK / ${fail} KO\n\n🧹 Nettoyage`);
for (const oid of state.orders) { await admin.from('order_items').delete().eq('order_id', oid); await admin.from('orders').delete().eq('id', oid); }
if (state.bundle) { await admin.from('bundle_items').delete().eq('bundle_id', state.bundle); await admin.from('products').delete().eq('id', state.bundle); }
for (const pid of state.products) await admin.from('products').delete().eq('id', pid);
if (state.preparers.length) await admin.from('preparers').update({ is_active: true }).in('id', state.preparers);
console.log(`  ${state.orders.length} commandes, produits et panier de test supprimés ; préparateurs réactivés`);
process.exit(fail ? 1 : 0);
