// Test NON destructif des reversements (Phase 2) : marchand temporaire + 2 commandes livrées + 1 annulée
// + 1 ligne déjà réduite → dû exact ; reversement via l'API admin ; lignes marquées ; relevé marchand ;
// idempotence (2e reversement → nothing_due). Tout est supprimé à la fin.
// Usage : node scripts/phase2_test_payouts.mjs [http://localhost:3000]
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.argv[2] || 'http://localhost:3000';
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const out = []; const ok = (n, c, x = '') => out.push(`${c ? '✅' : '❌'} ${n}${x ? ' — ' + x : ''}`);
const sessionFor = async (email) => { const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email }); const { data: v } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' }); return v.session.access_token; };
let uid = null, prodId = null; const orderIds = [];
try {
  const { data: u, error } = await admin.auth.admin.createUser({ email: `test-payout-${Date.now()}@example.com`, password: 'Tmp-' + Math.random().toString(36).slice(2) + 'A1!', email_confirm: true, user_metadata: { full_name: 'Test Payout', role: 'producer' } });
  if (error) throw error; uid = u.user.id;
  await admin.from('merchant_profiles').insert({ user_id: uid, shop_name: 'Boutique Test Payout' });
  const { data: p, error: pe } = await admin.from('products').insert({ name: 'Produit Test Payout', price: 700, unit: 'kg', farm: 'Boutique Test Payout', category: 'fruits', product_type: 'bio', origin_country: 'DJ', region: 'Test', description: 'test', is_local: true, stock_qty: 0, status: 'published', owner_id: uid, bg_color: '#ecf4d5' }).select('id').single();
  if (pe) throw pe; prodId = p.id;
  const mkOrder = async (status, qty) => {
    const { data: o } = await admin.from('orders').insert({ user_id: null, status, total: 700 * qty + 500, delivery_fee: 500, payment_method: 'cash', customer_name: 'Client Payout', phone: '77000000', address: 'Test', delivery_type: 'standard' }).select('id').single();
    orderIds.push(o.id);
    await admin.from('order_items').insert({ order_id: o.id, product_id: prodId, quantity: qty, price: 700 });
    return o.id;
  };
  await mkOrder('delivered', 2);   // 1 400
  await mkOrder('delivered', 1);   //   700  → dû = 2 100
  await mkOrder('cancelled', 5);   // ignorée
  await mkOrder('pending', 3);     // pas encore livrée → ignorée

  const at = await sessionFor('wilsandj@hotmail.com');
  const acall = (m, path, body) => fetch(`${BASE}${path}`, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` }, body: body ? JSON.stringify(body) : undefined }).then(async r => [r.status, await r.json()]);
  let [s, j] = await acall('GET', '/api/admin/merchants/payouts');
  const me = (j.merchants || []).find(m => m.id === uid);
  ok('admin : dû = 2 100 Fdj sur 2 lignes (annulée et non livrée ignorées)', s === 200 && me && me.due === 2100 && me.lines === 2, JSON.stringify(me));
  [s, j] = await acall('GET', `/api/admin/merchants/payouts?user_id=${uid}`);
  ok('admin : détail 2 lignes, total 2 100', s === 200 && j.lines.length === 2 && j.due === 2100, `${s} ${j.due}`);
  [s, j] = await acall('POST', '/api/admin/merchants/payouts', { user_id: uid, method: 'waafi', reference: '' });
  ok('admin : Waafi sans référence → 400', s === 400 && j.error === 'reference_required', `${s} ${j.error}`);
  const { count: nBefore } = await admin.from('user_notifications').select('id', { count: 'exact', head: true }).eq('user_id', uid);
  [s, j] = await acall('POST', '/api/admin/merchants/payouts', { user_id: uid, method: 'waafi', reference: 'WF-PAYOUT-TEST', note: 'test' });
  ok('admin : reversement créé (2 100 Fdj, 2 lignes)', s === 200 && Number(j.payout?.amount) === 2100 && j.payout?.lines_count === 2, `${s} ${JSON.stringify(j.payout && { amount: j.payout.amount, lines: j.payout.lines_count, from: j.payout.period_from, to: j.payout.period_to })}`);
  const payoutId = j.payout?.id;
  const { data: marked } = await admin.from('order_items').select('id, payout_id').in('order_id', orderIds);
  ok('lignes livrées marquées, les autres non', marked.filter(m => m.payout_id === payoutId).length === 2 && marked.filter(m => m.payout_id == null).length === 2);
  const { count: nAfter } = await admin.from('user_notifications').select('id', { count: 'exact', head: true }).eq('user_id', uid);
  ok('marchand notifié (cloche)', (nAfter || 0) === (nBefore || 0) + 1, `${nBefore} → ${nAfter}`);
  [s, j] = await acall('POST', '/api/admin/merchants/payouts', { user_id: uid, method: 'cash' });
  ok('2e reversement → 409 nothing_due (idempotent)', s === 409 && j.error === 'nothing_due', `${s} ${j.error}`);
  [s, j] = await acall('GET', '/api/admin/merchants/payouts');
  const me2 = (j.merchants || []).find(m => m.id === uid);
  ok('admin : dû retombé à 0, historique 1 reversement', me2 && me2.due === 0 && (j.payouts || []).some(p => p.id === payoutId), JSON.stringify(me2));
  // Nouvelle livraison après reversement → nouveau dû
  await admin.from('orders').update({ status: 'delivered' }).eq('id', orderIds[3]);
  [s, j] = await acall('GET', `/api/admin/merchants/payouts?user_id=${uid}`);
  ok('nouvelle commande livrée → dû 2 100 (3 × 700)', s === 200 && j.due === 2100 && j.lines.length === 1, `${s} ${j.due}`);
  // Relevé marchand
  const mt = await sessionFor(u.user.email);
  const r = await fetch(`${BASE}/api/producer/statement`, { headers: { Authorization: `Bearer ${mt}` } }); const st = await r.json();
  ok('marchand : relevé (dû 2 100, déjà reversé 2 100, 1 reversement)', r.status === 200 && st.due === 2100 && st.total_paid === 2100 && st.payouts.length === 1, `${r.status} ${JSON.stringify({ due: st.due, paid: st.total_paid })}`);
  ok('marchand : le relevé ne contient pas d\'identifiant marchand', st.lines.every(l => !('owner_id' in l)));
  const r2 = await fetch(`${BASE}/api/producer/statement`); ok('sans token → 401', r2.status === 401, String(r2.status));
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
