// Test de la traduction automatique (phase 30). Serveur local requis (port 3000).
// Appelle réellement le service de traduction en ligne, avec un texte très court (quota gratuit
// préservé). Si le service est indisponible ou son quota atteint, les vérifications qui en dépendent
// sont signalées « non vérifié » sans faire échouer la suite. Rien n'est écrit en base.
//   node scripts/phase30_test_translate.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { chunks } from '../lib/translate.ts';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const BASE = process.argv[2] || 'http://localhost:3000';

let pass = 0, fail = 0, skipped = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label} ${extra}`); } };
const skip = (label) => { skipped++; console.log(`  ⏭️  non vérifié : ${label}`); };
const stamp = Date.now();
let userId = null;

const tokenFor = async (email) => {
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const { data: v } = await anon().auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  return v.session.access_token;
};
const api = async (token, body) => {
  const r = await fetch(`${BASE}/api/admin/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  let j = {}; try { j = await r.json(); } catch { /* ignore */ }
  return { status: r.status, j };
};

try {
  console.log('\n1) Découpage des textes longs');
  const long = 'Première phrase assez courte. '.repeat(40).trim();
  const parts = chunks(long, 450);
  ok(parts.length > 1 && parts.every(p => p.length <= 450) && parts.join(' ').replace(/\s+/g, ' ') === long, 'découpé aux fins de phrase, rien de perdu, aucun morceau trop long', String(parts.map(p => p.length)));
  ok(JSON.stringify(chunks('Court.')) === '["Court."]' && chunks('').length === 0, 'texte court ou vide');
  ok(chunks('x'.repeat(1000), 450).every(p => p.length <= 450), 'texte sans espace : découpé quand même');

  const email = `test-traduction-${stamp}@example.com`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: `Tmp-${stamp}!t`, email_confirm: true, user_metadata: { full_name: 'Test Traduction' } });
  if (error) throw error;
  userId = u.user.id;
  const client = await tokenFor(email), adminToken = await tokenFor('wilsandj@hotmail.com');

  console.log('\n2) Droits et contrôles');
  let r = await api(null, { fields: { title: 'Bonjour' } });
  ok(r.status === 401, 'sans connexion : refusé', String(r.status));
  r = await api(client, { fields: { title: 'Bonjour' } });
  ok(r.status === 401 || r.status === 403, 'un client ne peut pas utiliser la traduction', String(r.status));
  r = await api(adminToken, { fields: {} });
  ok(r.status === 400 && r.j.error === 'nothing_to_translate', 'rien à traduire : refusé', JSON.stringify(r.j));
  r = await api(adminToken, { fields: { title: '   ' } });
  ok(r.status === 400, 'texte vide : refusé', String(r.status));
  r = await api(adminToken, { fields: { title: 'Bonjour' }, langs: ['xx'] });
  ok(r.status === 400 && r.j.error === 'invalid_lang', 'langue inconnue : refusée', JSON.stringify(r.j));
  r = await api(adminToken, { fields: { title: 'x '.repeat(1500) } });
  ok(r.status === 413 && r.j.error === 'too_long', 'texte trop long : refusé sans appeler le service', JSON.stringify(r.j));

  console.log('\n3) Traduction réelle (service en ligne)');
  r = await api(adminToken, { fields: { title: '🍊 Oranges fraîches', description: 'Récoltées cette semaine.' }, langs: ['en', 'zh', 'am', 'so'] });
  if (r.status === 429 || r.status === 424) {
    skip(`service ${r.j.error === 'quota' ? 'au quota atteint' : 'indisponible'} : traductions réelles`);
    ok(['quota', 'unavailable'].includes(r.j.error), 'panne du service signalée proprement, sans erreur du site', JSON.stringify(r.j));
  } else {
    const tr = r.j.translations || {};
    ok(r.status === 200 && r.j.provider && Object.keys(tr).length >= 3, 'traductions reçues pour les langues demandées', JSON.stringify({ s: r.status, l: Object.keys(tr), e: r.j.errors }));
    ok(/orange/i.test(tr.en?.title || '') && tr.en.title.startsWith('🍊'), 'anglais : sens conservé, émoji resté en tête', tr.en?.title);
    ok(/[一-鿿]/.test(tr.zh?.title || '') && /[ሀ-፿]/.test(tr.am?.title || ''), 'chinois et amharique dans leur écriture', JSON.stringify([tr.zh?.title, tr.am?.title]));
    ok(Object.values(tr).every(x => x.title && x.title !== '🍊 Oranges fraîches' && x.description && !/MYMEMORY|QUOTA/i.test(x.title + x.description)), 'aucun champ vide, aucun texte resté en français, aucun message du service', JSON.stringify(tr.so));
  }
  const { count } = await admin.from('error_logs').select('id', { count: 'exact', head: true }).eq('route', '/api/admin/translate').is('resolved_at', null);
  ok(count === 0, 'aucune erreur du site enregistrée par ces appels', String(count));
} catch (e) {
  fail++; console.error('\n💥 Erreur inattendue :', e);
} finally {
  if (userId) {
    await admin.from('user_prefs').delete().eq('user_id', userId);
    await admin.from('profiles').delete().eq('id', userId);
    const { error } = await admin.auth.admin.deleteUser(userId);
    ok(!error, 'compte temporaire supprimé', error?.message);
  }
  console.log(`\n${pass} réussis, ${fail} échec(s)${skipped ? `, ${skipped} non vérifié(s)` : ''}`);
  process.exit(fail ? 1 : 0);
}
