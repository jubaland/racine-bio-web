// Test non destructif : surveillance des erreurs, tableau de bord du jour, aperçu des e-mails,
// recherche tolérante, recommander une commande. Serveur local requis (port 3000).
// Les alertes sont COUPÉES pendant le test (aucune notification à l'admin), puis les réglages sont
// rétablis. Les erreurs créées par le test sont supprimées du journal.
//   node scripts/phase26_test_monitoring.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { norm, distance, tolerance, buildIndex, searchScores } from '../lib/search.ts';
import { planReorder } from '../lib/reorder.ts';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const BASE = process.argv[2] || 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label} ${extra}`); } };
const stamp = Date.now();
const TAG = `TEST-SURVEILLANCE-${stamp}`;
const state = { user: null, before: [], deposit: null, startedAt: new Date().toISOString() };

const tokenFor = async (email) => {
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const { data: v } = await anon().auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  return v.session.access_token;
};
const api = async (path, token, body, method = body ? 'POST' : 'GET', raw = false) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? (raw ? body : JSON.stringify(body)) : undefined });
  let j = {}; try { j = await r.json(); } catch { /* ignore */ }
  return { status: r.status, j };
};
const rowsLike = async (pattern) => (await admin.from('error_logs').select('*').ilike('message', pattern).order('id')).data || [];

try {
  state.before = (await admin.from('app_settings').select('key, value_num').like('key', 'monitor.%')).data || [];
  const email = `test-surveillance-${stamp}@example.com`;
  const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password: `Tmp-${stamp}!s`, email_confirm: true, user_metadata: { full_name: 'Test Surveillance' } });
  if (ue) throw ue;
  state.user = { id: u.user.id, email, token: await tokenFor(email) };
  const adminToken = await tokenFor('wilsandj@hotmail.com');
  const C = state.user.token;
  const mon = (body) => api('/api/admin/monitoring', adminToken, body);

  console.log('\n1) Surveillance : droits et réglages');
  let r = await api('/api/admin/monitoring', C);
  ok(r.status === 401 || r.status === 403, 'un client ne voit pas le journal des erreurs', String(r.status));
  r = await api('/api/admin/monitoring', C, { action: 'resolve_all' });
  ok(r.status === 401 || r.status === 403, 'un client ne peut rien résoudre', String(r.status));
  r = await mon({ action: 'save_settings', alert_cooldown_min: 0 });
  ok(r.status === 400, 'délai nul refusé', String(r.status));
  r = await mon({ action: 'save_settings', retention_days: 2.5 });
  ok(r.status === 400, 'durée non entière refusée', String(r.status));
  // Alertes coupées pour tout le test : rien ne part vers l'admin
  r = await mon({ action: 'save_settings', alert_enabled: false, alert_email: false, alert_client: false, client_enabled: true, alert_cooldown_min: 60, retention_days: 30 });
  ok(r.status === 200 && r.j.settings?.alert_enabled === false && r.j.settings?.alert_cooldown_min === 60, 'réglages enregistrés, alertes coupées pendant le test', JSON.stringify(r.j.settings));
  const notifBefore = (await admin.from('admin_notifications').select('id', { count: 'exact', head: true })).count;

  console.log('\n2) Erreur du navigateur d\'un client');
  r = await api('/api/errors', C, { message: `${TAG} Cannot read properties of undefined (reading 'x') 12345`, stack: `TypeError: boom\n    at Page (https://www.hornafresh.com/_next/static/chunk.js?token=SECRET123:1:2)`, url: '/checkout?token=SECRET456', lang: 'en', viewport: '375x812', kind: 'error' });
  ok(r.status === 200 && r.j.recorded === true, 'erreur enregistrée', JSON.stringify(r.j));
  let rows = await rowsLike(`${TAG}%`);
  ok(rows.length === 1 && rows[0].source === 'client' && rows[0].count === 1 && rows[0].route === '/checkout' && rows[0].user_id === state.user.id, 'une ligne : source client, page /checkout, compte rattaché', JSON.stringify(rows.map(x => ({ s: x.source, r: x.route, c: x.count }))));
  ok(!JSON.stringify(rows[0]).includes('SECRET'), 'paramètres d\'adresse (jetons) jamais enregistrés', JSON.stringify(rows[0]).slice(0, 300));
  r = await api('/api/errors', C, { message: `${TAG} Cannot read properties of undefined (reading 'x') 99999`, stack: `TypeError: boom\n    at Page (https://www.hornafresh.com/_next/static/chunk.js:1:2)`, url: '/checkout' });
  rows = await rowsLike(`${TAG}%`);
  ok(rows.length === 1 && rows[0].count === 2, 'même erreur (seul un nombre change) : compteur à 2, pas de doublon', JSON.stringify(rows.map(x => x.count)));
  r = await api('/api/errors', null, { message: 'ResizeObserver loop limit exceeded' });
  ok(r.status === 200 && r.j.ignored === true, 'bruit connu du navigateur ignoré', JSON.stringify(r.j));
  r = await api('/api/errors', null, { message: '' });
  ok(r.status === 400, 'message vide refusé', String(r.status));
  r = await api('/api/errors', null, JSON.stringify({ message: 'x'.repeat(9000) }), 'POST', true);
  ok(r.status === 413, 'envoi trop volumineux refusé', String(r.status));
  await mon({ action: 'save_settings', client_enabled: false });
  r = await api('/api/errors', C, { message: `${TAG} erreur pendant la collecte coupée` });
  ok(r.j.ignored === true && (await rowsLike(`${TAG} erreur pendant%`)).length === 0, 'collecte coupée dans les réglages : rien n\'est enregistré');
  await mon({ action: 'save_settings', client_enabled: true });

  console.log('\n3) Erreur du serveur');
  r = await api('/api/lang', C, 'ceci n\'est pas du JSON', 'POST', true);
  ok(r.status === 500, 'route en échec : réponse 500', String(r.status));
  const { data: srv } = await admin.from('error_logs').select('*').eq('route', '/api/lang').is('resolved_at', null).gte('last_seen', state.startedAt);
  ok((srv || []).length === 1 && srv[0].source === 'server' && srv[0].method === 'POST' && srv[0].status === 500, 'réponse 500 enregistrée avec sa route et sa méthode', JSON.stringify((srv || []).map(x => ({ r: x.route, m: x.method, s: x.status }))));
  r = await mon({ action: 'test' });
  ok(r.status === 200 && r.j.is_new === true && r.j.alert === true, 'erreur d\'essai : nouvelle, alerte due', JSON.stringify(r.j));
  r = await mon({ action: 'test' });
  ok(r.status === 200 && r.j.is_new === false && r.j.alert === false && r.j.count === 2, 'même erreur dans le délai : comptée, pas de seconde alerte', JSON.stringify(r.j));
  ok((await admin.from('admin_notifications').select('id', { count: 'exact', head: true })).count === notifBefore, 'alertes coupées : aucune notification envoyée à l\'admin');

  console.log('\n4) Résolution');
  r = await api('/api/admin/monitoring?state=open', adminToken);
  const mine = (r.j.errors || []).find(e => e.message.startsWith(TAG));
  ok(r.status === 200 && !!mine && r.j.counts.open >= 3, 'journal : erreurs à traiter listées', JSON.stringify(r.j.counts));
  r = await mon({ action: 'resolve', id: mine.id });
  ok(r.status === 200 && (await rowsLike(`${TAG}%`))[0].resolved_at != null, 'erreur marquée résolue');
  await api('/api/errors', C, { message: `${TAG} Cannot read properties of undefined (reading 'x') 777`, stack: `TypeError: boom\n    at Page (https://www.hornafresh.com/_next/static/chunk.js:1:2)`, url: '/checkout' });
  rows = await rowsLike(`${TAG}%`);
  ok(rows.length === 2 && rows.filter(x => !x.resolved_at).length === 1 && rows.find(x => !x.resolved_at).count === 1, 'erreur résolue qui réapparaît : nouvelle ligne à traiter', JSON.stringify(rows.map(x => ({ c: x.count, r: !!x.resolved_at }))));
  r = await mon({ action: 'reopen', id: mine.id });
  ok(r.status === 409 && r.j.error === 'already_open', 'rouvrir l\'ancienne alors qu\'elle est revenue : refusé', `${r.status} ${r.j.error}`);
  r = await mon({ action: 'resolve', id: 999999999 });
  ok(r.status === 404, 'erreur inconnue : introuvable', String(r.status));

  console.log('\n5) Tableau de bord du jour');
  r = await api('/api/admin/today', C);
  ok(r.status === 401 || r.status === 403, 'réservé à l\'équipe', String(r.status));
  r = await api('/api/admin/today', null);
  ok(r.status === 401, 'sans connexion : refusé', String(r.status));
  r = await api('/api/admin/today', adminToken);
  const before = Object.fromEntries((r.j.items || []).map(i => [i.key, i]));
  ok(r.status === 200 && Array.isArray(r.j.items) && r.j.items.every(i => i.count > 0 && i.module && ['urgent', 'todo', 'info'].includes(i.level)), 'éléments à traiter : seulement ceux qui existent, avec module et niveau', JSON.stringify(r.j.items));
  ok(!!before.errors && before.errors.module === 'monitoring' && before.errors.level === 'urgent', 'les erreurs du site y figurent', JSON.stringify(before.errors));
  const levels = (r.j.items || []).map(i => ['urgent', 'todo', 'info'].indexOf(i.level));
  ok(levels.every((v, i) => i === 0 || levels[i - 1] <= v), 'urgent d\'abord, puis à traiter, puis à surveiller');
  const { data: dep } = await admin.from('deposit_requests').insert({ user_id: state.user.id, amount: 4321, reference: TAG, status: 'pending' }).select('id').single();
  state.deposit = dep.id;
  r = await api('/api/admin/today', adminToken);
  const d = (r.j.items || []).find(i => i.key === 'deposits');
  ok(!!d && d.count === (before.deposits?.count || 0) + 1 && d.amount === (before.deposits?.amount || 0) + 4321, 'nouvelle recharge à valider : comptée avec son montant', JSON.stringify(d));

  console.log('\n6) Aperçu des e-mails : catalogue');
  r = await api('/api/admin/email-preview?list=1', adminToken);
  const groups = new Set((r.j.kinds || []).map(k => k.group));
  ok(r.status === 200 && (r.j.kinds || []).length >= 20 && groups.has('customer') && groups.has('merchant'), 'catalogue des e-mails clients et marchands', String((r.j.kinds || []).length));
  r = await api('/api/admin/email-preview?list=1', C);
  ok(r.status === 401 || r.status === 403, 'réservé à l\'équipe', String(r.status));

  console.log('\n7) Recherche tolérante');
  const products = [
    { id: 1, name: 'Tomate', category: 'legumes', origin_country: 'ET' },
    { id: 2, name: 'Carrotte', category: 'legumes' },
    { id: 3, name: 'Orange de Somali-Land', category: 'fruits', origin_country: 'SO' },
    { id: 4, name: 'Orange Egypte', category: 'fruits', farm: 'Boutique Zak', shop_name: 'Boutique Zak' },
    { id: 5, name: 'Pomme de terre', category: 'legumes' },
    { id: 6, name: 'Pastèque', category: 'fruits' },
    { id: 7, name: 'Ognon', category: 'legumes' },
  ];
  const names = { 1: ['Tomato', '番茄', 'ቲማቲም', 'Yaanyo'], 2: ['Carrot', '胡萝卜'], 3: ['Orange from Somalia', '索马里橙子'], 5: ['Potato', '土豆'], 6: ['Watermelon', '西瓜'], 7: ['Onion'] };
  const cats = { legumes: ['Légumes', 'Vegetables', '蔬菜'], fruits: ['Fruits', '水果'] };
  const index = buildIndex(products, names, p => [p.shop_name, ...(cats[p.category] || [])]);
  const find = (q) => [...searchScores(q, index).entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  ok(norm('  Pastèque  BIO ') === 'pasteque bio', 'accents et majuscules ignorés');
  ok(distance('tomatte', 'tomate', 2) === 1 && distance('toamte', 'tomate', 2) === 1 && distance('abc', 'xyz', 1) > 1, 'distance : lettre en trop, lettres inversées');
  ok(tolerance(3) === 0 && tolerance(6) >= 1, 'mot court exact, mot long tolérant');
  ok(find('tomatte')[0] === 1, 'faute de frappe : « tomatte » trouve Tomate', JSON.stringify(find('tomatte')));
  ok(find('carote').includes(2) && find('carotte').includes(2), '« carote » et « carotte » trouvent Carrotte');
  ok(find('pasteque')[0] === 6, 'sans accent : « pasteque » trouve Pastèque');
  ok(find('watermelon')[0] === 6 && find('potato')[0] === 5, 'anglais : « watermelon », « potato »');
  ok(find('西瓜')[0] === 6 && find('ቲማቲም')[0] === 1, 'chinois et amharique');
  ok(find('oignon').includes(7) && find('onion').includes(7), '« oignon » trouve Ognon');
  const oranges = find('orange');
  ok(oranges.length === 2 && oranges.includes(3) && oranges.includes(4), '« orange » : les deux oranges, rien d\'autre', JSON.stringify(oranges));
  ok(JSON.stringify(find('orange egypte')) === '[4]', 'deux mots : tous doivent correspondre', JSON.stringify(find('orange egypte')));
  ok(find('zak')[0] === 4, 'recherche par boutique');
  ok(find('vegetables').length === 4 && find('legumes').length === 4, 'recherche par catégorie, en français comme en anglais', JSON.stringify(find('vegetables')));
  ok(find('xyzabc').length === 0 && find('po').every(id => id === 5), 'aucun faux résultat', JSON.stringify([find('xyzabc'), find('po')]));
  ok(find('').length === 0 && find('   ').length === 0, 'recherche vide : aucun filtrage');
  ok(find('tomate')[0] === 1 && searchScores('tomate', index).get(1) > searchScores('tomatte', index).get(1), 'le mot exact est mieux classé que le mot approché');

  console.log('\n8) Recommander une commande');
  const catalog = [
    { id: 1, name: 'Tomate', unit: 'kg', price: 180, stock_qty: 10 },
    { id: 2, name: 'Carrotte', unit: '/kg', price: 150, stock_qty: 2 },
    { id: 5, name: 'Pomme de terre', unit: 'kg', price: 100, stock_qty: 0 },
  ];
  const past = [
    { product_id: 1, quantity: 2, price: 200, product_name: 'Tomate' },
    { product_id: 1, quantity: 1, price: 200, product_name: 'Tomate' },
    { product_id: 2, quantity: 5, price: 150, product_name: 'Carrotte' },
    { product_id: 5, quantity: 3, price: 100, product_name: 'Pomme de terre' },
    { product_id: 9, quantity: 1, price: 500, product_name: 'Produit retiré' },
  ];
  const plan = planReorder(past, catalog);
  const L = Object.fromEntries(plan.lines.map(l => [l.product_id, l]));
  ok(plan.lines.length === 4 && L[1].wanted === 3 && L[1].quantity === 3 && L[1].status === 'ok', 'même produit sur deux lignes : regroupé', JSON.stringify(L[1]));
  ok(L[2].status === 'reduced' && L[2].quantity === 2 && L[2].unit === 'kg', 'stock insuffisant : quantité réduite au stock', JSON.stringify(L[2]));
  ok(L[5].status === 'unavailable' && L[5].product === null && L[9].status === 'unavailable' && L[9].name === 'Produit retiré', 'rupture et produit retiré : indisponibles, nom d\'origine conservé');
  ok(plan.available === 2 && plan.reduced === 1 && plan.unavailable === 2, 'décompte : 2 disponibles dont 1 réduit, 2 indisponibles', JSON.stringify({ a: plan.available, r: plan.reduced, u: plan.unavailable }));
  ok(plan.total === 3 * 180 + 2 * 150 && plan.price_changed === true && L[1].old_price === 200, 'total au prix d\'aujourd\'hui, changement de prix signalé', String(plan.total));
  ok(planReorder([], catalog).available === 0 && planReorder(past, []).available === 0, 'commande vide ou catalogue vide : rien à ajouter');
} catch (e) {
  fail++; console.error('\n💥 Erreur inattendue :', e);
} finally {
  console.log('\nNettoyage…');
  try {
    for (const s of state.before) await admin.from('app_settings').upsert({ key: s.key, value_num: s.value_num, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    await admin.from('error_logs').delete().ilike('message', `${TAG}%`);
    await admin.from('error_logs').delete().ilike('message', 'Erreur d\'essai déclenchée depuis Admin%').gte('first_seen', state.startedAt);
    await admin.from('error_logs').delete().eq('route', '/api/lang').gte('first_seen', state.startedAt);
    if (state.deposit) await admin.from('deposit_requests').delete().eq('id', state.deposit);
    if (state.user) {
      await admin.from('user_notifications').delete().eq('user_id', state.user.id);
      await admin.from('user_prefs').delete().eq('user_id', state.user.id);
      await admin.from('profiles').delete().eq('id', state.user.id);
      const { error } = await admin.auth.admin.deleteUser(state.user.id);
      ok(!error, 'compte temporaire supprimé', error?.message);
    }
    const after = (await admin.from('app_settings').select('key, value_num').like('key', 'monitor.%')).data || [];
    const sort = (a) => JSON.stringify([...a].sort((x, y) => x.key.localeCompare(y.key)));
    ok(sort(after) === sort(state.before), 'réglages de surveillance rétablis', JSON.stringify(after));
    ok((await rowsLike(`${TAG}%`)).length === 0, 'erreurs de test supprimées du journal');
  } catch (e) { fail++; console.error('Nettoyage incomplet :', e); }
  console.log(`\n${pass} réussis, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
}
