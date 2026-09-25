// Test NON destructif des avis marchands : marchand temporaire + produit ; client A avec commande livrée
// (éligible), client B sans commande (non éligible) ; avis, mise à jour, moyenne, notification, vitrine,
// modération admin (masquer → moyenne recalculée, réafficher). Tout est supprimé à la fin.
// Usage : node scripts/phase10_test_reviews.mjs [http://localhost:3000]
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.argv[2] || 'http://localhost:3000';
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const out = []; const ok = (n, c, x = '') => out.push(`${c ? '✅' : '❌'} ${n}${x ? ' — ' + x : ''}`);
const today = new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const sessionFor = async (email) => { const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email }); const { data: v } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' }); return v.session.access_token; };
const uids = []; let prodId = null, orderId = null;
try {
  const mk = async (tag, meta) => { const { data, error } = await admin.auth.admin.createUser({ email: `test-rev-${tag}-${Date.now()}@example.com`, password: 'Tmp-' + Math.random().toString(36).slice(2) + 'A1!', email_confirm: true, user_metadata: meta }); if (error) throw error; uids.push(data.user.id); return data.user; };
  const m = await mk('m', { full_name: 'Marchand Rev', role: 'producer' });
  const a = await mk('a', { full_name: 'Awa Client' });
  const b = await mk('b', { full_name: 'Bilal Client' });
  await admin.from('merchant_profiles').insert({ user_id: m.id, shop_name: 'Boutique Test Rev' });
  const { data: plan } = await admin.from('merchant_plans').select('id').order('id').limit(1).single();
  await admin.from('merchant_subscriptions').insert({ user_id: m.id, plan_id: plan.id, status: 'active', starts_at: today, ends_at: addDays(today, 9), payment_method: 'cash' });
  const { data: p } = await admin.from('products').insert({ name: 'Banane Test Rev', price: 300, unit: 'kg', farm: 'Boutique Test Rev', region: 'T', category: 'fruits', product_type: 'bio', origin_country: 'DJ', description: 't', is_local: true, stock_qty: 0, status: 'published', owner_id: m.id, bg_color: '#ecf4d5' }).select('id').single();
  prodId = p.id;
  const { data: o } = await admin.from('orders').insert({ user_id: a.id, status: 'delivered', total: 800, delivery_fee: 500, payment_method: 'cash', customer_name: 'Awa Client', phone: '77000000', address: 'T', delivery_type: 'standard' }).select('id').single();
  orderId = o.id; await admin.from('order_items').insert({ order_id: orderId, product_id: prodId, quantity: 1, price: 300 });

  const ta = await sessionFor(a.email), tb = await sessionFor(b.email), tm = await sessionFor(m.email);
  const post = (tok, body) => fetch(`${BASE}/api/merchant-reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify(body) }).then(async r => [r.status, await r.json()]);
  const get = (tok) => fetch(`${BASE}/api/merchant-reviews?owner=${m.id}`, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} }).then(async r => [r.status, await r.json()]);

  let [s, j] = await get(ta); ok('A éligible (commande livrée)', s === 200 && j.eligible === true && j.mine === null, `${s} ${JSON.stringify({ e: j.eligible })}`);
  [s, j] = await get(tb); ok('B non éligible (aucune commande)', s === 200 && j.eligible === false, `${s}`);
  [s, j] = await post(tb, { owner_id: m.id, rating: 5, comment: 'x' }); ok('B : avis refusé (403 not_eligible)', s === 403 && j.error === 'not_eligible', `${s} ${j.error}`);
  [s, j] = await post(tm, { owner_id: m.id, rating: 5 }); ok('le marchand ne peut pas se noter (403)', s === 403, `${s} ${j.error}`);
  [s, j] = await post(ta, { owner_id: m.id, rating: 6 }); ok('note 6 → 400', s === 400, `${s}`);
  const { count: nb } = await admin.from('user_notifications').select('id', { count: 'exact', head: true }).eq('user_id', m.id);
  [s, j] = await post(ta, { owner_id: m.id, rating: 4, comment: 'Produits très frais, livraison rapide.' });
  ok('A : avis 4/5 publié, moyenne 4 (1 avis)', s === 200 && j.avg === 4 && j.count === 1 && j.updated === false, `${s} ${JSON.stringify(j)}`);
  const { data: n } = await admin.from('user_notifications').select('title, body').eq('user_id', m.id).order('created_at', { ascending: false }).limit(1);
  const { count: na } = await admin.from('user_notifications').select('id', { count: 'exact', head: true }).eq('user_id', m.id);
  ok('marchand notifié « Nouvel avis client : 4/5 »', (na || 0) === (nb || 0) + 1 && n?.[0]?.title?.includes('4/5') && n?.[0]?.body?.includes('Awa'), JSON.stringify(n?.[0]));
  [s, j] = await post(ta, { owner_id: m.id, rating: 5, comment: 'Finalement parfait.' });
  ok('A : mise à jour → 5/5, toujours 1 avis, pas de 2e notification', s === 200 && j.updated === true && j.avg === 5 && j.count === 1, `${s} ${JSON.stringify(j)}`);
  const { count: na2 } = await admin.from('user_notifications').select('id', { count: 'exact', head: true }).eq('user_id', m.id);
  ok('pas de notification à la mise à jour', na2 === na);
  [s, j] = await get(null); ok('public : 1 avis publié, prénom « Awa », commentaire à jour', s === 200 && j.count === 1 && j.reviews[0]?.name === 'Awa' && j.reviews[0]?.comment === 'Finalement parfait.' && j.mine === null, `${s}`);
  const html = (await (await fetch(`${BASE}/boutique/${m.id}`)).text());
  ok('vitrine : note 5/5 · 1 avis affichée', html.includes('>5<') && html.includes('/5'), '');
  const { data: prof } = await admin.from('merchant_profiles').select('rating_avg, rating_count').eq('user_id', m.id).single();
  ok('merchant_profiles : moyenne 5, 1 avis', Number(prof.rating_avg) === 5 && prof.rating_count === 1, JSON.stringify(prof));
  // Modération admin
  const at = await sessionFor('wilsandj@hotmail.com');
  const acall = (mth, body) => fetch(`${BASE}/api/admin/merchant-reviews`, { method: mth, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` }, body: body ? JSON.stringify(body) : undefined }).then(async r => [r.status, await r.json()]);
  [s, j] = await acall('GET'); const rev = (j.reviews || []).find(r => r.owner_id === m.id);
  ok('admin : avis listé avec enseigne', s === 200 && rev && rev.shop === 'Boutique Test Rev', `${s}`);
  [s, j] = await acall('POST', { action: 'hide', id: rev.id }); ok('admin : masquer → moyenne recalculée (0 avis)', s === 200 && j.count === 0 && j.avg === null, `${s} ${JSON.stringify(j)}`);
  [s, j] = await get(null); ok('public : avis masqué invisible', j.count === 0 && j.reviews.length === 0);
  [s, j] = await get(ta); ok('A voit son avis masqué (status hidden)', j.mine?.status === 'hidden');
  [s, j] = await acall('POST', { action: 'show', id: rev.id }); ok('admin : réafficher → 1 avis', s === 200 && j.count === 1, `${s}`);
  const r401 = await fetch(`${BASE}/api/admin/merchant-reviews`); ok('admin sans token → 401', r401.status === 401, String(r401.status));
} catch (e) { out.push('💥 ' + e.message); }
finally {
  if (orderId) { await admin.from('order_items').delete().eq('order_id', orderId); await admin.from('orders').delete().eq('id', orderId); }
  for (const id of uids) {
    await admin.from('merchant_reviews').delete().or(`owner_id.eq.${id},user_id.eq.${id}`);
    if (prodId) await admin.from('products').delete().eq('id', prodId).eq('owner_id', id);
    await admin.from('merchant_subscriptions').delete().eq('user_id', id);
    await admin.from('merchant_profiles').delete().eq('user_id', id);
    await admin.from('user_notifications').delete().eq('user_id', id);
    await admin.from('profiles').delete().eq('id', id);
    const { error } = await admin.auth.admin.deleteUser(id);
    out.push(error ? `⚠️ suppression ${id.slice(0, 8)} : ${error.message}` : `🧹 compte ${id.slice(0, 8)} supprimé`);
  }
}
console.log(out.join('\n'));
