// Test NON destructif des promotions planifiées : marchand temporaire (abonnement actif) + produit publié
// à 1 000 Fdj → promo 800 aujourd'hui ; règles (prix, dates, chevauchement) ; prix effectif dans la
// vitrine ; commande passée avec un prix falsifié → l'API impose le prix serveur ; annulation.
// Préparateurs mis en pause pendant la commande. Tout est supprimé à la fin.
// Usage : node scripts/phase6_test_promotions.mjs [http://localhost:3000]
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
  prepIds = (preps || []).map(p => p.id); if (prepIds.length) await admin.from('preparers').update({ is_active: false }).in('id', prepIds);
  const { data: u, error } = await admin.auth.admin.createUser({ email: `test-promo-${Date.now()}@example.com`, password: 'Tmp-' + Math.random().toString(36).slice(2) + 'A1!', email_confirm: true, user_metadata: { full_name: 'Test Promo', role: 'producer' } });
  if (error) throw error; uid = u.user.id;
  await admin.from('merchant_profiles').insert({ user_id: uid, shop_name: 'Boutique Test Promo' });
  const { data: plan } = await admin.from('merchant_plans').select('id').order('id').limit(1).single();
  await admin.from('merchant_subscriptions').insert({ user_id: uid, plan_id: plan.id, status: 'active', starts_at: today, ends_at: addDays(today, 29), payment_method: 'cash' });
  const { data: p } = await admin.from('products').insert({ name: 'Goyave Test Promo', price: 1000, unit: 'kg', farm: 'Boutique Test Promo', region: 'Test', category: 'fruits', product_type: 'bio', origin_country: 'DJ', description: 'test', is_local: true, stock_qty: 20, status: 'published', owner_id: uid, bg_color: '#ecf4d5' }).select('id').single();
  prodId = p.id;
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: u.user.email });
  const { data: v } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  const call = (body) => fetch(`${BASE}/api/producer/promotions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${v.session.access_token}` }, body: JSON.stringify(body) }).then(async r => [r.status, await r.json()]);

  let [s, j] = await call({ product_id: prodId, promo_price: 1200, starts_at: today, ends_at: addDays(today, 3) });
  ok('prix promo ≥ prix normal → refusé', s === 400 && j.error === 'price_not_lower', `${s} ${j.error}`);
  [s, j] = await call({ product_id: prodId, promo_price: 800, starts_at: addDays(today, -1), ends_at: today });
  ok('début dans le passé → refusé', s === 400 && j.error === 'start_in_past', `${s} ${j.error}`);
  [s, j] = await call({ product_id: prodId, promo_price: 800, starts_at: today, ends_at: addDays(today, 3) });
  ok('promo 800 Fdj aujourd\'hui → créée, état « en cours »', s === 200 && j.promotion?.state === 'active', `${s} ${JSON.stringify(j.promotion && { state: j.promotion.state })}`);
  const promoId = j.promotion?.id;
  [s, j] = await call({ product_id: prodId, promo_price: 700, starts_at: addDays(today, 2), ends_at: addDays(today, 5) });
  ok('chevauchement → refusé', s === 409 && j.error === 'overlap', `${s} ${j.error}`);
  [s, j] = await call({ product_id: prodId, promo_price: 700, starts_at: addDays(today, 4), ends_at: addDays(today, 6) });
  ok('promo suivante (à venir) → créée', s === 200 && j.promotion?.state === 'upcoming', `${s}`);
  const upcomingId = j.promotion?.id;

  // Prix effectif sur la vitrine (rendu serveur)
  const norm = (h) => h.replace(/[  ]/g, ' ');
  const html = norm(await (await fetch(`${BASE}/boutique/${uid}`)).text());
  const promoShown = (h) => h.includes('text-[#7d9800]">800<!-- --> Fdj') && h.includes('line-through">1 000<!-- --> Fdj');
  ok('vitrine : 800 Fdj affiché avec 1 000 barré', promoShown(html), '');
  // Commande avec prix falsifié (500) → prix serveur 800
  const r = await fetch(`${BASE}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    order: { user_id: null, status: 'pending', total: 500 * 2 + 500, delivery_fee: 500, delivery_type: 'standard', delivery_option_name: 'Standard', payment_method: 'cash', customer_name: 'Client Test Promo', phone: '77000000', address: 'Test', email: null },
    items: [{ product_id: prodId, quantity: 2, price: 500, product_name: 'Goyave Test Promo', product_unit: 'kg' }],
  }) });
  const oj = await r.json(); orderId = oj.order?.id;
  ok('commande : prix serveur imposé (800 × 2 + 500 = 2 100), price_adjusted', r.status === 200 && Number(oj.order?.total) === 2100 && oj.price_adjusted === true, `${r.status} total=${oj.order?.total} adj=${oj.price_adjusted}`);
  const { data: it } = await admin.from('order_items').select('price').eq('order_id', orderId).single();
  ok('ligne de commande au prix promo 800', Number(it.price) === 800, String(it.price));
  // Annulation de la promo en cours → prix normal
  [s, j] = await call({ action: 'cancel', id: promoId });
  ok('annulation de la promo en cours → 200', s === 200, String(s));
  const html2 = norm(await (await fetch(`${BASE}/boutique/${uid}`)).text());
  ok('vitrine : retour à 1 000 Fdj sans prix barré', html2.includes('text-[#7d9800]">1 000<!-- --> Fdj') && !html2.includes('line-through">1 000'), '');
  [s, j] = await call({ action: 'cancel', id: promoId });
  ok('ré-annulation → 409', s === 409, String(s));
  const g = await fetch(`${BASE}/api/producer/promotions`, { headers: { Authorization: `Bearer ${v.session.access_token}` } }); const gj = await g.json();
  ok('liste : 2 promos (annulée + à venir)', g.status === 200 && gj.promotions.length === 2 && gj.promotions.some(x => x.id === upcomingId && x.state === 'upcoming'), `${g.status} ${gj.promotions?.map(x => x.state).join(',')}`);
} catch (e) { out.push('💥 ' + e.message); }
finally {
  if (orderId) { await admin.from('order_items').delete().eq('order_id', orderId); await admin.from('orders').delete().eq('id', orderId); await admin.from('admin_notifications').delete().or(`body.like.%#${orderId}%,body.like.%Client Test Promo%`); }
  if (uid) {
    if (prodId) { await admin.from('product_promotions').delete().eq('product_id', prodId); await admin.from('products').delete().eq('id', prodId); }
    await admin.from('merchant_subscriptions').delete().eq('user_id', uid);
    await admin.from('merchant_profiles').delete().eq('user_id', uid);
    await admin.from('user_notifications').delete().eq('user_id', uid);
    await admin.from('profiles').delete().eq('id', uid);
    const { error } = await admin.auth.admin.deleteUser(uid);
    out.push(error ? '⚠️ suppression : ' + error.message : '🧹 marchand, produit, promos et commande de test supprimés');
  }
  if (prepIds.length) { await admin.from('preparers').update({ is_active: true }).in('id', prepIds); out.push(`🧹 ${prepIds.length} préparateur(s) réactivé(s)`); }
}
console.log(out.join('\n'));
