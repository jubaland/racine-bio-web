// Test NON destructif du récapitulatif quotidien : marchand temporaire en mode 'daily' (abonnement
// actif, produit stock 3 = bas), une commande contenant son produit (créée directement, datée d'il y a
// 2 h) → cron ?dry=1 liste le récap (1 commande, 1 stock bas, will_send) ; réglage via
// /api/producer/settings ; cron réel → e-mail (adresse example.com) + digest_sent_at posé ;
// 2e passage : rien de nouveau → will_send false. Tout est supprimé à la fin.
// Usage : node scripts/phase8_test_digest.mjs [http://localhost:3000]
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.argv[2] || 'http://localhost:3000';
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const out = []; const ok = (n, c, x = '') => out.push(`${c ? '✅' : '❌'} ${n}${x ? ' — ' + x : ''}`);
const today = new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const cronHdr = env.CRON_SECRET ? { Authorization: `Bearer ${env.CRON_SECRET}` } : {};
let uid = null, prodId = null, orderId = null;
try {
  const { data: u, error } = await admin.auth.admin.createUser({ email: `test-digest-${Date.now()}@example.com`, password: 'Tmp-' + Math.random().toString(36).slice(2) + 'A1!', email_confirm: true, user_metadata: { full_name: 'Test Digest', role: 'producer' } });
  if (error) throw error; uid = u.user.id;
  await admin.from('merchant_profiles').insert({ user_id: uid, shop_name: 'Boutique Test Digest', email_mode: 'instant' });
  const { data: plan } = await admin.from('merchant_plans').select('id').order('id').limit(1).single();
  await admin.from('merchant_subscriptions').insert({ user_id: uid, plan_id: plan.id, status: 'active', starts_at: today, ends_at: addDays(today, 9), payment_method: 'cash' });
  const { data: p } = await admin.from('products').insert({ name: 'Avocat Test Digest', price: 500, unit: 'kg', farm: 'Boutique Test Digest', region: 'T', category: 'fruits', product_type: 'bio', origin_country: 'DJ', description: 't', is_local: true, stock_qty: 3, status: 'published', owner_id: uid, bg_color: '#ecf4d5' }).select('id').single();
  prodId = p.id;
  const { data: o } = await admin.from('orders').insert({ user_id: null, status: 'pending', total: 1500, delivery_fee: 500, payment_method: 'cash', customer_name: 'Client Digest', phone: '77000000', address: 'T', delivery_type: 'standard', created_at: new Date(Date.now() - 2 * 3600000).toISOString() }).select('id').single();
  orderId = o.id; await admin.from('order_items').insert({ order_id: orderId, product_id: prodId, quantity: 2, price: 500 });

  // Réglage marchand
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: u.user.email });
  const { data: v } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${v.session.access_token}` };
  let r = await fetch(`${BASE}/api/producer/settings`, { headers: hdr }); let j = await r.json();
  ok('réglage par défaut = instant', r.status === 200 && j.email_mode === 'instant', `${r.status} ${j.email_mode}`);
  r = await fetch(`${BASE}/api/producer/settings`, { method: 'POST', headers: hdr, body: JSON.stringify({ email_mode: 'weekly' }) });
  ok('valeur invalide → 400', r.status === 400, String(r.status));
  r = await fetch(`${BASE}/api/producer/settings`, { method: 'POST', headers: hdr, body: JSON.stringify({ email_mode: 'daily' }) }); j = await r.json();
  ok('passage en mode daily', r.status === 200 && j.email_mode === 'daily', `${r.status}`);

  // Cron à blanc
  r = await fetch(`${BASE}/api/cron/merchants?dry=1`, { headers: cronHdr }); j = await r.json();
  const d = (j.digests || []).find(x => x.shop === 'Boutique Test Digest');
  ok('cron dry : récap listé (1 commande, 1 stock bas, dû 0, will_send)', !!d && d.new_orders === 1 && d.low_stock === 1 && d.due === 0 && d.will_send === true, JSON.stringify(d));
  const { data: before } = await admin.from('merchant_profiles').select('digest_sent_at').eq('user_id', uid).single();
  ok('dry : digest_sent_at non posé', before.digest_sent_at == null);
  // Cron réel
  r = await fetch(`${BASE}/api/cron/merchants`, { headers: cronHdr }); j = await r.json();
  const d2 = (j.digests || []).find(x => x.shop === 'Boutique Test Digest');
  ok('cron réel : envoi sans erreur', r.status === 200 && d2?.will_send === true && !(j.errors || []).some(e => e.includes('Boutique Test Digest')), JSON.stringify(j.errors));
  const { data: after } = await admin.from('merchant_profiles').select('digest_sent_at').eq('user_id', uid).single();
  ok('digest_sent_at posé', !!after.digest_sent_at);
  // 2e passage : la commande est antérieure au dernier envoi → plus de nouvelle commande ; stock bas reste → will_send true mais 0 commande
  r = await fetch(`${BASE}/api/cron/merchants?dry=1`, { headers: cronHdr }); j = await r.json();
  const d3 = (j.digests || []).find(x => x.shop === 'Boutique Test Digest');
  ok('2e passage : 0 nouvelle commande (période bornée par le dernier envoi)', d3 && d3.new_orders === 0, JSON.stringify(d3));
  // Retour en instant → plus de récap
  await fetch(`${BASE}/api/producer/settings`, { method: 'POST', headers: hdr, body: JSON.stringify({ email_mode: 'instant' }) });
  r = await fetch(`${BASE}/api/cron/merchants?dry=1`, { headers: cronHdr }); j = await r.json();
  ok('mode instant → absent des récaps', !(j.digests || []).some(x => x.shop === 'Boutique Test Digest'));
} catch (e) { out.push('💥 ' + e.message); }
finally {
  if (orderId) { await admin.from('order_items').delete().eq('order_id', orderId); await admin.from('orders').delete().eq('id', orderId); }
  if (uid) {
    if (prodId) await admin.from('products').delete().eq('id', prodId);
    await admin.from('merchant_subscriptions').delete().eq('user_id', uid);
    await admin.from('merchant_profiles').delete().eq('user_id', uid);
    await admin.from('user_notifications').delete().eq('user_id', uid);
    await admin.from('profiles').delete().eq('id', uid);
    const { error } = await admin.auth.admin.deleteUser(uid);
    out.push(error ? '⚠️ suppression : ' + error.message : '🧹 marchand, produit et commande de test supprimés');
  }
}
console.log(out.join('\n'));
