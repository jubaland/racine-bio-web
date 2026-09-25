// Test NON destructif : filtres période de /api/producer/orders + indicateur paid_out.
// Marchand temporaire, 3 commandes créées directement (hier, il y a 10 jours, aujourd'hui annulée),
// un reversement sur la ligne d'hier. Tout est supprimé à la fin.
// Usage : node scripts/phase7_test_orders_export.mjs [http://localhost:3000]
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.argv[2] || 'http://localhost:3000';
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const out = []; const ok = (n, c, x = '') => out.push(`${c ? '✅' : '❌'} ${n}${x ? ' — ' + x : ''}`);
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();
const day = (daysAgo) => iso(daysAgo).slice(0, 10);
let uid = null, prodId = null; const orderIds = [];
try {
  const { data: u, error } = await admin.auth.admin.createUser({ email: `test-csv-${Date.now()}@example.com`, password: 'Tmp-' + Math.random().toString(36).slice(2) + 'A1!', email_confirm: true, user_metadata: { full_name: 'Test CSV', role: 'producer' } });
  if (error) throw error; uid = u.user.id;
  await admin.from('merchant_profiles').insert({ user_id: uid, shop_name: 'Boutique Test CSV' });
  const { data: p } = await admin.from('products').insert({ name: 'Tomate Test CSV', price: 200, unit: 'kg', farm: 'Boutique Test CSV', region: 'Test', category: 'legumes', product_type: 'bio', origin_country: 'DJ', description: 't', is_local: true, stock_qty: 0, status: 'published', owner_id: uid, bg_color: '#ecf4d5' }).select('id').single();
  prodId = p.id;
  const mk = async (status, daysAgo, qty) => { const { data: o } = await admin.from('orders').insert({ user_id: null, status, total: 200 * qty + 500, delivery_fee: 500, payment_method: 'cash', customer_name: 'Client CSV', phone: '77000000', address: 'T', delivery_type: 'standard', created_at: iso(daysAgo) }).select('id').single(); orderIds.push(o.id); const { data: it } = await admin.from('order_items').insert({ order_id: o.id, product_id: prodId, quantity: qty, price: 200 }).select('id').single(); return { o: o.id, it: it.id }; };
  const a = await mk('delivered', 1, 3);    // hier, reversée
  await mk('delivered', 10, 2);              // il y a 10 jours
  await mk('cancelled', 0, 1);               // aujourd'hui, annulée
  const { data: pay } = await admin.from('merchant_payouts').insert({ user_id: uid, amount: 600, lines_count: 1, method: 'cash', period_from: day(1), period_to: day(1) }).select('id').single();
  await admin.from('order_items').update({ payout_id: pay.id }).eq('id', a.it);

  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: u.user.email });
  const { data: v } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  const get = (qs) => fetch(`${BASE}/api/producer/orders${qs}`, { headers: { Authorization: `Bearer ${v.session.access_token}` } }).then(async r => [r.status, await r.json()]);
  let [s, j] = await get('');
  ok('sans filtre : 3 commandes, stats hors annulée (2 cmd, 1 000 Fdj)', s === 200 && j.orders.length === 3 && j.stats.orders === 2 && j.stats.revenue === 1000, `${s} n=${j.orders?.length} ${JSON.stringify(j.stats)}`);
  const yesterday = j.orders.find(o => o.id === a.o);
  ok('ligne d\'hier marquée reversée, les autres non', yesterday?.items[0]?.paid_out === true && j.orders.filter(o => o.id !== a.o).every(o => o.items.every(i => i.paid_out === false)));
  [s, j] = await get(`?from=${day(2)}&to=${day(0)}`);
  ok('période 2 derniers jours : 2 commandes (hier + aujourd\'hui)', s === 200 && j.orders.length === 2, `${s} n=${j.orders?.length}`);
  [s, j] = await get(`?from=${day(30)}&to=${day(5)}`);
  ok('période -30 → -5 j : 1 commande', s === 200 && j.orders.length === 1, `${s} n=${j.orders?.length}`);
  [s, j] = await get(`?status=delivered&from=${day(2)}`);
  ok('statut livré + depuis 2 j : 1 commande', s === 200 && j.orders.length === 1 && j.orders[0].id === a.o, `${s} n=${j.orders?.length}`);
  [s, j] = await get('?from=2026-13-45');
  ok('date invalide ignorée (3 commandes)', s === 200 && j.orders.length === 3, `${s} n=${j.orders?.length}`);
} catch (e) { out.push('💥 ' + e.message); }
finally {
  if (orderIds.length) { await admin.from('order_items').delete().in('order_id', orderIds); await admin.from('orders').delete().in('id', orderIds); }
  if (uid) {
    await admin.from('merchant_payouts').delete().eq('user_id', uid);
    if (prodId) await admin.from('products').delete().eq('id', prodId);
    await admin.from('merchant_profiles').delete().eq('user_id', uid);
    await admin.from('user_notifications').delete().eq('user_id', uid);
    await admin.from('profiles').delete().eq('id', uid);
    const { error } = await admin.auth.admin.deleteUser(uid);
    out.push(error ? '⚠️ suppression : ' + error.message : '🧹 marchand, produit, commandes et reversement de test supprimés');
  }
}
console.log(out.join('\n'));
