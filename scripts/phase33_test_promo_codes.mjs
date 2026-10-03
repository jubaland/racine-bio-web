// Test non destructif des codes promo « livraison offerte » (phase 33). Serveur local requis (port 3000).
// Comptes, produit, codes (préfixe T33) et commandes temporaires, supprimés à la fin. Préparateurs
// désactivés pendant le test. Le seuil automatique n'est activé qu'un instant, avec un montant hors
// d'atteinte, puis rétabli.
//   node scripts/phase33_test_promo_codes.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { computeDelivery, NO_RULES } from '../lib/delivery-pricing.ts';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const BASE = process.argv[2] || 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label} ${extra}`); } };
const stamp = Date.now();
const tag = String(stamp).slice(-6);
const state = { users: [], products: [], orders: [], preparers: [], rules: null };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const tokenFor = async (email) => {
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const { data: v } = await anon().auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  return v.session.access_token;
};
const api = async (path, token, body, method = body ? 'POST' : 'GET') => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch { /* ignore */ }
  if (j?.order?.id) state.orders.push(j.order.id);
  return { status: r.status, j };
};
let n = 0;
const mkUser = async (name) => {
  const email = `test-promo-${name}-${stamp}@example.com`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: `Tmp-${stamp}!${name}`, email_confirm: true, user_metadata: { full_name: `Test Promo ${name}` } });
  if (error) throw error;
  state.users.push(u.user.id);
  // Téléphone fictif propre à chaque compte (les règles « première commande » regardent aussi le téléphone)
  return { id: u.user.id, email, token: await tokenFor(email), phone: `77${String(stamp).slice(-5)}${n++}` };
};

try {
  console.log('\n1) Calcul des frais (fonction partagée navigateur / serveur)');
  const calc = (o) => computeDelivery({ base: 500, standardPrice: 500, subtotal: 2000, rules: NO_RULES, ...o });
  let q = calc({});
  ok(q.fee === 500 && q.discount === 0 && q.source === null, 'sans remise : tarif plein');
  q = calc({ rules: { free_threshold: 2000, threshold_scope: 'standard' } });
  ok(q.fee === 0 && q.source === 'threshold', 'seuil atteint : livraison offerte');
  q = calc({ rules: { free_threshold: 3000, threshold_scope: 'standard' } });
  ok(q.fee === 500 && q.threshold_remaining === 1000, 'seuil non atteint : il manque 1 000 Fdj');
  q = calc({ base: 1000, promo: { code: 'X', scope: 'standard', max_discount: null, min_subtotal: null } });
  ok(q.fee === 500 && q.discount === 500 && q.source === 'promo', 'code « standard » sur une option à 1 000 : 500 offerts, 500 à payer');
  q = calc({ base: 1000, promo: { code: 'X', scope: 'all', max_discount: 300, min_subtotal: null } });
  ok(q.fee === 700 && q.discount === 300, 'code « toute option » plafonné à 300');
  q = calc({ promo: { code: 'X', scope: 'all', max_discount: null, min_subtotal: 5000 } });
  ok(q.fee === 500 && q.promo_missing === 3000 && q.source === null, 'panier minimum non atteint : pas de remise, 3 000 manquants');
  q = calc({ rules: { free_threshold: 1000, threshold_scope: 'standard' }, promo: { code: 'X', scope: 'standard', max_discount: null, min_subtotal: null }, referralCredit: true });
  ok(q.source === 'threshold' && q.promo_code === null && q.discount === 500, 'pas de cumul ; à remise égale le seuil passe avant le code et le crédit');
  q = calc({ base: 1000, referralCode: true });
  ok(q.fee === 500 && q.source === 'referral_code', 'parrainage : montant de la livraison standard');
  q = computeDelivery({ base: 500, standardPrice: null, subtotal: 2000, rules: NO_RULES, referralCode: true });
  ok(q.fee === 500, 'aucune option « standard » définie : le parrainage ne retire rien');

  // ── Préparation ──────────────────────────────────────────────────────────────────
  const { data: preps } = await admin.from('preparers').select('id').eq('is_active', true);
  state.preparers = (preps || []).map(p => p.id);
  if (state.preparers.length) await admin.from('preparers').update({ is_active: false }).in('id', state.preparers);
  const { data: opts } = await admin.from('delivery_options').select('id, name, price, is_standard').eq('is_active', true).order('sort_order');
  const STD = (opts || []).find(o => o.is_standard);
  const OTHER = (opts || []).find(o => !o.is_standard && o.price > 0 && o.price !== STD?.price);
  if (!STD || !(STD.price > 0)) throw new Error('aucune option de livraison standard payante : test impossible');
  const adminToken = await tokenFor('wilsandj@hotmail.com');
  const { data: P, error: pe } = await admin.from('products').insert({ name: 'TEST Promo produit', price: 1000, cost_price: 600, unit: 'kg', stock_qty: 300, farm: 'Test', category: 'legumes', product_type: 'conventionnel', origin_country: 'DJ', region: 'Test', status: 'published', is_local: false, in_stock: true, description: 'TEST PROMO — à supprimer', bg_color: '#ecf4d5' }).select('id').single();
  if (pe) throw pe;
  state.products.push(P.id);
  const [A, B, C, D, R] = [await mkUser('a'), await mkUser('b'), await mkUser('c'), await mkUser('d'), await mkUser('r')];
  const GUEST = { phone: `77${String(stamp).slice(-5)}9` };

  const order = (u, extra = {}, o = {}, qty = 1) => api('/api/orders', u?.token ?? null, {
    // Le navigateur « triche » : il annonce une livraison à 0 et un total de 1 Fdj
    order: { user_id: u?.id ?? null, payment_method: 'cash', customer_name: 'Test Promo', phone: u?.phone ?? GUEST.phone, address: 'Test', delivery_option_id: STD.id, delivery_option_name: STD.name, delivery_fee: 0, total: 1, ...o },
    items: [{ product_id: P.id, quantity: qty, price: 1, product_name: 'TEST Promo produit', product_unit: 'kg' }],
    ...extra,
  });
  const pc = (body) => api('/api/admin/promo-codes', adminToken, body);
  const check = (u, code, phone) => api('/api/promo', u?.token ?? null, { code, phone: phone ?? u?.phone ?? null });
  const codeRow = async (code) => (await admin.from('promo_codes').select('*').eq('code', code).maybeSingle()).data;
  const overview = async (code) => ((await api('/api/admin/promo-codes', adminToken)).j.codes || []).find(c => c.code === code);

  console.log('\n2) Frais calculés par le serveur (sans code)');
  let r = await order(B);
  ok(r.status === 200 && r.j.order.delivery_fee === STD.price && Number(r.j.order.total) === 1000 + STD.price && r.j.order.delivery_discount === 0,
    'livraison à 0 annoncée par le navigateur : le serveur facture le tarif de l\'option', JSON.stringify(r.j).slice(0, 200));
  const orderB1 = r.j.order?.id;
  r = await order(B, {}, { delivery_option_id: null, delivery_option_name: 'Option inventée' });
  ok(r.status === 400 && r.j.error === 'delivery_option_invalid', 'option de livraison inventée : refus', JSON.stringify(r.j));
  r = await order(B, {}, { delivery_option_id: null, delivery_option_name: null });
  ok(r.status === 400 && r.j.error === 'delivery_option_invalid', 'aucune option choisie : refus', JSON.stringify(r.j));

  console.log('\n3) Création des codes (admin)');
  const C1 = `T33A${tag}`, C2 = `T33B${tag}`, C3 = `T33C${tag}`, C4 = `T33D${tag}`, C5 = `T33E${tag}`, C6 = `T33F${tag}`, C7 = `T33G${tag}`;
  r = await pc({ action: 'save', code: 'ab' });
  ok(r.status === 400 && r.j.error === 'code_format', 'code trop court refusé');
  r = await pc({ action: 'save', code: 'AVEC ESPACE' });
  ok(r.status === 400 && r.j.error === 'code_format', 'code avec espace refusé');
  r = await pc({ action: 'save', code: C1, max_uses: 0 });
  ok(r.status === 400 && r.j.error === 'number_invalid', 'limite à 0 refusée');
  r = await pc({ action: 'save', code: C1, min_subtotal: 12.5 });
  ok(r.status === 400 && r.j.error === 'number_invalid', 'montant non entier refusé');
  r = await pc({ action: 'save', code: C1, starts_at: new Date(Date.now() + 2 * 86400000).toISOString(), ends_at: new Date(Date.now() + 86400000).toISOString() });
  ok(r.status === 400 && r.j.error === 'date_order', 'fin avant le début refusée');
  r = await pc({ action: 'save', code: C1, ends_at: new Date(Date.now() - 3600000).toISOString() });
  ok(r.status === 400 && r.j.error === 'date_past', 'date de fin déjà passée refusée');
  r = await pc({ action: 'save', code: C1, user_email: `inconnu-${stamp}@example.com` });
  ok(r.status === 400 && r.j.error === 'user_not_found', 'code personnel pour un e-mail inconnu refusé');
  r = await pc({ action: 'save', code: C1, label: 'TEST campagne', max_uses: 2, max_uses_per_user: 1 });
  ok(r.status === 200 && (r.j.codes || []).some(c => c.code === C1 && c.uses === 0), 'code de campagne créé (2 utilisations, 1 par client)', JSON.stringify(r.j).slice(0, 200));
  r = await pc({ action: 'save', code: C1 });
  ok(r.status === 409 && r.j.error === 'code_taken', 'doublon refusé');
  const refR = (await api('/api/referral', R.token)).j.code;   // code parrainage de R
  r = await pc({ action: 'save', code: refR });
  ok(r.status === 409 && r.j.error === 'code_taken', 'code identique à un code parrainage refusé', JSON.stringify(r.j));

  console.log('\n4) Utilisation au paiement');
  r = await check(A, `T33ZZ${tag}`);
  ok(r.j.valid === false && r.j.reason === 'unknown', 'code inconnu : invalide');
  r = await check(A, C1.toLowerCase());
  ok(r.j.valid === true && r.j.kind === 'promo' && r.j.promo?.code === C1, 'code reconnu (saisie en minuscules acceptée)', JSON.stringify(r.j));
  r = await order(A, { promo_code: C1 });
  ok(r.status === 200 && r.j.order.delivery_fee === 0 && r.j.order.delivery_fee_base === STD.price && r.j.order.delivery_discount === STD.price
    && r.j.order.delivery_discount_source === 'promo' && r.j.order.promo_code === C1 && Number(r.j.order.total) === 1000,
    'commande avec le code : livraison offerte, total = articles, remise tracée sur la commande', JSON.stringify(r.j.order || r.j).slice(0, 300));
  let ov = await overview(C1);
  ok(ov?.uses === 1 && ov?.amount_offered === STD.price, 'admin : 1 utilisation, montant offert comptabilisé', JSON.stringify(ov));
  r = await order(A, { promo_code: C1 });
  ok(r.status === 409 && r.j.error === 'promo_invalid' && r.j.reason === 'per_user_limit', 'même client une 2e fois : refusé (1 par client)', JSON.stringify(r.j));
  r = await order(null, { promo_code: C1 }, { phone: A.phone });
  ok(r.status === 409 && r.j.reason === 'per_user_limit', 'même téléphone sans compte : refusé aussi', JSON.stringify(r.j));
  r = await order(B, { promo_code: C1 });
  const orderB2 = r.j.order?.id;
  ok(r.status === 200 && r.j.order.delivery_fee === 0, 'autre client : accepté (2e et dernière utilisation)');
  r = await check(C, C1);
  ok(r.j.valid === false && r.j.reason === 'exhausted', 'code épuisé : annoncé dès la saisie', JSON.stringify(r.j));
  r = await order(C, { promo_code: C1 });
  ok(r.status === 409 && r.j.reason === 'exhausted', 'code épuisé : commande refusée plutôt que facturée sans prévenir', JSON.stringify(r.j));
  const { data: pBefore } = await admin.from('products').select('stock_qty').eq('id', P.id).single();
  r = await api('/api/orders', adminToken, { id: orderB2, status: 'cancelled' }, 'PATCH');
  ok(r.status === 200, 'commande de B annulée', JSON.stringify(r.j).slice(0, 150));
  r = await check(C, C1);
  ok(r.j.valid === true, 'commande annulée : l\'utilisation est rendue', JSON.stringify(r.j));
  const { data: pAfter } = await admin.from('products').select('stock_qty').eq('id', P.id).single();
  ok(pAfter.stock_qty === pBefore.stock_qty + 1, 'stock rendu par l\'annulation');

  console.log('\n5) Conditions d\'un code');
  await pc({ action: 'save', code: C2, first_order_only: true });
  r = await check(A, C2);
  ok(r.j.valid === false && r.j.reason === 'first_order_only', 'première commande seulement : refusé à un client qui a déjà commandé');
  r = await check(C, C2);
  ok(r.j.valid === true, 'première commande seulement : accepté pour un nouveau client');
  r = await check(null, C2, A.phone);
  ok(r.j.valid === false && r.j.reason === 'first_order_only', 'sans compte, téléphone déjà client : refusé');
  await pc({ action: 'save', code: C3, user_email: C.email });
  r = await check(A, C3);
  ok(r.j.valid === false && r.j.reason === 'unknown', 'code personnel : inconnu pour un autre client');
  r = await check(null, C3, GUEST.phone);
  ok(r.j.valid === false && r.j.reason === 'login_required', 'code personnel : connexion demandée à un visiteur');
  r = await check(C, C3);
  ok(r.j.valid === true, 'code personnel : accepté pour son destinataire');
  await pc({ action: 'save', code: C4, starts_at: new Date(Date.now() + 86400000).toISOString() });
  r = await check(C, C4);
  ok(r.j.valid === false && r.j.reason === 'not_started', 'code pas encore valable');
  await admin.from('promo_codes').update({ starts_at: null, ends_at: new Date(Date.now() - 60000).toISOString() }).eq('code', C4);
  r = await check(C, C4);
  ok(r.j.valid === false && r.j.reason === 'expired', 'code expiré');
  r = await order(C, { promo_code: C4 });
  ok(r.status === 409 && r.j.reason === 'expired', 'code expiré : commande refusée');
  const c3 = await codeRow(C3);
  r = await pc({ action: 'toggle', id: c3.id, active: false });
  r = await check(C, C3);
  ok(r.j.valid === false && r.j.reason === 'inactive', 'code désactivé par l\'admin');
  await pc({ action: 'save', code: C5, min_subtotal: 5000 });
  r = await order(C, { promo_code: C5 });
  ok(r.status === 200 && r.j.order.delivery_fee === STD.price && r.j.order.delivery_discount === 0 && r.j.order.promo_code === null,
    'panier sous le minimum : commande acceptée au tarif plein, code non consommé', JSON.stringify(r.j.order || r.j).slice(0, 200));
  ov = await overview(C5);
  ok(ov?.uses === 0, 'aucune utilisation enregistrée pour ce code');
  r = await order(C, { promo_code: C5 }, {}, 5);
  ok(r.status === 200 && r.j.order.delivery_fee === 0 && r.j.order.promo_code === C5, 'panier au minimum : livraison offerte');
  await pc({ action: 'save', code: C6, scope: 'all', max_discount: 300 });
  r = await order(D, { promo_code: C6 });
  ok(r.status === 200 && r.j.order.delivery_fee === STD.price - Math.min(300, STD.price) && r.j.order.delivery_discount === Math.min(300, STD.price),
    'code plafonné à 300 Fdj : le reste de la livraison est facturé', JSON.stringify(r.j.order || r.j).slice(0, 200));
  if (OTHER) {
    r = await order(D, { promo_code: C5 }, { delivery_option_id: OTHER.id, delivery_option_name: OTHER.name }, 5);
    const expected = Math.min(OTHER.price, STD.price);
    ok(r.status === 200 && r.j.order.delivery_fee_base === OTHER.price && r.j.order.delivery_discount === expected && r.j.order.delivery_option_name === OTHER.name,
      `autre option (${OTHER.name}) : remise limitée au tarif standard`, JSON.stringify(r.j.order || r.j).slice(0, 200));
  }

  console.log('\n6) Deux commandes simultanées sur la dernière utilisation');
  await pc({ action: 'save', code: C7, max_uses: 1 });
  const [x, y] = await Promise.all([order(A, { promo_code: C7 }), order(B, { promo_code: C7 })]);
  const wins = [x, y].filter(z => z.status === 200 && z.j.order.promo_code === C7).length;
  const lost = [x, y].filter(z => z.status === 409 && z.j.error === 'promo_invalid').length;
  ok(wins === 1 && lost === 1, 'une seule commande obtient le code, l\'autre est refusée', `${x.status}/${y.status}`);
  const { data: pRace } = await admin.from('products').select('stock_qty').eq('id', P.id).single();
  const { count: live } = await admin.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', P.id);
  const { data: liveItems } = await admin.from('order_items').select('quantity, orders!inner ( status )').eq('product_id', P.id);
  const sold = (liveItems || []).filter(i => i.orders.status !== 'cancelled').reduce((s, i) => s + Number(i.quantity), 0);
  ok(pRace.stock_qty === 300 - sold, 'stock cohérent : la commande refusée n\'a rien réservé', `${pRace.stock_qty} vs ${300 - sold} (${live} lignes)`);

  console.log('\n7) Parrainage : mêmes règles, vérifiées par le serveur');
  r = await check(R, refR);
  ok(r.j.valid === false && r.j.kind === 'referral' && r.j.reason === 'own_code', 'son propre code parrainage : refusé');
  const E = await mkUser('e');
  r = await check(E, refR);
  ok(r.j.valid === true && r.j.kind === 'referral', 'code parrainage reconnu dans le même champ');
  r = await order(E, { ref_code: refR });
  ok(r.status === 200 && r.j.order.delivery_fee === 0 && r.j.order.delivery_discount_source === 'referral_code', 'filleul, première commande : livraison offerte', JSON.stringify(r.j.order || r.j).slice(0, 200));
  let credits = 0;
  for (let i = 0; i < 20 && credits < 1; i++) { await sleep(500); credits = (await admin.from('referral_codes').select('credits').eq('user_id', R.id).maybeSingle()).data?.credits || 0; }
  ok(credits === 1, 'le parrain reçoit un crédit', String(credits));
  r = await order(E, { ref_code: refR });
  ok(r.status === 409 && r.j.error === 'referral_invalid' && r.j.reason === 'first_order_only', 'filleul, 2e commande avec le code : refusée', JSON.stringify(r.j));
  r = await order(R, { use_referral_credit: true });
  ok(r.status === 200 && r.j.order.delivery_fee === 0 && r.j.order.delivery_discount_source === 'referral_credit', 'parrain : crédit utilisé, livraison offerte');
  credits = (await admin.from('referral_codes').select('credits').eq('user_id', R.id).maybeSingle()).data?.credits;
  ok(credits === 0, 'crédit décompté', String(credits));
  r = await order(R, { use_referral_credit: true });
  ok(r.status === 200 && r.j.order.delivery_fee === STD.price, 'plus de crédit : tarif plein, même si le navigateur le réclame');

  console.log('\n8) Seuil automatique');
  const before = (await api('/api/promo', null)).j.rules;
  state.rules = before;
  r = await pc({ action: 'save_rules', free_threshold: -5, threshold_scope: 'standard' });
  ok(r.status === 400 && r.j.error === 'threshold_invalid', 'seuil négatif refusé');
  r = await pc({ action: 'save_rules', free_threshold: 'abc', threshold_scope: 'standard' });
  ok(r.status === 400, 'seuil non numérique refusé');
  r = await pc({ action: 'save_rules', free_threshold: 9999999, threshold_scope: 'all' });   // hors d'atteinte : aucun client réel concerné
  const during = (await api('/api/promo', null)).j.rules;
  await pc({ action: 'save_rules', free_threshold: before.free_threshold ?? '', threshold_scope: before.threshold_scope });
  ok(r.status === 200 && during.free_threshold === 9999999 && during.threshold_scope === 'all', 'seuil enregistré et lu par le site', JSON.stringify(during));
  const after = (await api('/api/promo', null)).j.rules;
  ok(after.free_threshold === before.free_threshold && after.threshold_scope === before.threshold_scope, 'réglage rétabli', JSON.stringify(after));

  console.log('\n9) Suivi et droits');
  r = await api('/api/orders', adminToken);
  const listed = (r.j.orders || []).find(o => o.promo_code === C1 && o.status !== 'cancelled');
  ok(!!listed && listed.delivery_discount === STD.price && listed.delivery_discount_source === 'promo', 'liste admin des commandes : code et montant offert visibles', JSON.stringify(listed || Object.keys(r.j)).slice(0, 200));
  const c1 = await codeRow(C1), c2 = await codeRow(C2);
  r = await pc({ action: 'delete', id: c1.id });
  ok(r.status === 409 && r.j.error === 'code_used', 'code déjà utilisé : suppression refusée (désactivation à la place)');
  r = await pc({ action: 'delete', id: c2.id });
  ok(r.status === 200 && !(r.j.codes || []).some(c => c.code === C2), 'code jamais utilisé : supprimé');
  r = await api('/api/admin/promo-codes', A.token);
  ok(r.status === 401 || r.status === 403, 'un client ne voit pas les codes', String(r.status));
  r = await api('/api/admin/promo-codes', A.token, { action: 'save', code: `T33H${tag}` });
  ok(r.status === 401 || r.status === 403, 'un client ne crée pas de code', String(r.status));
  const viaBrowser = await anon().from('promo_codes').select('code').limit(5);
  ok(!viaBrowser.error ? (viaBrowser.data || []).length === 0 : true, 'les codes ne sont pas lisibles depuis le navigateur', JSON.stringify(viaBrowser.data));
  const rpc = await anon().rpc('promo_redeem', { p_promo: c1.id, p_user: null, p_phone: null, p_amount: 0 });
  ok(!!rpc.error, 'la fonction de réservation n\'est pas appelable depuis le navigateur', JSON.stringify(rpc.data));
} catch (e) {
  fail++; console.error('\n💥 Erreur inattendue :', e);
} finally {
  console.log('\nNettoyage…');
  try {
    if (state.rules) await admin.from('app_settings').upsert([
      { key: 'delivery.free_threshold', value_num: state.rules.free_threshold, value_text: null, updated_at: new Date().toISOString() },
      { key: 'delivery.free_threshold_scope', value_num: null, value_text: state.rules.threshold_scope, updated_at: new Date().toISOString() },
    ], { onConflict: 'key' });
    const { data: its } = state.products.length ? await admin.from('order_items').select('order_id').in('product_id', state.products) : { data: [] };
    const oids = [...new Set([...(its || []).map(i => i.order_id), ...state.orders])];
    if (oids.length) {
      await admin.from('referrals').delete().in('order_id', oids.map(String));
      await admin.from('loyalty_stamps').delete().in('order_id', oids);
      await admin.from('order_items').delete().in('order_id', oids);
      await admin.from('orders').delete().in('id', oids);   // les utilisations de code partent avec (cascade)
    }
    const { data: tcodes } = await admin.from('promo_codes').select('id').like('code', `T33%${tag}`);
    if (tcodes?.length) {
      await admin.from('promo_redemptions').delete().in('promo_id', tcodes.map(c => c.id));
      await admin.from('promo_codes').delete().in('id', tcodes.map(c => c.id));
    }
    if (state.products.length) await admin.from('products').delete().in('id', state.products);
    for (const id of state.users) {
      await admin.from('referrals').delete().or(`referrer_id.eq.${id},referee_id.eq.${id}`);
      await admin.from('referral_codes').delete().eq('user_id', id);
      await admin.from('user_notifications').delete().eq('user_id', id);
      await admin.from('loyalty_stamps').delete().eq('user_id', id);
      await admin.from('profiles').delete().eq('id', id);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) ok(false, 'compte temporaire supprimé', error.message);
    }
    if (state.preparers.length) await admin.from('preparers').update({ is_active: true }).in('id', state.preparers);
    const leftP = (await admin.from('products').select('id', { count: 'exact', head: true }).ilike('name', 'TEST Promo%')).count;
    const leftC = (await admin.from('promo_codes').select('id', { count: 'exact', head: true }).like('code', `T33%${tag}`)).count;
    const leftO = (await admin.from('orders').select('id', { count: 'exact', head: true }).eq('customer_name', 'Test Promo')).count;
    ok(leftP === 0 && leftC === 0 && leftO === 0, 'produit, codes et commandes de test supprimés', `${leftP}/${leftC}/${leftO}`);
  } catch (e) { fail++; console.error('Nettoyage incomplet :', e); }
  console.log(`\n${pass} réussis, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
}
