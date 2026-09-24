// Test NON destructif du cron marchands (/api/cron/merchants?dry=1).
// Crée un marchand temporaire avec 4 abonnements fictifs (échu, J-7, J-1, paiement en attente
// depuis 5 jours) + 1 cas « renouvellement enchaîné » (ne doit PAS être rappelé), interroge le cron
// en mode à blanc (aucune écriture, aucune notification), puis supprime tout (cascade).
// Usage : node scripts/phase1_test_cron.mjs [http://localhost:3000]
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.argv[2] || 'http://localhost:3000';
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const today = new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const out = []; const ok = (n, c, x = '') => out.push(`${c ? '✅' : '❌'} ${n}${x ? ' — ' + x : ''}`);
const uids = [];
try {
  const mk = async (tag) => {
    const { data, error } = await admin.auth.admin.createUser({ email: `test-cron-${tag}-${Date.now()}@example.com`, password: 'Tmp-' + Math.random().toString(36).slice(2) + 'A1!', email_confirm: true, user_metadata: { full_name: `Cron ${tag}`, role: 'producer' } });
    if (error) throw error; uids.push(data.user.id);
    await admin.from('merchant_profiles').insert({ user_id: data.user.id, shop_name: `Boutique Cron ${tag}` });
    return data.user.id;
  };
  const { data: plan } = await admin.from('merchant_plans').select('id').order('id').limit(1).maybeSingle();
  const uA = await mk('A'), uB = await mk('B'), uC = await mk('C');
  const rows = [
    { user_id: uA, plan_id: plan.id, status: 'active', starts_at: addDays(today, -61), ends_at: addDays(today, -31) },  // ancienne période échue (renouvelée ensuite) → expire en silence
    { user_id: uA, plan_id: plan.id, status: 'active', starts_at: addDays(today, -23), ends_at: addDays(today, 7) },    // période courante J-7 → rappel
    { user_id: uB, plan_id: plan.id, status: 'active', starts_at: addDays(today, -29), ends_at: addDays(today, 1) },    // J-1 mais…
    { user_id: uB, plan_id: plan.id, status: 'active', starts_at: addDays(today, 2),   ends_at: addDays(today, 31) },   // …renouvellement enchaîné → pas de rappel
    { user_id: uC, plan_id: plan.id, status: 'active', starts_at: addDays(today, -31), ends_at: addDays(today, -1) },   // échu sans suite → expire + notif
    { user_id: uC, plan_id: plan.id, status: 'pending_payment', payment_method: 'waafi', payment_reference: 'OLD', created_at: new Date(Date.now() - 5 * 86400000).toISOString() }, // déclaré depuis 5 j → alerte admin
  ];
  // (insertion groupée : chaque ligne doit porter toutes les clés, sinon null → on fixe created_at partout)
  const { data: ins, error } = await admin.from('merchant_subscriptions')
    .insert(rows.map(r => ({ created_at: new Date().toISOString(), payment_method: 'cash', payment_reference: null, ...r })))
    .select('id, user_id, ends_at, status');
  if (error) throw error;
  const idOf = (uid, ends) => ins.find(r => r.user_id === uid && r.ends_at === ends)?.id;

  const res = await fetch(`${BASE}/api/cron/merchants?dry=1`, { headers: env.CRON_SECRET ? { Authorization: `Bearer ${env.CRON_SECRET}` } : {} });
  const j = await res.json();
  ok('cron dry 200', res.status === 200, String(res.status));
  ok('expire : ancienne période A → silencieuse (renouvelée)', j.expired?.find(x => x.id === idOf(uA, addDays(today, -31)))?.silent === true, JSON.stringify(j.expired));
  ok('expire : C échu sans suite → notifié', j.expired?.find(x => x.id === idOf(uC, addDays(today, -1)))?.silent === false, JSON.stringify(j.expired));
  ok('J-7 : A rappelé', j.reminded_7?.some(x => x.id === idOf(uA, addDays(today, 7))), JSON.stringify(j.reminded_7));
  ok('J-1 : B NON rappelé (renouvellement enchaîné)', !j.reminded_1?.some(x => x.id === idOf(uB, addDays(today, 1))), JSON.stringify(j.reminded_1));
  ok('stale : paiement C (5 j) signalé', j.stale_payments?.some(x => x.shop === 'Boutique Cron C'), JSON.stringify(j.stale_payments));
  ok('enseignes résolues', j.reminded_7?.[0]?.shop === 'Boutique Cron A', j.reminded_7?.[0]?.shop);
  ok('dry : aucune écriture', (await admin.from('merchant_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', uA).eq('status', 'expired')).count === 0);
  const unauth = await fetch(`${BASE}/api/cron/merchants?dry=1`);
  ok('sans secret → 401 (si CRON_SECRET défini localement)', !env.CRON_SECRET || unauth.status === 401, String(unauth.status));
} catch (e) { out.push('💥 ' + e.message); }
finally {
  for (const id of uids) {
    // Suppression manuelle des lignes sans cascade (profiles…) puis du compte
    await admin.from('merchant_subscriptions').delete().eq('user_id', id);
    await admin.from('merchant_profiles').delete().eq('user_id', id);
    await admin.from('user_notifications').delete().eq('user_id', id);
    for (const tbl of ['profiles']) { try { await admin.from(tbl).delete().eq('id', id); } catch { /* ignore */ } }
    const { error } = await admin.auth.admin.deleteUser(id);
    out.push(error ? `⚠️ suppression ${id.slice(0, 8)} : ${error.message}` : `🧹 compte test ${id.slice(0, 8)} supprimé`);
  }
}
console.log(out.join('\n'));
