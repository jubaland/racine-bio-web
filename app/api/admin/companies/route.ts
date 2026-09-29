import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';
import { adjustCompanyWallet, globalMinTopup, notifyCompany, fdj } from '../../../../lib/company';
import { monitored } from '../../../../lib/monitor';

// Admin › Entreprises — GET : sociétés (solde, membres, encours), recharges à valider, réglage global.
// POST { action } : approve | reject | suspend | reactivate | confirm_deposit | reject_deposit |
//                   adjust_wallet | set_company_min | set_global_min

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function GET_(request: Request) {
  const auth = await requirePerm(request, 'companies', 'view');
  if (!auth.ok) return bad(auth.error!, auth.status);
  const [{ data: companies }, { data: members }, { data: wallets }, { data: deposits }, { data: orders }, minTopup] = await Promise.all([
    supabaseAdmin.from('companies').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('company_members').select('company_id, user_id, role, email, full_name'),
    supabaseAdmin.from('company_wallets').select('company_id, balance'),
    supabaseAdmin.from('company_deposit_requests').select('*').order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('orders').select('company_id, total, status').not('company_id', 'is', null),
    globalMinTopup(),
  ]);
  const bal: Record<number, number> = Object.fromEntries((wallets || []).map((w: any) => [w.company_id, Number(w.balance) || 0]));
  const nameOf: Record<number, string> = Object.fromEntries((companies || []).map((c: any) => [c.id, c.name]));
  const stats: Record<number, { orders: number; revenue: number }> = {};
  for (const o of orders || []) {
    if (o.status === 'cancelled') continue;
    const s = (stats[o.company_id] ||= { orders: 0, revenue: 0 }); s.orders++; s.revenue += Number(o.total) || 0;
  }
  return NextResponse.json({
    min_topup: minTopup,
    companies: (companies || []).map((c: any) => ({ ...c, balance: bal[c.id] || 0, members: (members || []).filter((m: any) => m.company_id === c.id), orders_count: stats[c.id]?.orders || 0, revenue: stats[c.id]?.revenue || 0 })),
    deposits: (deposits || []).map((d: any) => ({ ...d, company_name: nameOf[d.company_id] || `#${d.company_id}` })),
  });
}

async function POST_(request: Request) {
  const auth = await requirePerm(request, 'companies', 'edit');
  if (!auth.ok) return bad(auth.error!, auth.status);
  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const { action } = body;
  const now = new Date().toISOString();
  const note = String(body.note || '').trim().slice(0, 300) || null;

  if (action === 'set_global_min') {
    const v = Number(body.value);
    if (isNaN(v) || v < 0) return bad('value_invalid');
    const { error } = await supabaseAdmin.from('app_settings').upsert({ key: 'company.min_topup', value_num: Math.round(v), updated_at: now }, { onConflict: 'key' });
    return error ? bad(error.message) : NextResponse.json({ ok: true, min_topup: Math.round(v) });
  }

  if (action === 'confirm_deposit' || action === 'reject_deposit') {
    const { data: d } = await supabaseAdmin.from('company_deposit_requests').select('*').eq('id', body.id).maybeSingle();
    if (!d) return bad('introuvable', 404);
    if (d.status !== 'pending') return bad('déjà traité', 409);
    if (action === 'reject_deposit') {
      await supabaseAdmin.from('company_deposit_requests').update({ status: 'rejected', note, reviewed_at: now }).eq('id', d.id).eq('status', 'pending');
      await notifyCompany(d.company_id, ['manager'], { title: '❌ Recharge entreprise refusée', body: `La recharge de ${fdj(d.amount)} n'a pas été validée${note ? ` : ${note}` : ''}.`, i18n: { key: 'c.deposit_rejected', params: { amount: fdj(d.amount), note: note ? ` : ${note}` : '' } } });
      return NextResponse.json({ ok: true });
    }
    // Verrou d'idempotence : on ne crédite que si la ligne passe réellement de pending à approved
    const { data: locked } = await supabaseAdmin.from('company_deposit_requests').update({ status: 'approved', note, reviewed_at: now }).eq('id', d.id).eq('status', 'pending').select('id');
    if (!locked?.length) return bad('déjà traité', 409);
    const r = await adjustCompanyWallet(d.company_id, Number(d.amount), 'deposit', { userId: auth.user?.id, note: `Recharge validée (${d.method}${d.reference ? `, réf. ${d.reference}` : ''})` });
    if (!r.ok) { await supabaseAdmin.from('company_deposit_requests').update({ status: 'pending', reviewed_at: null }).eq('id', d.id); return bad(r.error || 'wallet_error'); }
    await notifyCompany(d.company_id, ['manager', 'accountant'], { title: '✅ Cagnotte société rechargée', body: `+${fdj(d.amount)} — nouveau solde : ${fdj(r.balance || 0)}.`, i18n: { key: 'c.deposit_ok', params: { amount: fdj(d.amount), balance: fdj(r.balance || 0) } } });
    let resumed: any[] = [];
    try { const { resumeCompanyAfterTopUp } = await import('../../../../lib/company-orders'); resumed = await resumeCompanyAfterTopUp(d.company_id); } catch (e) { console.error('[companies] resume:', e); }
    return NextResponse.json({ ok: true, balance: r.balance, resumed });
  }

  const { data: company } = await supabaseAdmin.from('companies').select('*').eq('id', body.company_id).maybeSingle();
  if (!company) return bad('Société introuvable', 404);

  switch (action) {
    case 'approve':
    case 'reactivate': {
      await supabaseAdmin.from('companies').update({ status: 'active', admin_note: null, resolved_at: now }).eq('id', company.id);
      await notifyCompany(company.id, ['manager'], action === 'approve'
        ? { title: '🎉 Compte entreprise activé', body: `« ${company.name} » est ouvert : ajoutez vos sites, invitez vos collaborateurs et rechargez la cagnotte pour commander.`, i18n: { key: 'c.activated', params: { name: company.name } } }
        : { title: '✅ Compte entreprise réactivé', body: `« ${company.name} » peut de nouveau commander.`, i18n: { key: 'c.reactivated', params: { name: company.name } } });
      return NextResponse.json({ ok: true });
    }
    case 'reject':
    case 'suspend': {
      await supabaseAdmin.from('companies').update({ status: action === 'reject' ? 'rejected' : 'suspended', admin_note: note, resolved_at: now }).eq('id', company.id);
      await notifyCompany(company.id, ['manager'], action === 'reject'
        ? { title: '❌ Demande de compte entreprise refusée', body: `La demande de « ${company.name} » n'a pas été retenue${note ? ` : ${note}` : ''}.`, i18n: { key: 'c.rejected', params: { name: company.name, note: note ? ` : ${note}` : '' } } }
        : { title: '⏸️ Compte entreprise suspendu', body: `« ${company.name} » ne peut plus commander pour le moment${note ? ` : ${note}` : ''}. Le solde de la cagnotte est conservé.`, i18n: { key: 'c.suspended', params: { name: company.name, note: note ? ` : ${note}` : '' } } });
      return NextResponse.json({ ok: true });
    }
    case 'adjust_wallet': {
      const amt = Math.round(Number(body.amount));
      if (!amt || isNaN(amt)) return bad('amount_invalid');
      const r = await adjustCompanyWallet(company.id, amt, 'adjustment', { userId: auth.user?.id, note: note || 'Ajustement manuel' });
      if (!r.ok) return bad(r.error === 'insufficient' ? 'solde insuffisant pour ce débit' : r.error || 'wallet_error');
      if (amt > 0) { try { const { resumeCompanyAfterTopUp } = await import('../../../../lib/company-orders'); await resumeCompanyAfterTopUp(company.id); } catch { /* ignore */ } }
      return NextResponse.json({ ok: true, balance: r.balance });
    }
    case 'set_company_min': {
      const v = body.value === '' || body.value == null ? null : Number(body.value);
      if (v != null && (isNaN(v) || v < 0)) return bad('value_invalid');
      await supabaseAdmin.from('companies').update({ min_topup: v == null ? null : Math.round(v) }).eq('id', company.id);
      return NextResponse.json({ ok: true });
    }
  }
  return bad('action invalide');
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/admin/companies', GET_);
export const POST = monitored('/api/admin/companies', POST_);
