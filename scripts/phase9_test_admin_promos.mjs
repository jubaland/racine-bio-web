// Test NON destructif du planificateur de promos admin : produit Hornafresh temporaire (stock 0, donc
// non commandable) + marchand temporaire avec promo ; l'admin programme une promo Hornafresh, ne peut
// pas en créer sur un produit marchand, annule la promo du marchand (notification). Tout est supprimé.
// Usage : node scripts/phase9_test_admin_promos.mjs [http://localhost:3000]
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
let uid = null, hfProd = null, mProd = null;
try {
  const { data: hp } = await admin.from('products').insert({ name: 'Pastèque Test Admin Promo', price: 900, unit: 'kg', farm: 'Ferme Test', region: 'T', category: 'fruits', product_type: 'bio', origin_country: 'DJ', description: 't', is_local: true, stock_qty: 0, status: 'published', bg_color: '#ecf4d5' }).select('id').single();
  hfProd = hp.id;
  const { data: u, error } = await admin.auth.admin.createUser({ email: `test-apromo-${Date.now()}@example.com`, password: 'Tmp-' + Math.random().toString(36).slice(2) + 'A1!', email_confirm: true, user_metadata: { full_name: 'Test APromo', role: 'producer' } });
  if (error) throw error; uid = u.user.id;
  await admin.from('merchant_profiles').insert({ user_id: uid, shop_name: 'Boutique Test APromo' });
  const { data: mp } = await admin.from('products').insert({ name: 'Melon Test APromo', price: 600, unit: 'kg', farm: 'Boutique Test APromo', region: 'T', category: 'fruits', product_type: 'bio', origin_country: 'DJ', description: 't', is_local: true, stock_qty: 0, status: 'published', owner_id: uid, bg_color: '#ecf4d5' }).select('id').single();
  mProd = mp.id;
  const { data: mpromo } = await admin.from('product_promotions').insert({ product_id: mProd, owner_id: uid, promo_price: 450, starts_at: today, ends_at: addDays(today, 5), created_by: uid }).select('id').single();

  const at = await sessionFor('wilsandj@hotmail.com');
  const call = (m, body) => fetch(`${BASE}/api/admin/promotions`, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` }, body: body ? JSON.stringify(body) : undefined }).then(async r => [r.status, await r.json()]);
  let [s, j] = await call('GET');
  ok('GET : produits Hornafresh publiés seulement (pas le produit marchand)', s === 200 && j.products.some(p => p.id === hfProd) && !j.products.some(p => p.id === mProd), `${s}`);
  ok('GET : promo marchand listée avec enseigne', j.promotions.some(p => p.id === mpromo.id && p.shop === 'Boutique Test APromo' && p.state === 'active'));
  [s, j] = await call('POST', { product_id: mProd, promo_price: 400, starts_at: today, ends_at: addDays(today, 2) });
  ok('POST sur produit marchand → 403 merchant_product', s === 403 && j.error === 'merchant_product', `${s} ${j.error}`);
  [s, j] = await call('POST', { product_id: hfProd, promo_price: 700, starts_at: today, ends_at: addDays(today, 3) });
  ok('POST promo Hornafresh 700 → créée, en cours, sans propriétaire', s === 200 && j.promotion?.state === 'active' && j.promotion?.owner_id === null, `${s} ${JSON.stringify(j.promotion && { state: j.promotion.state, owner: j.promotion.owner_id })}`);
  const hfPromo = j.promotion?.id;
  [s, j] = await call('POST', { product_id: hfProd, promo_price: 650, starts_at: addDays(today, 1), ends_at: addDays(today, 2) });
  ok('chevauchement → 409', s === 409 && j.error === 'overlap', `${s} ${j.error}`);
  // Prix effectif côté site (fiche produit, rendu serveur)
  const html = (await (await fetch(`${BASE}/product/${hfProd}`)).text()).replace(/[  ]/g, ' ');
  ok('fiche produit : 700 affiché, 900 barré', html.includes('>700<') && html.includes('line-through">900<!-- --> Fdj'), '');
  // Annulation d'une promo marchand par l'admin → notification
  const { count: nb } = await admin.from('user_notifications').select('id', { count: 'exact', head: true }).eq('user_id', uid);
  [s, j] = await call('POST', { action: 'cancel', id: mpromo.id, note: 'Prix trop bas pour la charte' });
  ok('annulation promo marchand → 200', s === 200, String(s));
  const { data: n } = await admin.from('user_notifications').select('title, body, url').eq('user_id', uid).order('created_at', { ascending: false }).limit(1);
  const { count: na } = await admin.from('user_notifications').select('id', { count: 'exact', head: true }).eq('user_id', uid);
  ok('marchand notifié avec le motif', (na || 0) === (nb || 0) + 1 && n?.[0]?.title?.includes('annulée') && n?.[0]?.body?.includes('Prix trop bas') && n?.[0]?.url === '/producer/promotions', JSON.stringify(n?.[0]));
  [s, j] = await call('POST', { action: 'cancel', id: hfPromo });
  ok('annulation promo Hornafresh → 200', s === 200, String(s));
  [s, j] = await call('GET');
  ok('GET : les deux promos annulées', j.promotions.filter(p => [hfPromo, mpromo.id].includes(p.id)).every(p => p.state === 'cancelled'));
  const r = await fetch(`${BASE}/api/admin/promotions`); ok('sans token → 401', r.status === 401, String(r.status));
} catch (e) { out.push('💥 ' + e.message); }
finally {
  if (hfProd) { await admin.from('product_promotions').delete().eq('product_id', hfProd); await admin.from('products').delete().eq('id', hfProd); }
  if (uid) {
    if (mProd) { await admin.from('product_promotions').delete().eq('product_id', mProd); await admin.from('products').delete().eq('id', mProd); }
    await admin.from('merchant_profiles').delete().eq('user_id', uid);
    await admin.from('user_notifications').delete().eq('user_id', uid);
    await admin.from('profiles').delete().eq('id', uid);
    const { error } = await admin.auth.admin.deleteUser(uid);
    out.push(error ? '⚠️ suppression : ' + error.message : '🧹 produits, promos et marchand de test supprimés');
  }
}
console.log(out.join('\n'));
