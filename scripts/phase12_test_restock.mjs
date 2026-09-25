// Test non destructif du réassort intelligent (phase 12). Serveur local requis (npm run dev, port 3000).
// Compte temporaire + commande modèle hebdo livrée demain → rappel J-1 (manque / OK / idempotence),
// pause « solde insuffisant » → reprise automatique après crédit admin. Tout est supprimé à la fin.
//   node scripts/phase12_test_restock.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const BASE = 'http://localhost:3000';
const cronHeaders = env.CRON_SECRET ? { Authorization: `Bearer ${env.CRON_SECRET}` } : {};

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label} ${extra}`); } };
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const today = new Date().toISOString().slice(0, 10);
const tomorrow = addDays(today, 1);
const dowTomorrow = new Date(tomorrow + 'T00:00:00Z').getUTCDay();

async function adminToken() {
  const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'wilsandj@hotmail.com' });
  const { data: v } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' });
  return v.session.access_token;
}
const notifs = async (uid) => (await admin.from('user_notifications').select('title, body').eq('user_id', uid).order('created_at', { ascending: false })).data || [];
const sub = async (uid) => (await admin.from('subscriptions').select('*').eq('user_id', uid).eq('frequency', 'weekly').single()).data;

let uid = null;
try {
  console.log('\n1) Compte temporaire + commande modèle hebdo livrée demain');
  const email = `test-reassort-${Date.now()}@example.com`;
  const { data: u, error: uErr } = await admin.auth.admin.createUser({ email, password: `Tmp-${Date.now()}!x`, email_confirm: true, user_metadata: { full_name: 'Test Réassort' } });
  ok(!uErr && u?.user, 'compte créé', uErr?.message);
  uid = u.user.id;
  const { data: prod } = await admin.from('products').select('id, name, price, stock_qty').is('owner_id', null).eq('status', 'published').eq('is_bundle', false).gt('stock_qty', 2).order('price', { ascending: false }).limit(1).single();
  ok(!!prod, `produit de test : ${prod?.name} (${prod?.price} Fdj, stock ${prod?.stock_qty})`);
  const { error: sErr } = await admin.from('subscriptions').insert({ user_id: uid, frequency: 'weekly', delivery_day: dowTomorrow, active: true, paused: false, valid_until: addDays(today, 365), delivery_fee: 200 });
  ok(!sErr, 'commande modèle créée (livraison demain, frais 200)', sErr?.message);
  await admin.from('subscription_items').insert({ user_id: uid, frequency: 'weekly', product_id: prod.id, quantity: 2 });
  const expected = Number(prod.price) * 2 + 200;

  console.log('\n2) Rappel J-1 avec cagnotte vide → « il manque »');
  const r1 = await (await fetch(`${BASE}/api/cron/deliveries?only=reminders&user=${uid}`, { headers: cronHeaders })).json();
  const rem1 = r1.reminders?.reminders?.[0];
  ok(rem1 && rem1.kind === 'missing' && rem1.total === expected && rem1.missing === expected, `rappel « manque » : total ${expected}, manque ${expected}`, JSON.stringify(r1).slice(0, 300));
  const n1 = await notifs(uid);
  ok(n1.length === 1 && /il manque/.test(n1[0].title), 'notification cloche « il manque X Fdj »', JSON.stringify(n1));
  ok((await sub(uid)).reminder_sent_for === tomorrow, 'reminder_sent_for = demain');

  console.log('\n3) Idempotence : second appel → rien');
  const r2 = await (await fetch(`${BASE}/api/cron/deliveries?only=reminders&user=${uid}`, { headers: cronHeaders })).json();
  ok((r2.reminders?.reminders || []).length === 0 && (await notifs(uid)).length === 1, 'pas de doublon');

  console.log('\n4) Rappel J-1 avec solde suffisant → « OK » (rappel réinitialisé pour le test)');
  await admin.rpc('wallet_adjust', { p_user: uid, p_amount: expected + 500, p_type: 'deposit', p_order: null, p_note: 'TEST réassort' });
  await admin.from('subscriptions').update({ reminder_sent_for: null }).eq('user_id', uid).eq('frequency', 'weekly');
  const r3 = await (await fetch(`${BASE}/api/cron/deliveries?only=reminders&user=${uid}`, { headers: cronHeaders })).json();
  const rem3 = r3.reminders?.reminders?.[0];
  ok(rem3 && rem3.kind === 'ok' && rem3.missing === 0, 'rappel « OK » (solde suffisant)', JSON.stringify(r3).slice(0, 300));
  const n3 = await notifs(uid);
  ok(n3.length === 2 && /Livraison demain/.test(n3[0].title), 'notification « Livraison demain — X Fdj »', JSON.stringify(n3[0]));

  console.log('\n5) Mode à blanc : calcule sans envoyer');
  await admin.from('subscriptions').update({ reminder_sent_for: null }).eq('user_id', uid).eq('frequency', 'weekly');
  const r4 = await (await fetch(`${BASE}/api/cron/deliveries?only=reminders&user=${uid}&dry=1`, { headers: cronHeaders })).json();
  ok((r4.reminders?.reminders || []).length === 1 && (await notifs(uid)).length === 2 && (await sub(uid)).reminder_sent_for === null, 'dry=1 : rapport sans notification ni marquage');

  console.log('\n6) Pause « solde insuffisant » puis crédit admin → reprise automatique');
  await admin.rpc('wallet_adjust', { p_user: uid, p_amount: -(expected + 500), p_type: 'debit', p_order: null, p_note: 'TEST réassort (vidage)' });
  await admin.from('subscriptions').update({ paused: true, paused_reason: 'low_balance' }).eq('user_id', uid).eq('frequency', 'weekly');
  const token = await adminToken();
  const small = await (await fetch(`${BASE}/api/admin/wallet`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ user_id: uid, amount: 100, note: 'TEST réassort' }) })).json();
  ok(Array.isArray(small.resumed) && small.resumed.length === 0 && (await sub(uid)).paused === true, 'crédit insuffisant (100 Fdj) → reste en pause', JSON.stringify(small));
  const big = await (await fetch(`${BASE}/api/admin/wallet`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ user_id: uid, amount: expected, note: 'TEST réassort' }) })).json();
  const s6 = await sub(uid);
  ok(big.resumed?.length === 1 && s6.paused === false && s6.paused_reason === null, 'crédit suffisant → reprise (paused=false, raison effacée)', JSON.stringify(big));
  ok(big.resumed?.[0]?.next === tomorrow, `prochaine livraison annoncée = demain (${tomorrow})`, JSON.stringify(big.resumed));
  const n6 = await notifs(uid);
  ok(/reprise/.test(n6[0]?.title || ''), 'notification « Commande modèle reprise »', JSON.stringify(n6[0]));

  console.log('\n7) Une pause « expired » ou client n\'est pas levée par une recharge');
  await admin.from('subscriptions').update({ paused: true, paused_reason: 'expired' }).eq('user_id', uid).eq('frequency', 'weekly');
  const r7 = await (await fetch(`${BASE}/api/admin/wallet`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ user_id: uid, amount: 1000, note: 'TEST réassort' }) })).json();
  ok(r7.resumed?.length === 0 && (await sub(uid)).paused === true, 'pause « expired » conservée', JSON.stringify(r7));
} catch (e) { fail++; console.error('  ❌ exception', e); }

console.log(`\n${pass} OK / ${fail} KO`);
if (uid) {
  console.log('\n🧹 Nettoyage');
  await admin.from('user_notifications').delete().eq('user_id', uid);
  await admin.from('subscription_items').delete().eq('user_id', uid);
  await admin.from('subscriptions').delete().eq('user_id', uid);
  await admin.from('wallet_transactions').delete().eq('user_id', uid).then(() => {}, () => {});
  await admin.from('wallets').delete().eq('user_id', uid);
  await admin.from('profiles').delete().eq('id', uid).then(() => {}, () => {});
  const { error } = await admin.auth.admin.deleteUser(uid);
  console.log(error ? `  ⚠️ suppression du compte : ${error.message}` : '  compte temporaire et données supprimés');
}
process.exit(fail ? 1 : 0);
