// Test NON destructif Phase 3 : marchand temporaire (abonnement actif, produit publié stock 6) →
// commande invité via POST /api/orders → le marchand est notifié (nouvelle commande + stock bas),
// stats marchand, vitrine /boutique/[id]. Préparateurs mis en pause pendant le test. Tout est supprimé.
// Usage : node scripts/phase3_test_merchant.mjs [http://localhost:3000]
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.argv[2] || 'http://localhost:3000';
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const out = []; const ok = (n, c, x = '') => out.push(`${c ? '✅' : '❌'} ${n}${x ? ' — ' + x : ''}`);
const today = new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
let uid = null, prodId = null, orderId = null, prepIds = [];
try {
  const { data: preps } = await admin.from('preparers').select('id').eq('is_active', true);
  prepIds = (preps || []).map(p => p.id);
  if (prepIds.length) await admin.from('preparers').update({ is_active: false }).in('id', prepIds);

  const { data: u, error } = await admin.auth.admin.createUser({ email: `test-p3-${Date.now()}@example.com`, password: 'Tmp-' + Math.random().toString(36).slice(2) + 'A1!', email_confirm: true, user_metadata: { full_name: 'Test P3', role: 'producer' } });
  if (error) throw error; uid = u.user.id;
  await admin.from('merchant_profiles').insert({ user_id: uid, shop_name: 'Boutique Test P3' });
  const { data: plan } = await admin.from('merchant_plans').select('id').order('id').limit(1).single();
  await admin.from('merchant_subscriptions').insert({ user_id: uid, plan_id: plan.id, status: 'active', starts_at: today, ends_at: addDays(today, 29), payment_method: 'cash' });
  const { data: p, error: pe } = await admin.from('products').insert({ name: 'Papaye Test P3', price: 350, unit: 'kg', farm: 'Boutique Test P3', region: 'Test', category: 'fruits', product_type: 'bio', origin_country: 'DJ', description: 'test', is_local: true, stock_qty: 6, status: 'published', owner_id: uid, bg_color: '#ecf4d5' }).select('id').single();
  if (pe) throw pe; prodId = p.id;

  // Vitrine publique
  const shop = await fetch(`${BASE}/boutique/${uid}`); const html = await shop.text();
  ok('vitrine /boutique/[id] → 200 avec le produit', shop.status === 200 && html.includes('Boutique Test P3') && html.includes('Papaye Test P3'), String(shop.status));
  const bad = await fetch(`${BASE}/boutique/00000000-0000-0000-0000-000000000000`);
  ok('vitrine inconnue → 404', bad.status === 404, String(bad.status));

  // Commande invité contenant 2 kg → stock 6 → 4 (≤ 5 : alerte stock bas au marchand)
  const { count: before } = await admin.from('user_notifications').select('id', { count: 'exact', head: true }).eq('user_id', uid);
  const r = await fetch(`${BASE}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    order: { user_id: null, status: 'pending', total: 700 + 500, delivery_fee: 500, delivery_type: 'standard', delivery_option_name: 'Standard', payment_method: 'cash', customer_name: 'Client Test P3', phone: '77000000', address: 'Test', email: null },
    items: [{ product_id: prodId, quantity: 2, price: 350, product_name: 'Papaye Test P3', product_unit: 'kg' }],
  }) });
  const j = await r.json(); orderId = j.order?.id || j.id || j.order_id || null;
  if (!orderId) { const { data: o } = await admin.from('orders').select('id').eq('customer_name', 'Client Test P3').order('created_at', { ascending: false }).limit(1).maybeSingle(); orderId = o?.id || null; }
  ok('commande créée via l\'API', r.status === 200 && !!orderId, `${r.status} #${orderId}`);
  await new Promise(res => setTimeout(res, 1500));
  const { data: notifs } = await admin.from('user_notifications').select('title, body, url').eq('user_id', uid).order('created_at', { ascending: false });
  const nNew = (notifs || []).find(n => n.title.includes('Nouvelle commande'));
  const nLow = (notifs || []).find(n => n.title.includes('Stock bas'));
  ok('marchand notifié « Nouvelle commande » avec ses articles', !!nNew && nNew.body.includes('2 kg Papaye Test P3') && nNew.url === '/producer/orders', JSON.stringify(nNew));
  ok('marchand notifié « Stock bas » (6 → 4)', !!nLow && nLow.url === '/producer/products', JSON.stringify(nLow));
  const { data: pr } = await admin.from('products').select('stock_qty').eq('id', prodId).single();
  ok('stock décrémenté à 4', Number(pr.stock_qty) === 4, String(pr.stock_qty));

  // Stats marchand
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: u.user.email });
  const { data: v } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  const st = await fetch(`${BASE}/api/producer/stats?period=30d`, { headers: { Authorization: `Bearer ${v.session.access_token}` } }); const sj = await st.json();
  const row = (sj.products || []).find(x => x.product_id === prodId);
  ok('stats : 2 kg vendus, 700 Fdj, 0 livré, stock 4, 1 commande', st.status === 200 && row && row.qty === 2 && row.revenue === 700 && row.delivered_revenue === 0 && row.stock === 4 && sj.totals.orders === 1, JSON.stringify(row));
  ok('stats : meilleure vente = Papaye', sj.top === 'Papaye Test P3', String(sj.top));
  // Livraison → livré compté
  await admin.from('orders').update({ status: 'delivered' }).eq('id', orderId);
  const st2 = await fetch(`${BASE}/api/producer/stats?period=all`, { headers: { Authorization: `Bearer ${v.session.access_token}` } }); const sj2 = await st2.json();
  ok('stats après livraison : livré = 700', sj2.totals.delivered_revenue === 700, String(sj2.totals.delivered_revenue));
} catch (e) { out.push('💥 ' + e.message); }
finally {
  if (orderId) { await admin.from('order_items').delete().eq('order_id', orderId); await admin.from('orders').delete().eq('id', orderId); await admin.from('admin_notifications').delete().or(`body.like.%#${orderId}%,body.like.%Client Test P3%`); }
  if (uid) {
    if (prodId) await admin.from('products').delete().eq('id', prodId);
    await admin.from('merchant_subscriptions').delete().eq('user_id', uid);
    await admin.from('merchant_profiles').delete().eq('user_id', uid);
    await admin.from('user_notifications').delete().eq('user_id', uid);
    await admin.from('profiles').delete().eq('id', uid);
    const { error } = await admin.auth.admin.deleteUser(uid);
    out.push(error ? '⚠️ suppression : ' + error.message : '🧹 marchand, produit et commande de test supprimés');
  }
  if (prepIds.length) { await admin.from('preparers').update({ is_active: true }).in('id', prepIds); out.push(`🧹 ${prepIds.length} préparateur(s) réactivé(s)`); }
}
console.log(out.join('\n'));
