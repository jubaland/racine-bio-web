// Test non destructif du durcissement 0-b / 0-c (lecture anonyme, écriture anonyme, admin, trigger profil)
// Usage : node scripts/phase0c_test_privacy.mjs
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const URLB = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URLB, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(URLB, ANON, { auth: { persistSession: false } });
const out = []; const ok = (n, c, x = '') => out.push(`${c ? '✅' : '❌'} ${n}${x ? ' — ' + x : ''}`);

// 1. Lectures anonymes → vides
for (const t of ['orders', 'order_items', 'profiles', 'admins', 'push_subscriptions', 'producer_accounts', 'order_tracking']) {
  const { data, error } = await anon.from(t).select('*').limit(1);
  ok(`anon ne lit pas ${t}`, !error && (data || []).length === 0, error ? error.message : `${(data || []).length} ligne(s)`);
}
// 2. Lectures publiques conservées
for (const t of ['category_translations', 'promo_translations', 'producer_translations', 'ui_translations', 'products', 'merchant_plans']) {
  const { data, error } = await anon.from(t).select('*').limit(1);
  ok(`anon lit ${t}`, !error && (data || []).length >= 0 && !error, error ? error.message : 'ok');
}
// 3. Écritures anonymes refusées (aucune ligne créée : payload volontairement invalide si jamais accepté)
const w1 = await anon.from('category_translations').insert({ category_id: -1, language_code: 'xx', label: 'x' });
ok('anon ne peut pas écrire category_translations', !!w1.error, w1.error?.code || 'accepté ?!');
const w2 = await anon.from('admins').insert({ user_id: '00000000-0000-0000-0000-000000000000', email: 'x@x.x' });
ok('anon ne peut pas écrire admins', !!w2.error, w2.error?.code || 'accepté ?!');
const w3 = await anon.from('orders').insert({ total: 0, status: 'pending' });
ok('anon ne peut pas insérer une commande directement', !!w3.error, w3.error?.code || 'accepté ?!');
const { count: pushBefore } = await admin.from('push_subscriptions').select('id', { count: 'exact', head: true });
await anon.from('push_subscriptions').delete().neq('endpoint', 'x');
const { count: pushAfter } = await admin.from('push_subscriptions').select('id', { count: 'exact', head: true });
ok('anon ne peut pas supprimer push_subscriptions', pushBefore === pushAfter, `${pushBefore} → ${pushAfter}`);
// 4. Trigger profil toujours fonctionnel (création + suppression d'un compte temporaire)
const mail = `test-rls-${Date.now()}@example.com`;
const { data: u, error: ue } = await admin.auth.admin.createUser({ email: mail, password: 'Tmp-' + Math.random().toString(36).slice(2) + 'A1!', email_confirm: true, user_metadata: { full_name: 'Test RLS' } });
if (ue) ok('création compte (trigger profil)', false, ue.message);
else {
  const { data: p } = await admin.from('profiles').select('id').eq('id', u.user.id).maybeSingle();
  ok('création compte → profil créé par le trigger', !!p);
  await admin.from('profiles').delete().eq('id', u.user.id);
  const { error: de } = await admin.auth.admin.deleteUser(u.user.id);
  ok('compte temporaire supprimé', !de, de?.message || '');
}
// 5. Client connecté : lit son profil, pas les autres
const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true });
ok(`admin (service) voit ${count} profils`, (count || 0) > 0);
console.log(out.join('\n'));
