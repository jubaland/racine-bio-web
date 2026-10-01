// Test du canal e-mail des annonces (phase 31). Serveur local requis (port 3000).
// AUCUNE annonce n'est diffusée, AUCUN e-mail n'est envoyé : seuls l'aperçu (dry), le réglage,
// le désabonnement et le rendu de l'e-mail sont vérifiés. Comptes temporaires supprimés, réglage rétabli.
//   node scripts/phase31_test_announce_email.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { unsubscribeToken, verifyUnsubscribeToken } from '../lib/unsubscribe.ts';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;   // même secret que le serveur pour les jetons
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const BASE = process.argv[2] || 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label} ${extra}`); } };
const stamp = Date.now();
const state = { users: [], gap: undefined };

const tokenFor = async (email) => {
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const { data: v } = await anon().auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  return v.session.access_token;
};
const api = async (path, token, body, method = body ? 'POST' : 'GET') => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch { /* ignore */ }
  return { status: r.status, j };
};
const mkUser = async (tag, meta) => {
  const email = `test-annonce-${tag}-${stamp}@example.com`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: `Tmp-${stamp}!${tag}`, email_confirm: true, user_metadata: { full_name: `Test Annonce ${tag}`, ...meta } });
  if (error) throw error;
  state.users.push(u.user.id);
  return { id: u.user.id, email };
};
const metaOf = async (id) => (await admin.auth.admin.getUserById(id)).data.user.user_metadata;

try {
  const { data: g } = await admin.from('app_settings').select('value_num').eq('key', 'announce.email_min_gap_hours').maybeSingle();
  state.gap = g ? g.value_num : undefined;
  const adminToken = await tokenFor('wilsandj@hotmail.com');
  const adm = (body) => api('/api/admin/broadcast', adminToken, body);

  console.log('\n1) Jeton de désabonnement');
  const A = await mkUser('a', { notifications: { orders: true, status: true, promos: true } });
  const B = await mkUser('b', { notifications: { orders: true, status: true, promos: false } });   // a refusé les annonces
  const C = await mkUser('c', { marketing_last_at: new Date().toISOString() });                       // contacté à l'instant
  const tok = unsubscribeToken(A.id);
  ok(verifyUnsubscribeToken(tok) === A.id, 'jeton valide reconnu');
  ok(verifyUnsubscribeToken(tok.slice(0, -2) + 'zz') === null && verifyUnsubscribeToken('') === null && verifyUnsubscribeToken(unsubscribeToken(B.id).replace(/^[^.]+/, Buffer.from(A.id).toString('base64url'))) === null, 'jeton altéré, vide ou recopié sur un autre compte : refusé');

  console.log('\n2) Réglage du délai minimal');
  let r = await adm({ action: 'save_settings', email_min_gap_hours: 0 });
  ok(r.status === 400, 'délai nul refusé', String(r.status));
  r = await adm({ action: 'save_settings', email_min_gap_hours: 1.5 });
  ok(r.status === 400, 'délai non entier refusé', String(r.status));
  r = await adm({ action: 'save_settings', email_min_gap_hours: 48 });
  ok(r.status === 200 && r.j.settings?.email_min_gap_hours === 48, 'délai de 48 h enregistré', JSON.stringify(r.j));
  r = await api('/api/admin/broadcast', adminToken);
  ok(r.status === 200 && r.j.settings?.email_min_gap_hours === 48, 'réglage relu avec l\'historique');

  console.log('\n3) Aperçu : qui recevrait l\'e-mail (rien n\'est envoyé)');
  const before = (await admin.from('announcements').select('id', { count: 'exact', head: true })).count;
  r = await adm({ title: 'TEST annonce', body: 'Texte', dry: true });
  const e = r.j.email;
  ok(r.status === 200 && e && e.gap_hours === 48, 'aperçu renvoie le volet e-mail', JSON.stringify(e));
  ok(e.opted_out >= 1 && e.recent >= 1, 'un client qui a refusé et un client contacté récemment sont exclus', JSON.stringify(e));
  r = await adm({ action: 'save_settings', email_min_gap_hours: '' });
  r = await adm({ title: 'TEST annonce', body: 'Texte', dry: true });
  ok(r.j.email.gap_hours === null && r.j.email.recent === 0, 'sans délai réglé : plus personne n\'est exclu pour « trop récent »', JSON.stringify(r.j.email));
  ok((await admin.from('announcements').select('id', { count: 'exact', head: true })).count === before, 'aucune annonce créée');

  console.log('\n4) Désabonnement par le lien');
  let h = await fetch(`${BASE}/api/unsubscribe?t=mauvais`);
  ok(h.status === 400 && /invalide/i.test(await h.text()), 'jeton invalide : page d\'erreur', String(h.status));
  h = await fetch(`${BASE}/api/unsubscribe?t=${encodeURIComponent(tok)}&lang=en`);
  const html = await h.text();
  ok(h.status === 200 && /lang="en"/.test(html) && !/annonces/.test(html), 'désabonnement accepté, page en anglais', html.slice(0, 120));
  const mA = await metaOf(A.id);
  ok(mA.notifications?.promos === false && mA.notifications?.orders === true, 'préférence « Offres et promotions » passée à non, les autres intactes', JSON.stringify(mA.notifications));
  r = await adm({ title: 'TEST annonce', body: 'Texte', dry: true });
  ok(r.j.email.opted_out >= 2, 'le client désabonné est désormais exclu de l\'aperçu', JSON.stringify(r.j.email));
  h = await fetch(`${BASE}/api/unsubscribe?t=${encodeURIComponent(tok)}`);
  ok(h.status === 200, 'second clic : toujours accepté, sans erreur');

  console.log('\n5) Rendu de l\'e-mail d\'annonce');
  r = await api('/api/admin/email-preview?kind=announcement&lang=so', adminToken);
  const text = (r.j.html || '').replace(/<[^>]+>/g, ' ');
  ok(r.status === 200 && r.j.sent === false && /unsubscribe\?t=/.test(r.j.html) && !/Ne plus recevoir|Voir sur Hornafresh/.test(text), 'e-mail d\'annonce en somali avec lien de désabonnement, boutons traduits', r.j.subject);
  r = await api('/api/admin/email-preview?kind=announcement&lang=fr', adminToken);
  ok(/Ne plus recevoir les annonces/.test((r.j.html || '')) && /Voir sur Hornafresh/.test(r.j.html || ''), 'version française');
  r = await api('/api/admin/email-preview?list=1', adminToken);
  ok((r.j.kinds || []).some(k => k.id === 'announcement'), 'présent dans le catalogue des aperçus');

  console.log('\n6) Droits');
  const tA = await tokenFor(A.email);
  r = await api('/api/admin/broadcast', tA, { action: 'save_settings', email_min_gap_hours: 1 });
  ok(r.status === 401 || r.status === 403, 'un client ne modifie pas le réglage', String(r.status));
  r = await api('/api/admin/broadcast', tA, { title: 'Pirate', dry: true });
  ok(r.status === 401 || r.status === 403, 'un client ne voit pas l\'aperçu', String(r.status));
} catch (e) {
  fail++; console.error('\n💥 Erreur inattendue :', e);
} finally {
  console.log('\nNettoyage…');
  try {
    if (state.gap === undefined) await admin.from('app_settings').delete().eq('key', 'announce.email_min_gap_hours');
    else await admin.from('app_settings').upsert({ key: 'announce.email_min_gap_hours', value_num: state.gap, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    for (const id of state.users) {
      await admin.from('user_prefs').delete().eq('user_id', id);
      await admin.from('user_notifications').delete().eq('user_id', id);
      await admin.from('profiles').delete().eq('id', id);
      const { error } = await admin.auth.admin.deleteUser(id);
      ok(!error, 'compte temporaire supprimé', error?.message);
    }
    const { data: g2 } = await admin.from('app_settings').select('value_num').eq('key', 'announce.email_min_gap_hours').maybeSingle();
    ok((g2 ? g2.value_num : undefined) == state.gap, 'réglage rétabli', JSON.stringify(g2));
  } catch (e) { fail++; console.error('Nettoyage incomplet :', e); }
  console.log(`\n${pass} réussis, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
}
