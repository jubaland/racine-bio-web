// Test non destructif des paniers composés (phase 11). Serveur local requis (npm run dev, port 3000).
// Crée 2 produits temporaires + 1 panier, vérifie : règles SQL (composants), disponibilité,
// commande (snapshot, coût, stock composants), expiration, annulation, réduction de ligne,
// cron (plan à blanc). Nettoie tout à la fin (sauf --keep ; --cleanup pour nettoyer ensuite).
//   node scripts/phase11_test_bundles.mjs [--keep] [--cleanup]
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const BASE = 'http://localhost:3000';
const STATE = 'scripts/.phase11_test_state.json';
const keep = process.argv.includes('--keep');
const cleanupOnly = process.argv.includes('--cleanup');

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label} ${extra}`); } };
const stockOf = async (id) => Number((await admin.from('products').select('stock_qty').eq('id', id).single()).data.stock_qty);

async function adminToken() {
  const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'wilsandj@hotmail.com' });
  const { data: v } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' });
  return v.session.access_token;
}

async function cleanup(state) {
  console.log('\n🧹 Nettoyage');
  for (const oid of state.orders || []) { await admin.from('order_items').delete().eq('order_id', oid); await admin.from('orders').delete().eq('id', oid); }
  if (state.bundle) await admin.from('bundle_items').delete().eq('bundle_id', state.bundle);
  for (const pid of [state.bundle, ...(state.products || [])].filter(Boolean)) await admin.from('products').delete().eq('id', pid);
  if (state.preparers?.length) await admin.from('preparers').update({ is_active: true }).in('id', state.preparers);
  if (existsSync(STATE)) unlinkSync(STATE);
  console.log('  produits, commandes et composition supprimés ; préparateurs réactivés');
}

if (cleanupOnly) { if (!existsSync(STATE)) { console.log('rien à nettoyer'); process.exit(0); } await cleanup(JSON.parse(readFileSync(STATE, 'utf8'))); process.exit(0); }

const state = { products: [], bundle: null, orders: [], preparers: [] };
try {
  // Préparateurs désactivés pendant le test (pas de bordereau envoyé)
  const { data: preps } = await admin.from('preparers').select('id').eq('is_active', true);
  state.preparers = (preps || []).map(p => p.id);
  if (state.preparers.length) await admin.from('preparers').update({ is_active: false }).in('id', state.preparers);

  console.log('\n1) Produits temporaires + panier');
  const base = { farm: 'Test Paniers', category: 'legumes', product_type: 'conventionnel', origin_country: 'DJ', region: 'Test', status: 'published', is_local: true, in_stock: true, description: 'TEST PANIERS — à supprimer', bg_color: '#ecf4d5' };
  const { data: A } = await admin.from('products').insert({ ...base, name: 'TEST Tomate panier', price: 300, cost_price: 200, unit: 'kg', stock_qty: 10 }).select('id').single();
  const { data: B } = await admin.from('products').insert({ ...base, name: 'TEST Menthe panier', price: 200, cost_price: 100, unit: 'botte', stock_qty: 4 }).select('id').single();
  state.products = [A.id, B.id];
  const ends = new Date(Date.now() + 86400000).toISOString();
  const { data: P, error: pErr } = await admin.from('products').insert({ ...base, name: 'TEST Panier anti-gaspi', price: 700, unit: 'panier', stock_qty: 5, is_bundle: true, bundle_kind: 'rescue', bundle_ends_at: ends, cost_price: 500 }).select('id').single();
  ok(!pErr && P, 'panier créé', pErr?.message);
  state.bundle = P.id;
  writeFileSync(STATE, JSON.stringify(state));
  const { error: biErr } = await admin.from('bundle_items').insert([{ bundle_id: P.id, product_id: A.id, quantity: 2, sort_order: 0 }, { bundle_id: P.id, product_id: B.id, quantity: 1, sort_order: 1 }]);
  ok(!biErr, 'composition A×2 + B×1', biErr?.message);

  console.log('\n2) Règles SQL de composition');
  const { data: merchantProd } = await admin.from('products').select('id').not('owner_id', 'is', null).limit(1).maybeSingle();
  if (merchantProd) { const { error } = await admin.from('bundle_items').insert({ bundle_id: P.id, product_id: merchantProd.id, quantity: 1 }); ok(error && /merchant/.test(error.message), 'produit marchand refusé comme composant', error?.message); }
  { const { error } = await admin.from('bundle_items').insert({ bundle_id: P.id, product_id: P.id, quantity: 1 }); ok(error && /bundle|self/.test(error.message), 'un panier ne peut pas être composant', error?.message); }
  { const { error } = await admin.from('bundle_items').insert({ bundle_id: A.id, product_id: B.id, quantity: 1 }); ok(error && /not_bundle/.test(error.message), 'un produit simple ne peut pas avoir de composition', error?.message); }

  console.log('\n3) Disponibilité = min(stock panier 5, 10/2=5, 4/1=4) = 4');
  const order = (qty) => ({ order: { user_id: null, total: 700 * qty, delivery_fee: 0, delivery_option_name: 'Test', special_instructions: 'TEST PANIERS', status: 'pending', payment_method: 'cash', phone: '77000000', email: null, address: 'Test', customer_name: 'Test Paniers' }, items: [{ product_id: P.id, quantity: qty, price: 700, product_name: 'TEST Panier anti-gaspi', product_unit: 'panier' }] });
  const post = async (body) => { const r = await fetch(`${BASE}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, j: await r.json() }; };
  const r5 = await post(order(5));
  ok(r5.status === 400 && r5.j.error === 'stock_insufficient' && r5.j.items?.[0]?.available === 4, 'commander 5 paniers → refus, 4 disponibles', JSON.stringify(r5.j).slice(0, 200));

  console.log('\n4) Commande de 2 paniers');
  const r2 = await post(order(2));
  ok(r2.status === 200 && r2.j.order?.id, 'commande acceptée', JSON.stringify(r2.j).slice(0, 200));
  const oid = r2.j.order.id; state.orders.push(oid); writeFileSync(STATE, JSON.stringify(state));
  const { data: line } = await admin.from('order_items').select('id, product_cost, bundle_contents, quantity').eq('order_id', oid).single();
  ok(Array.isArray(line.bundle_contents) && line.bundle_contents.length === 2 && line.bundle_contents[0].name === 'TEST Tomate panier', 'composition photographiée dans order_items.bundle_contents', JSON.stringify(line.bundle_contents));
  ok(Number(line.product_cost) === 500, 'coût snapshot = 2×200 + 1×100 = 500', String(line.product_cost));
  ok(await stockOf(A.id) === 6 && await stockOf(B.id) === 2 && await stockOf(P.id) === 3, 'stocks : A 10→6, B 4→2, panier 5→3', `${await stockOf(A.id)}/${await stockOf(B.id)}/${await stockOf(P.id)}`);

  console.log('\n5) Réduction de ligne 2 → 1 (admin)');
  const token = await adminToken();
  const rr = await fetch(`${BASE}/api/admin/orders/remove-item`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ order_id: oid, item_id: line.id, new_quantity: 1 }) });
  ok(rr.status === 200, 'réduction acceptée', String(rr.status));
  ok(await stockOf(A.id) === 8 && await stockOf(B.id) === 3 && await stockOf(P.id) === 4, 'stocks après réduction : A 8, B 3, panier 4', `${await stockOf(A.id)}/${await stockOf(B.id)}/${await stockOf(P.id)}`);

  console.log('\n6) Annulation admin → tout remis en stock');
  const rc = await fetch(`${BASE}/api/orders`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: oid, status: 'cancelled' }) });
  ok(rc.status === 200, 'annulation acceptée', String(rc.status));
  ok(await stockOf(A.id) === 10 && await stockOf(B.id) === 4 && await stockOf(P.id) === 5, 'stocks restaurés : A 10, B 4, panier 5', `${await stockOf(A.id)}/${await stockOf(B.id)}/${await stockOf(P.id)}`);

  console.log('\n7) Composant en rupture → panier indisponible');
  await admin.from('products').update({ stock_qty: 0 }).eq('id', B.id);
  const r0 = await post(order(1));
  ok(r0.status === 400 && r0.j.items?.[0]?.available === 0, 'commande refusée, 0 disponible', JSON.stringify(r0.j).slice(0, 200));
  await admin.from('products').update({ stock_qty: 4 }).eq('id', B.id);

  console.log('\n8) Panier expiré → indisponible + repéré par le cron');
  await admin.from('products').update({ bundle_ends_at: new Date(Date.now() - 60000).toISOString() }).eq('id', P.id);
  const rx = await post(order(1));
  ok(rx.status === 400 && rx.j.items?.[0]?.available === 0, 'commande refusée après expiration', JSON.stringify(rx.j).slice(0, 200));
  const cron = await (await fetch(`${BASE}/api/cron/merchants?dry=1`, { headers: env.CRON_SECRET ? { Authorization: `Bearer ${env.CRON_SECRET}` } : {} })).json();
  ok(Array.isArray(cron.expired_bundles) && cron.expired_bundles.some(b => b.id === P.id), 'cron (à blanc) liste le panier à archiver', JSON.stringify(cron.expired_bundles));
  await admin.from('products').update({ bundle_ends_at: ends }).eq('id', P.id);

  console.log('\n9) Lecture publique (anon) : composition visible, disponibilité calculée côté site');
  const { data: pub } = await anon.from('bundle_items').select('product_id, quantity').eq('bundle_id', P.id);
  ok(pub && pub.length === 2, 'bundle_items lisible en anonyme', JSON.stringify(pub));
  const { error: wErr } = await anon.from('bundle_items').insert({ bundle_id: P.id, product_id: A.id, quantity: 9 });
  ok(!!wErr, 'écriture anonyme refusée (RLS)', wErr?.message);
} catch (e) { fail++; console.error('  ❌ exception', e); }

console.log(`\n${pass} OK / ${fail} KO`);
if (keep) console.log(`--keep : produits conservés (panier #${state.bundle}, composants ${state.products.join(', ')}). Nettoyer : node scripts/phase11_test_bundles.mjs --cleanup`);
else await cleanup(state);
process.exit(fail ? 1 : 0);
