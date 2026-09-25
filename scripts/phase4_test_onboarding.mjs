// Test NON destructif de l'onboarding marchand : 2 comptes clients temporaires déposent une demande
// (RLS, avec leur session), alerte admin, puis l'admin accepte l'une (rôle + enseigne + notification
// vers Mon abonnement) et refuse l'autre avec motif. Tout est supprimé à la fin.
// Usage : node scripts/phase4_test_onboarding.mjs [http://localhost:3000]
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.argv[2] || 'http://localhost:3000';
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const out = []; const ok = (n, c, x = '') => out.push(`${c ? '✅' : '❌'} ${n}${x ? ' — ' + x : ''}`);
const sessionFor = async (email) => {
  const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const cli = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: v } = await cli.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' });
  return { cli, token: v.session.access_token };
};
const uids = [];
try {
  const mk = async (tag) => { const { data, error } = await admin.auth.admin.createUser({ email: `test-join-${tag}-${Date.now()}@example.com`, password: 'Tmp-' + Math.random().toString(36).slice(2) + 'A1!', email_confirm: true, user_metadata: { full_name: `Join ${tag}` } }); if (error) throw error; uids.push(data.user.id); return data.user; };
  const a = await mk('A'), b = await mk('B');
  const sa = await sessionFor(a.email), sb = await sessionFor(b.email);

  // Dépôt (RLS : e-mail du jeton) — A et B
  const { error: e1 } = await sa.cli.from('producer_requests').insert({ user_id: a.id, email: a.email, full_name: 'Join A', farm_name: 'Boutique Join A', phone: '77111111', region: 'Arta', products_description: 'Mangues, citrons', status: 'pending' });
  ok('A : dépôt de demande (RLS) accepté', !e1, e1?.message);
  const { error: e2 } = await sb.cli.from('producer_requests').insert({ user_id: b.id, email: b.email, full_name: 'Join B', farm_name: 'Boutique Join B', phone: '77222222', products_description: 'Import', status: 'pending' });
  ok('B : dépôt accepté', !e2, e2?.message);
  const { error: e3 } = await sa.cli.from('producer_requests').insert({ user_id: b.id, email: b.email, full_name: 'X', farm_name: 'Usurpation', phone: '0', products_description: 'x', status: 'pending' });
  ok('A ne peut pas déposer au nom de B (RLS)', !!e3, e3?.code || 'accepté ?!');
  const { count: adminBefore } = await admin.from('admin_notifications').select('id', { count: 'exact', head: true });
  const rn = await fetch(`${BASE}/api/merchant-request/notify`, { method: 'POST', headers: { Authorization: `Bearer ${sa.token}` } }); const rj = await rn.json();
  const { count: adminAfter } = await admin.from('admin_notifications').select('id', { count: 'exact', head: true });
  ok('alerte admin après dépôt (cloche)', rn.status === 200 && rj.ok === true && (adminAfter || 0) === (adminBefore || 0) + 1, `${rn.status} ${adminBefore} → ${adminAfter}`);
  const { data: nA } = await admin.from('user_notifications').select('title').eq('user_id', a.id).order('created_at', { ascending: false }).limit(1);
  ok('A : accusé de réception (cloche)', nA?.[0]?.title?.includes('reçue'), nA?.[0]?.title);

  // Admin : accepte A, refuse B avec motif
  const { token: at } = await sessionFor('wilsandj@hotmail.com');
  const acall = (body) => fetch(`${BASE}/api/admin/merchants`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` }, body: JSON.stringify(body) }).then(async r => [r.status, await r.json()]);
  const { data: reqA } = await admin.from('producer_requests').select('id').eq('user_id', a.id).single();
  const { data: reqB } = await admin.from('producer_requests').select('id').eq('user_id', b.id).single();
  let [s, j] = await acall({ action: 'approve_request', request_id: reqA.id });
  ok('admin : acceptation A → 200, compte trouvé', s === 200 && j.user_found === true, `${s} ${JSON.stringify(j)}`);
  const { data: ua } = await admin.auth.admin.getUserById(a.id);
  ok('A : rôle producer + téléphone repris', ua.user.user_metadata.role === 'producer' && ua.user.user_metadata.phone === '77111111', JSON.stringify({ role: ua.user.user_metadata.role, phone: ua.user.user_metadata.phone }));
  const { data: mp } = await admin.from('merchant_profiles').select('shop_name').eq('user_id', a.id).maybeSingle();
  ok('A : enseigne créée = Boutique Join A', mp?.shop_name === 'Boutique Join A', mp?.shop_name);
  const { data: rA } = await admin.from('producer_requests').select('status, resolved_at').eq('id', reqA.id).single();
  ok('A : demande approuvée + resolved_at', rA.status === 'approved' && !!rA.resolved_at);
  const { data: nA2 } = await admin.from('user_notifications').select('title, url').eq('user_id', a.id).order('created_at', { ascending: false }).limit(1);
  ok('A : notification « Adhésion acceptée » → Mon abonnement', nA2?.[0]?.title?.includes('acceptée') && nA2?.[0]?.url === '/producer/subscription', JSON.stringify(nA2?.[0]));
  [s, j] = await acall({ action: 'approve_request', request_id: reqA.id });
  ok('admin : ré-acceptation → 409 already_resolved', s === 409, String(s));
  [s, j] = await acall({ action: 'reject_request', request_id: reqB.id, note: 'Produits importés hors charte' });
  ok('admin : refus B → 200', s === 200, String(s));
  const { data: rB } = await admin.from('producer_requests').select('status, admin_note').eq('id', reqB.id).single();
  ok('B : refusée avec motif', rB.status === 'rejected' && rB.admin_note === 'Produits importés hors charte', JSON.stringify(rB));
  const { data: ub } = await admin.auth.admin.getUserById(b.id);
  ok('B : reste client', (ub.user.user_metadata.role || 'client') !== 'producer');
  const { data: nB } = await admin.from('user_notifications').select('title, body, url').eq('user_id', b.id).order('created_at', { ascending: false }).limit(1);
  ok('B : notification de refus avec motif → page Devenir marchand', nB?.[0]?.title?.includes('non retenue') && nB?.[0]?.body?.includes('Produits importés hors charte') && nB?.[0]?.url === '/become-producer', JSON.stringify(nB?.[0]));
  // B peut redéposer
  const { error: e4 } = await sb.cli.from('producer_requests').insert({ user_id: b.id, email: b.email, full_name: 'Join B', farm_name: 'Boutique Join B2', phone: '77222222', products_description: 'Légumes locaux', status: 'pending' });
  ok('B : nouvelle demande possible après refus', !e4, e4?.message);
  const page = await fetch(`${BASE}/become-producer`); ok('page /become-producer → 200', page.status === 200, String(page.status));
} catch (e) { out.push('💥 ' + e.message); }
finally {
  for (const id of uids) {
    await admin.from('producer_requests').delete().eq('user_id', id);
    await admin.from('merchant_profiles').delete().eq('user_id', id);
    await admin.from('user_notifications').delete().eq('user_id', id);
    await admin.from('profiles').delete().eq('id', id);
    const { error } = await admin.auth.admin.deleteUser(id);
    out.push(error ? `⚠️ suppression ${id.slice(0, 8)} : ${error.message}` : `🧹 compte ${id.slice(0, 8)} supprimé`);
  }
  await admin.from('admin_notifications').delete().like('body', 'Boutique Join%');
}
console.log(out.join('\n'));
