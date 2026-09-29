// Test non destructif des langues côté serveur (phases 21 à 23). Serveur local requis (port 3000).
// Comptes, marchand et produits temporaires, supprimés à la fin. Préparateurs désactivés pendant le test.
// AUCUNE annonce n'est diffusée : seule la prévisualisation (dry) est appelée.
// Vérifie : enregistrement de la langue, notifications de commande et de fidélité dans la langue du
// client, repli en français, aperçu d'annonce par langue, traductions de produit (suggestions du
// catalogue, validation, renommage par le marchand, droits).
//   node scripts/phase21_test_languages.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const BASE = process.argv[2] || 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label} ${extra}`); } };
const stamp = Date.now();
const state = { users: [], products: [], orders: [], preparers: [], subs: [] };

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
const mkUser = async (tag, meta) => {
  const email = `test-langue-${tag}-${stamp}@example.com`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: `Tmp-${stamp}!${tag}`, email_confirm: true, user_metadata: meta });
  if (error) throw error;
  state.users.push(u.user.id);
  return { id: u.user.id, email, token: await tokenFor(email) };
};
const notifs = async (userId) => (await admin.from('user_notifications').select('title, body, created_at').eq('user_id', userId).order('created_at', { ascending: true })).data || [];
const prefOf = async (userId) => (await admin.from('user_prefs').select('lang').eq('user_id', userId).maybeSingle()).data?.lang ?? null;
const trOf = async (productId) => Object.fromEntries(((await admin.from('product_translations').select('language_code, name, description').eq('product_id', productId)).data || []).map(r => [r.language_code, r]));
const FRENCH = /Commande|livrée|confirmée|Tampon|cagnotte|Encore/;

try {
  const { data: preps } = await admin.from('preparers').select('id').eq('is_active', true);
  state.preparers = (preps || []).map(p => p.id);
  if (state.preparers.length) await admin.from('preparers').update({ is_active: false }).in('id', state.preparers);

  const EN = await mkUser('en', { full_name: 'Test Langue EN' });
  const FR = await mkUser('fr', { full_name: 'Test Langue FR' });
  const ZH = await mkUser('zh', { full_name: 'Test Langue ZH' });
  const M = await mkUser('m', { full_name: 'Test Langue Marchand', role: 'producer' });
  const adminToken = await tokenFor('wilsandj@hotmail.com');
  const { data: P, error: pe } = await admin.from('products').insert({ name: 'TEST Langue produit', price: 1500, cost_price: 900, unit: 'kg', stock_qty: 300, farm: 'Test', category: 'legumes', product_type: 'conventionnel', origin_country: 'DJ', region: 'Test', status: 'published', is_local: false, in_stock: true, description: 'TEST LANGUE — à supprimer', bg_color: '#ecf4d5' }).select('id').single();
  if (pe) throw pe;
  state.products.push(P.id);

  console.log('\n1) Enregistrement de la langue');
  let r = await api('/api/lang', EN.token, { lang: 'xx' });
  ok(r.status === 400, 'langue inconnue refusée', String(r.status));
  r = await api('/api/lang', null, { lang: 'en' });
  ok(r.status === 200 && r.j.account === false && r.j.device === false, 'visiteur anonyme sans appareil : rien à enregistrer', JSON.stringify(r.j));
  r = await api('/api/lang', EN.token, { lang: 'en' });
  ok(r.status === 200 && r.j.account === true && await prefOf(EN.id) === 'en', 'langue du compte enregistrée (en)', JSON.stringify(r.j));
  await api('/api/lang', ZH.token, { lang: 'so' });
  r = await api('/api/lang', ZH.token, { lang: 'zh' });
  ok(r.status === 200 && await prefOf(ZH.id) === 'zh', 'changement de langue pris en compte (so → zh)');
  ok(await prefOf(FR.id) === null, 'compte sans choix : aucune langue (français par défaut)');
  const endpoint = `https://example.invalid/push/test-langue-${stamp}`;
  const { data: subRow } = await admin.from('push_subscriptions').insert({ endpoint, p256dh: 'test', auth: 'test', user_id: EN.id, is_admin: false }).select('id').single();
  state.subs.push(subRow.id);
  r = await api('/api/lang', EN.token, { lang: 'en', endpoint });
  const { data: subAfter } = await admin.from('push_subscriptions').select('lang').eq('id', subRow.id).single();
  ok(r.j.device === true && subAfter.lang === 'en', 'langue de l\'appareil enregistrée', JSON.stringify({ d: r.j.device, l: subAfter.lang }));
  const mine = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${FR.token}` } } });
  const { data: peek } = await mine.from('user_prefs').select('user_id, lang');
  ok((peek || []).every(x => x.user_id === FR.id), 'un client ne lit pas la langue des autres', JSON.stringify(peek));
  // L'appareil de test est retiré avant toute commande : aucune notification push ne part vers une adresse fictive
  await admin.from('push_subscriptions').delete().eq('id', subRow.id);

  console.log('\n2) Notifications de commande dans la langue du client');
  const order = async (u) => (await api('/api/orders', u.token, {
    order: { user_id: u.id, payment_method: 'cash', delivery_fee: 0, customer_name: 'Test Langue', phone: '77000000', address: 'Test' },
    items: [{ product_id: P.id, quantity: 1, price: 1500, product_name: 'TEST Langue produit', product_unit: 'kg' }],
  })).j.order;
  const oEn = await order(EN), oFr = await order(FR), oZh = await order(ZH);
  ok(!!oEn && !!oFr && !!oZh, 'trois commandes créées');
  let n = await notifs(EN.id);
  ok(n.length === 1 && n[0].title === '✅ Order confirmed' && /#[0-9A-Z]+/.test(n[0].body) && /1.500 Fdj/.test(n[0].body), 'client anglais : « Order confirmed », numéro et montant présents', JSON.stringify(n));
  ok(n.every(x => !FRENCH.test(x.title + ' ' + (x.body || ''))), 'client anglais : aucun mot français');
  n = await notifs(FR.id);
  ok(n.length === 1 && n[0].title === '✅ Commande confirmée', 'client français : texte français inchangé', JSON.stringify(n));
  n = await notifs(ZH.id);
  ok(n.length === 1 && /[一-鿿]/.test(n[0].title) && /[一-鿿]/.test(n[0].body) && /1.500 Fdj/.test(n[0].body), 'client chinois : titre et message en chinois', JSON.stringify(n));

  console.log('\n3) Suivi de statut et fidélité');
  await api('/api/orders', adminToken, { id: oEn.id, status: 'delivered' }, 'PATCH');
  await api('/api/orders', adminToken, { id: oFr.id, status: 'delivered' }, 'PATCH');
  n = await notifs(EN.id);
  ok(n.some(x => /delivered/i.test(x.title)), 'client anglais : « livrée » en anglais', JSON.stringify(n.map(x => x.title)));
  ok(n.every(x => !FRENCH.test(x.title + ' ' + (x.body || ''))), 'client anglais : fidélité comprise, aucun mot français', JSON.stringify(n));
  ok(n.every(x => !/\{\w+\}/.test(x.title + ' ' + (x.body || ''))), 'aucun paramètre non remplacé ({…})', JSON.stringify(n));
  n = await notifs(FR.id);
  ok(n.some(x => x.title === '✅ Commande livrée !'), 'client français : « Commande livrée ! »', JSON.stringify(n.map(x => x.title)));

  console.log('\n4) Repli en français quand le modèle manque');
  await admin.from('user_prefs').update({ lang: 'am' }).eq('user_id', ZH.id);
  const { data: hidden } = await admin.from('ui_translations').delete().eq('language_code', 'am').eq('key', 'srv.order.delivered.title').select('key, language_code, value');
  await api('/api/orders', adminToken, { id: oZh.id, status: 'delivered' }, 'PATCH');
  if (hidden?.length) await admin.from('ui_translations').insert(hidden);
  n = await notifs(ZH.id);
  ok(n.some(x => x.title === '✅ Commande livrée !'), 'modèle absent : message envoyé en français, jamais vide', JSON.stringify(n.map(x => x.title)));
  ok((await admin.from('ui_translations').select('key').eq('language_code', 'am').eq('key', 'srv.order.delivered.title')).data?.length === 1, 'modèle amharique remis en place');

  console.log('\n5) Aperçu d\'une annonce (rien n\'est envoyé)');
  const before = (await admin.from('announcements').select('id', { count: 'exact', head: true })).count;
  r = await api('/api/admin/broadcast', EN.token, { title: 'x', dry: true });
  ok(r.status === 401 || r.status === 403, 'un client ne peut pas préparer d\'annonce', String(r.status));
  r = await api('/api/admin/broadcast', adminToken, { title: 'TEST annonce', body: 'Texte français', dry: true, translations: { en: { title: 'TEST announcement', body: 'English text' }, zh: { title: '', body: 'sans titre' } } });
  ok(r.status === 200 && r.j.dry === true && r.j.texts?.en?.title === 'TEST announcement' && r.j.texts?.en?.translated === true, 'langue traduite : version anglaise retenue', JSON.stringify(r.j.texts?.en));
  ok(r.j.texts?.fr?.title === 'TEST annonce', 'français : texte d\'origine');
  ok(r.j.accounts?.en >= 1 && r.j.recipients >= 3, 'comptes comptés par langue', JSON.stringify(r.j.accounts));
  const am = r.j.texts?.am;
  ok(!am || (am.title === 'TEST annonce' && am.translated === false), 'langue sans traduction : repli sur le français', JSON.stringify(am));
  ok((await admin.from('announcements').select('id', { count: 'exact', head: true })).count === before, 'aucune annonce enregistrée ni diffusée');

  console.log('\n6) Traductions d\'un produit marchand');
  const { data: ref } = await admin.from('products').select('id, name').is('owner_id', null).eq('name', 'Tomate').maybeSingle();
  const refTr = ref ? await trOf(ref.id) : {};
  if (!ref || !refTr.en) throw new Error('produit de référence « Tomate » traduit introuvable');
  await admin.from('merchant_profiles').insert({ user_id: M.id, shop_name: 'Boutique Test Langue' });
  const { data: MP, error: mpe } = await admin.from('products').insert({ name: '  tomate ', price: 250, unit: 'kg', stock_qty: 10, farm: 'Boutique Test Langue', category: 'legumes', product_type: 'conventionnel', origin_country: 'DJ', region: 'Test', status: 'pending_review', is_local: true, in_stock: true, description: 'TEST LANGUE — à supprimer', bg_color: '#ecf4d5', owner_id: M.id }).select('id, status').single();
  if (mpe) throw mpe;
  state.products.push(MP.id);
  r = await api(`/api/admin/product-translations?product_id=${MP.id}`, EN.token);
  ok(r.status === 401 || r.status === 403, 'un client ne voit pas l\'éditeur de traductions', String(r.status));
  r = await api(`/api/admin/product-translations?product_id=${MP.id}`, adminToken);
  ok(r.status === 200 && r.j.suggestions?.en === refTr.en.name && r.j.suggestions?.zh === refTr.zh.name && Object.keys(r.j.translations).length === 0, 'nom proposé par le catalogue (produit homonyme), rien d\'enregistré', JSON.stringify(r.j.suggestions));
  await api('/api/lang', M.token, { lang: 'en' });
  r = await api('/api/admin/merchants', adminToken, { action: 'approve_product', product_id: MP.id });
  let tr = await trOf(MP.id);
  ok(r.status === 200 && r.j.translated === 4 && tr.en?.name === refTr.en.name && tr.so?.name === refTr.so.name && tr.aa?.name === refTr.so.name, 'validation : quatre langues remplies, afar aligné sur le somali', JSON.stringify({ t: r.j.translated, k: Object.keys(tr) }));
  r = await api('/api/admin/product-translations', adminToken, { product_id: MP.id, translations: { en: { name: 'Vine tomato', description: 'Ripe and sweet' }, zh: { name: '' } } });
  tr = await trOf(MP.id);
  ok(r.status === 200 && tr.en?.name === 'Vine tomato' && tr.en?.description === 'Ripe and sweet' && !tr.zh && !!tr.am, 'correction enregistrée, langue vidée supprimée, autres langues intactes', JSON.stringify(tr));
  r = await api('/api/admin/product-translations', M.token, { product_id: MP.id, translations: { en: { name: 'Pirate' } } });
  ok((r.status === 401 || r.status === 403) && (await trOf(MP.id)).en?.name === 'Vine tomato', 'un marchand ne peut pas modifier les traductions', String(r.status));
  await admin.from('products').update({ description: 'TEST LANGUE — description modifiée' }).eq('id', MP.id);
  tr = await trOf(MP.id);
  ok(tr.en?.name === 'Vine tomato' && tr.en?.description === '', 'description modifiée par le marchand : description traduite vidée, nom conservé', JSON.stringify(tr.en));
  await admin.from('products').update({ name: 'TEST Langue autre produit' }).eq('id', MP.id);
  ok(Object.keys(await trOf(MP.id)).length === 0, 'produit renommé : anciennes traductions supprimées');
  // Produit Hornafresh : une correction du nom ne doit rien effacer
  await admin.from('product_translations').insert({ product_id: P.id, language_code: 'en', name: 'TEST product', description: '' });
  await admin.from('products').update({ name: 'TEST Langue produit corrigé' }).eq('id', P.id);
  ok((await trOf(P.id)).en?.name === 'TEST product', 'produit Hornafresh renommé : traductions conservées');

  console.log('\n7) Messages aux marchands dans leur langue');
  n = await notifs(M.id);
  ok(n.some(x => /approved/i.test(x.title)) && n.every(x => !/Produit|validé|publié/.test(x.title + ' ' + (x.body || ''))), 'produit validé : message en anglais pour un marchand anglophone', JSON.stringify(n));
  ok(n.every(x => !/\{\w+\}/.test(x.title + ' ' + (x.body || ''))), 'aucun paramètre non remplacé ({…})', JSON.stringify(n));

  console.log('\n8) Langue de la commande (invité compris)');
  r = await api('/api/orders', null, {
    order: { user_id: null, payment_method: 'cash', delivery_fee: 0, customer_name: 'Test Langue Invité', phone: '77000000', address: 'Test', lang: 'so' },
    items: [{ product_id: P.id, quantity: 1, price: 1500, product_name: 'TEST Langue produit', product_unit: 'kg' }],
  });
  const guestId = r.j.order?.id;
  const { data: go } = guestId ? await admin.from('orders').select('lang').eq('id', guestId).single() : { data: null };
  ok(!!guestId && go?.lang === 'so', 'commande d\'un invité : langue enregistrée sur la commande', JSON.stringify({ s: r.status, l: go?.lang }));
  r = await api('/api/orders', EN.token, {
    order: { user_id: EN.id, payment_method: 'cash', delivery_fee: 0, customer_name: 'Test Langue', phone: '77000000', address: 'Test', lang: 'pirate' },
    items: [{ product_id: P.id, quantity: 1, price: 1500, product_name: 'TEST Langue produit', product_unit: 'kg' }],
  });
  const { data: bo } = r.j.order?.id ? await admin.from('orders').select('lang').eq('id', r.j.order.id).single() : { data: { lang: 'x' } };
  ok(r.status === 200 && bo?.lang === null, 'langue inconnue ignorée (commande acceptée, langue du compte utilisée)', JSON.stringify({ s: r.status, l: bo?.lang }));

  console.log('\n9) E-mails : aperçu dans chaque langue (rien n\'est envoyé)');
  const prev = async (kind, lang, token = adminToken) => api(`/api/admin/email-preview?kind=${encodeURIComponent(kind)}&lang=${lang}`, token);
  r = await prev('order', 'en', EN.token);
  ok(r.status === 401 || r.status === 403, 'aperçu réservé à l\'équipe', String(r.status));
  r = await prev('inconnu', 'en');
  ok(r.status === 400, 'type d\'e-mail inconnu refusé', String(r.status));
  // Mots français qui ne doivent plus apparaître (les données d'exemple — Tomate, Boutique Exemple… — sont exclues)
  const FR_WORDS = /\b(Commande|commande|Livraison|livraison|Cagnotte|cagnotte|Référence|Sous-total|Votre|votre|Abonnement|abonnement|Montant|Solde|Paiement|Rechargez|Merci|Reversement|Produit|Aucune|Depuis|Ouvrir|question|équipe|marché|hebdomadaire|mensuelle|Indisponible|omis|espèces|rupture|septembre|mardi)\b/;
  const text = (html) => html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const KINDS = ['order', 'status_processing', 'status_shipping', 'status_delivered', 'status_cancelled', 'topup', 'paused', 'remind_missing', 'remind_empty', 'resumed', 'expired', 'digest'];
  const frRef = {};
  for (const k of KINDS) { const x = await prev(k, 'fr'); frRef[k] = x.j; }
  ok(KINDS.every(k => frRef[k].subject && FR_WORDS.test(text(frRef[k].html))), 'français : les douze e-mails sont produits');
  ok(/Commande #1234 confirmée/.test(frRef.order.subject) && /Tomate/.test(frRef.order.html) && /3.500 Fdj/.test(frRef.order.html), 'français : confirmation de commande inchangée (objet, articles, total)', frRef.order.subject);
  for (const lang of ['en', 'zh', 'am', 'so']) {
    const bad = [];
    for (const k of KINDS) {
      const x = await prev(k, lang);
      const t = x.j.html ? text(x.j.html) : '';
      if (x.status !== 200) bad.push(`${k}: ${x.status}`);
      else if (x.j.subject === frRef[k].subject) bad.push(`${k}: objet resté en français`);
      else if (/\{\w+\}/.test(x.j.subject + t)) bad.push(`${k}: paramètre non remplacé`);
      else if (FR_WORDS.test(x.j.subject + ' ' + t)) bad.push(`${k}: mot français « ${(x.j.subject + ' ' + t).match(FR_WORDS)[0]} »`);
      else if (!x.j.html.includes(`<html lang="${lang}">`)) bad.push(`${k}: langue de l'e-mail non déclarée`);
      else if (x.j.sent !== false) bad.push(`${k}: envoi non désactivé`);
    }
    ok(bad.length === 0, `${lang} : les douze e-mails clients et marchands sont traduits`, JSON.stringify(bad));
  }
  const { data: keys } = await admin.from('ui_translations').select('key').eq('language_code', 'en').or('key.like.srv.m.%.title,key.like.srv.c.%.title');
  const msgKeys = (keys || []).map(k => k.key.replace(/^srv\./, '').replace(/\.title$/, ''));
  ok(msgKeys.length >= 40, 'modèles de messages marchands et entreprise présents', String(msgKeys.length));
  for (const lang of ['en', 'zh', 'am', 'so']) {
    const bad = [];
    for (const k of msgKeys) {
      const x = await prev(`merchant:${k}`, lang);
      const t = x.j.html ? text(x.j.html) : '';
      if (x.status !== 200) bad.push(`${k}: ${x.status}`);
      else if (/\{\w+\}/.test(x.j.subject + t)) bad.push(`${k}: paramètre non remplacé`);
      else if (x.j.subject.includes(`[${k}]`) || t.includes(`[${k}]`)) bad.push(`${k}: modèle absent`);
      else if (FR_WORDS.test(x.j.subject + ' ' + t)) bad.push(`${k}: mot français « ${(x.j.subject + ' ' + t).match(FR_WORDS)[0]} »`);
    }
    ok(bad.length === 0, `${lang} : ${msgKeys.length} messages marchands et entreprise traduits, paramètres remplis`, JSON.stringify(bad));
  }
} catch (e) {
  fail++; console.error('\n💥 Erreur inattendue :', e);
} finally {
  console.log('\nNettoyage…');
  try {
    if (state.subs.length) await admin.from('push_subscriptions').delete().in('id', state.subs);
    const { data: its } = state.products.length ? await admin.from('order_items').select('order_id').in('product_id', state.products) : { data: [] };
    const oids = [...new Set([...(its || []).map(i => i.order_id), ...state.orders])];
    if (oids.length) {
      await admin.from('loyalty_stamps').delete().in('order_id', oids);
      await admin.from('order_items').delete().in('order_id', oids);
      await admin.from('orders').delete().in('id', oids);
    }
    if (state.products.length) await admin.from('products').delete().in('id', state.products);
    for (const id of state.users) {
      await admin.from('merchant_profiles').delete().eq('user_id', id);
      await admin.from('merchant_formulas').delete().eq('user_id', id);
      await admin.from('user_notifications').delete().eq('user_id', id);
      await admin.from('loyalty_stamps').delete().eq('user_id', id);
      await admin.from('profiles').delete().eq('id', id);
      const { error } = await admin.auth.admin.deleteUser(id);
      ok(!error, 'compte temporaire supprimé', error?.message);
    }
    if (state.preparers.length) await admin.from('preparers').update({ is_active: true }).in('id', state.preparers);
    const left = (await admin.from('products').select('id', { count: 'exact', head: true }).ilike('name', 'TEST Langue%')).count;
    ok(left === 0, 'produits de test supprimés', String(left));
  } catch (e) { fail++; console.error('Nettoyage incomplet :', e); }
  console.log(`\n${pass} réussis, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
}
