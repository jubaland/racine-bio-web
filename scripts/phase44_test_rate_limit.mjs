// Test non destructif de l'anti-rafale (phase 44). Serveur local requis (port 3000).
// Les réglages monitor.* touchés sont sauvegardés puis rétablis ; adresses fictives (x-real-ip) ;
// compteurs créés pendant le test purgés. Comptes/produit/commandes temporaires supprimés.
//   node scripts/phase44_test_rate_limit.mjs
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
const started = new Date().toISOString();
const state = { users: [], products: [], orders: [], preparers: [], settings: {} };

const tokenFor = async (email) => {
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const { data: v } = await anon().auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  return v.session.access_token;
};
const api = async (path, { token, ip, body, method } = {}) => {
  const r = await fetch(BASE + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(ip ? { 'x-real-ip': ip } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = {}; try { j = await r.json(); } catch { /* ignore */ }
  if (j?.order?.id) state.orders.push(j.order.id);
  return { status: r.status, j };
};

try {
  const { data: preps } = await admin.from('preparers').select('id').eq('is_active', true);
  state.preparers = (preps || []).map(p => p.id);
  if (state.preparers.length) await admin.from('preparers').update({ is_active: false }).in('id', state.preparers);
  for (const k of ['monitor.code_attempts_15min', 'monitor.guest_orders_hour']) {
    const { data } = await admin.from('app_settings').select('value_num').eq('key', k).maybeSingle();
    state.settings[k] = data ? data.value_num : undefined;
  }
  const DEL = await cheapestDelivery(admin);
  const adminToken = await tokenFor('wilsandj@hotmail.com');
  const mon = (body) => api('/api/admin/monitoring', { token: adminToken, body });
  const { data: P } = await admin.from('products').insert({ name: 'TEST Rafale produit', price: 500, cost_price: 300, unit: 'kg', stock_qty: 50, farm: 'Test', category: 'legumes', product_type: 'conventionnel', origin_country: 'DJ', region: 'Test', status: 'published', is_local: false, in_stock: true, description: 'TEST RAFALE — à supprimer', bg_color: '#ecf4d5' }).select('id').single();
  state.products.push(P.id);
  const email = `test-rafale-${stamp}@example.com`;
  const { data: U } = await admin.auth.admin.createUser({ email, password: `Tmp-${stamp}!`, email_confirm: true, user_metadata: { full_name: 'Test Rafale' } });
  state.users.push(U.user.id);
  const userToken = await tokenFor(email);
  const IP = (n) => `203.0.113.${n}`;   // plage réservée aux tests/documentation
  const checkCode = (ip, code = 'ZZTESTRAFALE') => api('/api/promo', { ip, body: { code } });
  const guestOrder = (ip, i) => api('/api/orders', { ip, body: {
    order: { user_id: null, payment_method: 'cash', customer_name: 'Test Rafale', phone: `7700000${i}`, address: 'Test', ...DEL.fields, delivery_fee: 0, total: 1 },
    items: [{ product_id: P.id, quantity: 1, price: 1, product_name: 'TEST Rafale produit', product_unit: 'kg' }],
  } });

  console.log('\n1) Réglages (admin › Surveillance)');
  let r = await mon({ action: 'save_settings', code_attempts_15min: 0 });
  ok(r.status === 400, 'zéro refusé (vide = désactivé, pas zéro)', String(r.status));
  r = await mon({ action: 'save_settings', code_attempts_15min: 'abc' });
  ok(r.status === 400, 'valeur non numérique refusée');
  r = await mon({ action: 'save_settings', code_attempts_15min: 3, guest_orders_hour: 2 });
  ok(r.status === 200 && r.j.settings?.code_attempts_15min === 3 && r.j.settings?.guest_orders_hour === 2, 'limites de test enregistrées (3 codes / 2 commandes)', JSON.stringify(r.j.settings));

  console.log('\n2) Essais de codes : 3 par adresse et par quart d\'heure');
  for (let i = 1; i <= 3; i++) {
    r = await checkCode(IP(1));
    ok(r.status === 200 && r.j.valid === false, `essai ${i} : répondu normalement (code inconnu)`);
  }
  r = await checkCode(IP(1));
  ok(r.status === 429 && r.j.reason === 'rate_limited' && Number(r.j.retry_after) >= 1, '4e essai : bloqué avec délai de réessai', JSON.stringify(r.j));
  r = await api('/api/referral', { ip: IP(1), body: { code: 'ZZTESTRAF2' } });
  ok(r.status === 429 && r.j.error === 'rate_limited', 'budget commun : l\'ancien point de vérification est bloqué aussi', JSON.stringify(r.j));
  r = await checkCode(IP(2));
  ok(r.status === 200, 'une autre adresse n\'est pas affectée', String(r.status));

  console.log('\n3) Commandes invité : 2 par adresse et par heure');
  r = await guestOrder(IP(3), 1);
  ok(r.status === 200, 'commande invité 1 acceptée', JSON.stringify(r.j).slice(0, 120));
  r = await guestOrder(IP(3), 2);
  ok(r.status === 200, 'commande invité 2 acceptée');
  const stockBefore = Number((await admin.from('products').select('stock_qty').eq('id', P.id).single()).data.stock_qty);
  r = await guestOrder(IP(3), 3);
  ok(r.status === 429 && r.j.error === 'rate_limited', 'commande invité 3 : bloquée', JSON.stringify(r.j));
  ok(Number((await admin.from('products').select('stock_qty').eq('id', P.id).single()).data.stock_qty) === stockBefore, 'rien n\'a été réservé par le blocage');
  r = await api('/api/orders', { ip: IP(3), token: userToken, body: {
    order: { user_id: U.user.id, payment_method: 'cash', customer_name: 'Test Rafale', phone: '77000009', address: 'Test', ...DEL.fields, delivery_fee: 0, total: 1 },
    items: [{ product_id: P.id, quantity: 1, price: 1, product_name: 'TEST Rafale produit', product_unit: 'kg' }],
  } });
  ok(r.status === 200, 'même adresse mais client CONNECTÉ : non limité', JSON.stringify(r.j).slice(0, 120));

  console.log('\n4) Vide = protection désactivée');
  r = await mon({ action: 'save_settings', code_attempts_15min: '' });
  ok(r.status === 200 && r.j.settings?.code_attempts_15min === null, 'réglage vidé');
  let all200 = true;
  for (let i = 0; i < 5; i++) { const x = await checkCode(IP(4)); if (x.status !== 200) all200 = false; }
  ok(all200, '5 essais d\'affilée passent sans limite');
} catch (e) {
  fail++; console.error('\n💥 Erreur inattendue :', e);
} finally {
  console.log('\nNettoyage…');
  try {
    for (const [k, v] of Object.entries(state.settings)) {
      if (v === undefined) await admin.from('app_settings').delete().eq('key', k);
      else await admin.from('app_settings').upsert({ key: k, value_num: v, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }
    await admin.from('rate_limits').delete().gte('window_start', started);   // compteurs créés pendant le test
    const { data: its } = state.products.length ? await admin.from('order_items').select('order_id').in('product_id', state.products) : { data: [] };
    const oids = [...new Set([...(its || []).map(i => i.order_id), ...state.orders])];
    if (oids.length) {
      await admin.from('order_refunds').delete().in('order_id', oids);
      await admin.from('order_items').delete().in('order_id', oids);
      await admin.from('orders').delete().in('id', oids);
    }
    if (state.products.length) await admin.from('products').delete().in('id', state.products);
    for (const id of state.users) {
      for (const t of ['user_notifications', 'profiles']) await admin.from(t).delete().eq(t === 'profiles' ? 'id' : 'user_id', id);
      await admin.auth.admin.deleteUser(id);
    }
    if (state.preparers.length) await admin.from('preparers').update({ is_active: true }).in('id', state.preparers);
    const { data: back } = await admin.from('app_settings').select('key, value_num').in('key', Object.keys(state.settings));
    ok((back || []).every(r2 => Number(r2.value_num) === Number(state.settings[r2.key])), 'réglages rétablis', JSON.stringify(back));
    const leftO = (await admin.from('orders').select('id', { count: 'exact', head: true }).eq('customer_name', 'Test Rafale')).count;
    ok(leftO === 0, 'commandes de test supprimées', String(leftO));
  } catch (e) { fail++; console.error('Nettoyage incomplet :', e); }
  console.log(`\n${pass} réussis, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
}
