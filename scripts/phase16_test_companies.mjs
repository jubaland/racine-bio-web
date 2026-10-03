// Test non destructif des comptes entreprise (phase 16). Serveur local requis (npm run dev, port 3000).
// Comptes temporaires (gérant, acheteur, comptable, étranger) + société + produit de test. Vérifie :
// demande d'ouverture, validation admin, droits par rôle, recharge (minimum paramétrable), commande
// société (débit, site), seuil de validation, annulation (remboursement cagnotte société), sécurité
// de l'identité à la commande, commande récurrente + rappel, RLS. Tout est supprimé à la fin.
//   node scripts/phase16_test_companies.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { cheapestDelivery } from './test_helpers.mjs';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// Frais de livraison calculés par le serveur : chaque commande de test désigne une option réelle
const DEL = await cheapestDelivery(admin);
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const BASE = 'http://localhost:3000';
const cronHeaders = env.CRON_SECRET ? { Authorization: `Bearer ${env.CRON_SECRET}` } : {};

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label} ${extra}`); } };
const stamp = Date.now();
const users = {}; const state = { company: null, products: [], orders: [], preparers: [], minBefore: null };

async function mkUser(key, name) {
  const email = `test-co-${key}-${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: `Tmp-${stamp}!${key}`, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw error;
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const { data: v } = await anon().auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  users[key] = { id: data.user.id, email, token: v.session.access_token };
}
async function tokenFor(email) {
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const { data: v } = await anon().auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  return v.session.access_token;
}
const api = async (path, token, body, method = body ? 'POST' : 'GET') => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch { /* ignore */ }
  if (j?.order?.id) state.orders.push(j.order.id);
  return { status: r.status, j };
};
const co = (token, body) => api('/api/company', token, body);
const balance = async () => Number((await admin.from('company_wallets').select('balance').eq('company_id', state.company).maybeSingle()).data?.balance) || 0;
const stockOf = async (id) => Number((await admin.from('products').select('stock_qty').eq('id', id).single()).data.stock_qty);

try {
  const { data: preps } = await admin.from('preparers').select('id').eq('is_active', true);
  state.preparers = (preps || []).map(p => p.id);
  if (state.preparers.length) await admin.from('preparers').update({ is_active: false }).in('id', state.preparers);
  state.minBefore = (await admin.from('app_settings').select('value_num').eq('key', 'company.min_topup').maybeSingle()).data?.value_num ?? null;

  await mkUser('manager', 'Test Gérant'); await mkUser('buyer', 'Test Acheteur'); await mkUser('accountant', 'Test Comptable'); await mkUser('outsider', 'Test Étranger');
  const adminToken = await tokenFor('wilsandj@hotmail.com');
  const { data: P } = await admin.from('products').insert({ name: 'TEST Entreprise produit', price: 1000, cost_price: 600, unit: 'kg', stock_qty: 50, farm: 'Test', category: 'legumes', product_type: 'conventionnel', origin_country: 'DJ', region: 'Test', status: 'published', is_local: false, in_stock: true, description: 'TEST ENTREPRISE — à supprimer', bg_color: '#ecf4d5' }).select('id').single();
  state.products.push(P.id);
  const line = (qty) => ({ product_id: P.id, quantity: qty, price: 1000, product_name: 'TEST Entreprise produit', product_unit: 'kg' });

  console.log('\n1) Demande d\'ouverture');
  let r = await co(users.manager.token, { action: 'request', name: `TEST Société ${stamp}`, activity: 'Restaurant', contact_name: 'Test Gérant', phone: '77000001', address: 'Quartier Test, Djibouti' });
  ok(r.status === 200 && r.j.company?.status === 'pending', 'société créée en attente', JSON.stringify(r.j));
  state.company = r.j.company.id;
  r = await co(users.manager.token, { action: 'request', name: 'Doublon', contact_name: 'x', phone: '77000001', address: 'x' });
  ok(r.status === 409, 'une seule société par utilisateur', String(r.status));
  r = await co(users.manager.token, { action: 'deposit', amount: 50000, method: 'cash' });
  ok(r.status === 403 && r.j.error === 'company_inactive', 'société non validée : actions bloquées', JSON.stringify(r.j));

  console.log('\n2) Validation admin');
  r = await api('/api/admin/companies', users.manager.token, { action: 'approve', company_id: state.company });
  ok(r.status === 403 || r.status === 401, 'un non-admin ne peut pas valider', String(r.status));
  r = await api('/api/admin/companies', adminToken, { action: 'approve', company_id: state.company });
  ok(r.status === 200, 'société activée par l\'admin', JSON.stringify(r.j));
  r = await co(users.manager.token);
  ok(r.j.company?.status === 'active' && r.j.membership?.role === 'manager' && r.j.sites?.length === 1, 'espace gérant : active, 1 site (siège)', JSON.stringify(r.j).slice(0, 200));
  const siteId = r.j.sites[0].id;

  console.log('\n3) Équipe : invitations et rôles');
  r = await co(users.manager.token, { action: 'invite', email: users.buyer.email, role: 'buyer' });
  ok(r.status === 200, 'acheteur invité');
  await co(users.manager.token, { action: 'invite', email: users.accountant.email, role: 'accountant' });
  r = await co(users.buyer.token);
  ok(!r.j.membership && r.j.invites?.length === 1, 'l\'invité voit son invitation', JSON.stringify(r.j).slice(0, 200));
  r = await co(users.buyer.token, { action: 'accept_invite', invite_id: r.j.invites[0].id });
  ok(r.status === 200, 'invitation acceptée');
  const invAcc = (await co(users.accountant.token)).j.invites[0].id;
  await co(users.accountant.token, { action: 'accept_invite', invite_id: invAcc });
  r = await co(users.buyer.token, { action: 'invite', email: 'x@example.com', role: 'buyer' });
  ok(r.status === 403, 'un acheteur ne peut pas inviter', String(r.status));
  r = await co(users.manager.token, { action: 'set_role', user_id: users.manager.id, role: 'buyer' });
  ok(r.status === 409 && r.j.error === 'last_manager', 'le dernier gérant ne peut pas se rétrograder', JSON.stringify(r.j));
  r = await co(users.outsider.token, { action: 'accept_invite', invite_id: invAcc });
  ok(r.status === 404, 'une invitation n\'est utilisable que par son destinataire', String(r.status));

  console.log('\n4) Recharge : minimum paramétrable');
  await api('/api/admin/companies', adminToken, { action: 'set_global_min', value: 10000 });
  r = await co(users.manager.token, { action: 'deposit', amount: 9000, method: 'waafi', reference: 'T1' });
  ok(r.status === 400 && r.j.error === 'below_min_topup' && r.j.min_topup === 10000, 'sous le minimum global (10 000) : refusé', JSON.stringify(r.j));
  await api('/api/admin/companies', adminToken, { action: 'set_company_min', company_id: state.company, value: 3000 });
  r = await co(users.manager.token, { action: 'deposit', amount: 5000, method: 'waafi', reference: 'T2' });
  ok(r.status === 200, 'minimum propre à la société (3 000) : 5 000 accepté', JSON.stringify(r.j));
  const dep = r.j.request.id;
  ok(await balance() === 0, 'solde inchangé tant que l\'admin n\'a pas validé');
  r = await co(users.buyer.token, { action: 'deposit', amount: 5000 });
  ok(r.status === 403, 'un acheteur ne peut pas recharger', String(r.status));
  r = await api('/api/admin/companies', adminToken, { action: 'confirm_deposit', id: dep });
  ok(r.status === 200 && await balance() === 5000, 'recharge validée : solde 5 000', JSON.stringify(r.j));
  r = await api('/api/admin/companies', adminToken, { action: 'confirm_deposit', id: dep });
  ok(r.status === 409 && await balance() === 5000, 'double validation impossible (pas de double crédit)', String(r.status));

  console.log('\n5) Commande au nom de la société');
  r = await api('/api/orders', users.buyer.token, { company: { site_id: siteId }, order: { payment_method: 'company_wallet', ...DEL.fields }, items: [line(2)] });
  ok(r.status === 200 && r.j.order?.company_id === state.company && r.j.order?.payment_method === 'company_wallet', 'commande de l\'acheteur acceptée', JSON.stringify(r.j).slice(0, 200));
  const o1 = r.j.order?.id;
  ok(/TEST Société/.test(r.j.order?.customer_name || '') && r.j.order?.address === 'Quartier Test, Djibouti', 'adresse et destinataire repris du site', r.j.order?.customer_name);
  ok(await balance() === 3000 - DEL.price && await stockOf(P.id) === 48, 'cagnotte 5 000 → 3 000 moins la livraison, stock 50 → 48', `${await balance()} / ${await stockOf(P.id)}`);
  r = await api('/api/orders', users.buyer.token, { company: { site_id: siteId }, order: { payment_method: 'company_wallet', ...DEL.fields }, items: [line(4)] });
  ok(r.status === 400 && r.j.error === 'company_wallet_insufficient' && await stockOf(P.id) === 48, 'solde insuffisant : refusée, stock intact', JSON.stringify(r.j));
  r = await api('/api/orders', users.accountant.token, { company: { site_id: siteId }, order: { payment_method: 'company_wallet' }, items: [line(1)] });
  ok(r.status === 403, 'un comptable ne peut pas commander', String(r.status));
  r = await api('/api/orders', users.outsider.token, { company: { site_id: siteId }, order: { payment_method: 'company_wallet' }, items: [line(1)] });
  ok(r.status === 403 && await balance() === 3000 - DEL.price, 'un étranger ne peut pas utiliser la cagnotte de la société', String(r.status));

  console.log('\n6) Identité à la commande (faille corrigée)');
  r = await api('/api/orders', null, { order: { user_id: users.manager.id, payment_method: 'cash', total: 1000, customer_name: 'X', phone: '77000000', address: 'X' }, items: [line(1)] });
  ok(r.status === 401 && r.j.error === 'identity_mismatch', 'commander au nom d\'un autre sans jeton : refusé', JSON.stringify(r.j));
  r = await api('/api/orders', users.outsider.token, { order: { user_id: users.manager.id, payment_method: 'wallet', total: 1000, customer_name: 'X', phone: '77000000', address: 'X' }, items: [line(1)] });
  ok(r.status === 401, 'débiter la cagnotte d\'un autre : refusé', String(r.status));
  r = await api('/api/orders', null, { order: { user_id: null, payment_method: 'cash', status: 'delivered', total: 1, ...DEL.fields, customer_name: 'Test Invité', phone: '77000000', address: 'Test' }, items: [line(1)] });
  ok(r.status === 200 && r.j.order?.status === 'pending' && Number(r.j.order?.total) === 1000 + DEL.price, 'invité : statut et total imposés par le serveur', JSON.stringify(r.j).slice(0, 160));

  console.log('\n7) Seuil de validation par le gérant');
  await api('/api/admin/companies', adminToken, { action: 'adjust_wallet', company_id: state.company, amount: 20000, note: 'TEST' });
  await co(users.manager.token, { action: 'update_company', approval_threshold: 2500 });
  r = await api('/api/orders', users.buyer.token, { company: { site_id: siteId }, order: { payment_method: 'company_wallet', ...DEL.fields }, items: [line(3)] });
  ok(r.status === 409 && r.j.error === 'approval_required', 'acheteur au-delà du seuil : validation requise', JSON.stringify(r.j));
  const balBefore = await balance(), stockBefore = await stockOf(P.id);
  r = await co(users.buyer.token, { action: 'order_request', site_id: siteId, items: [line(3)], delivery: { fee: DEL.price, option_name: DEL.name } });
  ok(r.status === 200 && await balance() === balBefore && await stockOf(P.id) === stockBefore, 'demande enregistrée : rien débité ni réservé', JSON.stringify(r.j).slice(0, 120));
  const reqId = r.j.request.id;
  r = await co(users.buyer.token, { action: 'decide_request', id: reqId, decision: 'approve' });
  ok(r.status === 403, 'l\'acheteur ne peut pas valider sa propre demande', String(r.status));
  r = await co(users.manager.token, { action: 'decide_request', id: reqId, decision: 'approve' });
  ok(r.status === 200 && r.j.order?.id, 'gérant valide : commande créée', JSON.stringify(r.j).slice(0, 200));
  const { data: o2 } = await admin.from('orders').select('user_id, total').eq('id', r.j.order.id).single();
  ok(o2.user_id === users.buyer.id && Number(o2.total) === 3000 + DEL.price && await balance() === balBefore - 3000 - DEL.price, 'commande au nom de l\'acheteur, cagnotte débitée de 3 000 plus la livraison', JSON.stringify(o2));
  r = await co(users.manager.token, { action: 'decide_request', id: reqId, decision: 'approve' });
  ok(r.status === 409, 'une demande ne peut être validée qu\'une fois', String(r.status));
  r = await api('/api/orders', users.manager.token, { company: { site_id: siteId }, order: { payment_method: 'company_wallet', ...DEL.fields }, items: [line(3)] });
  ok(r.status === 200, 'le gérant commande sans validation');

  console.log('\n8) Annulation → remboursement sur la cagnotte société');
  const b8 = await balance();
  r = await api('/api/orders', adminToken, { id: o1, status: 'cancelled' }, 'PATCH');
  ok(r.status === 200 && await balance() === b8 + 2000 + DEL.price, 'commande de 2 000 (plus livraison) annulée : cagnotte recréditée', `${r.status} ${await balance()}`);

  console.log('\n9) Visibilité par rôle et RLS');
  r = await co(users.buyer.token);
  ok(r.j.orders.every(o => o.user_id === users.buyer.id) && r.j.transactions.length === 0, 'acheteur : ses commandes seulement, pas les mouvements');
  r = await co(users.accountant.token);
  ok(r.j.orders.length >= 3 && r.j.transactions.length > 0, 'comptable : toutes les commandes et les mouvements');
  const asUser = (token) => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const out = await asUser(users.outsider.token).from('company_wallets').select('*').eq('company_id', state.company);
  ok((out.data || []).length === 0, 'RLS : un étranger ne lit pas la cagnotte');
  const mine = await asUser(users.buyer.token).from('company_wallets').select('balance').eq('company_id', state.company);
  ok((mine.data || []).length === 1, 'RLS : un membre lit le solde');
  const w = await asUser(users.manager.token).from('company_wallets').update({ balance: 999999 }).eq('company_id', state.company).select();
  ok((w.data || []).length === 0 && await balance() !== 999999, 'RLS : même le gérant ne modifie pas le solde directement');

  console.log('\n10) Commande récurrente + rappel de la veille');
  const tomorrow = new Date(Date.now() + 86400000);
  r = await co(users.buyer.token, { action: 'save_subscription', frequency: 'weekly', delivery_day: tomorrow.getUTCDay(), site_id: siteId, active: true, items: [{ product_id: P.id, quantity: 2 }] });
  ok(r.status === 403, 'un acheteur ne peut pas programmer la commande récurrente', String(r.status));
  r = await co(users.manager.token, { action: 'save_subscription', frequency: 'weekly', delivery_day: tomorrow.getUTCDay(), site_id: siteId, active: true, items: [{ product_id: P.id, quantity: 2 }] });
  ok(r.status === 200, 'commande récurrente enregistrée par le gérant', JSON.stringify(r.j));
  r = await api(`/api/cron/deliveries?only=reminders&company=${state.company}`, cronHeaders.Authorization?.replace('Bearer ', '') || null);
  const rem = r.j.companies?.reminders?.reminders?.[0];
  ok(rem && rem.kind === 'ok' && rem.total === 2000, 'rappel J-1 : 2 000 Fdj, solde suffisant', JSON.stringify(r.j).slice(0, 300));
  r = await api(`/api/cron/deliveries?only=reminders&company=${state.company}`, cronHeaders.Authorization?.replace('Bearer ', '') || null);
  ok((r.j.companies?.reminders?.reminders || []).length === 0, 'rappel envoyé une seule fois');

  console.log('\n11) Suspension');
  await api('/api/admin/companies', adminToken, { action: 'suspend', company_id: state.company, note: 'TEST' });
  r = await api('/api/orders', users.manager.token, { company: { site_id: siteId }, order: { payment_method: 'company_wallet' }, items: [line(1)] });
  ok(r.status === 403 && r.j.error === 'company_inactive', 'société suspendue : commande refusée, solde conservé', JSON.stringify(r.j));
} catch (e) { fail++; console.error('  ❌ exception', e); }

console.log(`\n${pass} OK / ${fail} KO\n\n🧹 Nettoyage`);
try {
  const { data: coOrders } = state.company ? await admin.from('orders').select('id').eq('company_id', state.company) : { data: [] };
  for (const oid of new Set([...state.orders, ...(coOrders || []).map(o => o.id)])) { await admin.from('order_refunds').delete().eq('order_id', oid); await admin.from('order_items').delete().eq('order_id', oid); await admin.from('orders').delete().eq('id', oid); }
  if (state.company) await admin.from('companies').delete().eq('id', state.company);   // cascade : membres, sites, cagnotte, demandes…
  for (const pid of state.products) await admin.from('products').delete().eq('id', pid);
  for (const u of Object.values(users)) { await admin.from('user_notifications').delete().eq('user_id', u.id); await admin.from('profiles').delete().eq('id', u.id).then(() => {}, () => {}); await admin.auth.admin.deleteUser(u.id); }
  if (state.minBefore != null) await admin.from('app_settings').update({ value_num: state.minBefore }).eq('key', 'company.min_topup');
  if (state.preparers.length) await admin.from('preparers').update({ is_active: true }).in('id', state.preparers);
  console.log('  société, comptes, produit et commandes de test supprimés ; réglage et préparateurs rétablis');
} catch (e) { console.error('  ⚠️ nettoyage incomplet', e); }
process.exit(fail ? 1 : 0);
