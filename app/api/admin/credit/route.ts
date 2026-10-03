import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';
import { creditOverview, accountById, entriesOf, recordPayment, saveCreditSettings, creditSettings, fdj, holderUserIds } from '../../../../lib/credit';
import { monitored } from '../../../../lib/monitor';

// Admin › Crédit clients : comptes (plafond, échéance, statut), paiements reçus, journal, réglages.

const optInt = (v: unknown): number | null | undefined => { if (v === '' || v == null) return null; const n = Number(v); return Number.isInteger(n) && n >= 0 ? n : undefined; };

async function userIdByEmail(email: string): Promise<{ id: string; name: string } | null> {
  const wanted = email.trim().toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const hit = (data?.users || []).find(u => u.email?.toLowerCase() === wanted);
    if (hit) return { id: hit.id, name: hit.user_metadata?.full_name || hit.email || '' };
    if (!data?.users || data.users.length < 1000) return null;
  }
}

async function GET_(request: Request) {
  const auth = await requirePerm(request, ['credit'], 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = new URL(request.url).searchParams.get('entries');
  if (id) return NextResponse.json({ entries: await entriesOf(Number(id), 300) });
  const { data: companies } = await supabaseAdmin.from('companies').select('id, name').eq('status', 'active').order('name');
  return NextResponse.json({ ...(await creditOverview()), companies: companies || [] });
}

async function POST_(request: Request) {
  const auth = await requirePerm(request, ['credit'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');
  const now = new Date().toISOString();

  if (action === 'save_settings') {
    const s: Record<string, unknown> = {};
    for (const k of ['remind_before_days', 'overdue_remind_days', 'suspend_after_days', 'default_term_days'] as const) {
      if (k in body) { const v = optInt(body[k]); if (v === undefined || (k === 'default_term_days' && v === 0)) return NextResponse.json({ error: 'number_invalid', field: k }, { status: 400 }); s[k] = v ?? 0; }
    }
    if ('default_limit' in body) { const v = optInt(body.default_limit); if (v === undefined) return NextResponse.json({ error: 'number_invalid', field: 'default_limit' }, { status: 400 }); s.default_limit = v || null; }
    if ('default_term' in body) s.default_term = body.default_term === 'days' ? 'days' : 'month_end';
    if ('enabled' in body) s.enabled = !!body.enabled;
    await saveCreditSettings(s);
    return NextResponse.json(await creditOverview());
  }

  if (action === 'create') {
    const limit = optInt(body.credit_limit);
    if (limit === undefined || !limit) return NextResponse.json({ error: 'limit_invalid' }, { status: 400 });
    const term = body.term === 'days' ? 'days' : 'month_end';
    const term_days = term === 'days' ? optInt(body.term_days) : null;
    if (term === 'days' && !term_days) return NextResponse.json({ error: 'term_days_invalid' }, { status: 400 });
    let row: Record<string, unknown>;
    if (body.holder_type === 'company') {
      const { data: c } = await supabaseAdmin.from('companies').select('id').eq('id', Number(body.company_id)).maybeSingle();
      if (!c) return NextResponse.json({ error: 'company_not_found' }, { status: 400 });
      row = { holder_type: 'company', company_id: c.id };
    } else {
      const u = await userIdByEmail(String(body.email || ''));
      if (!u) return NextResponse.json({ error: 'user_not_found' }, { status: 400 });
      row = { holder_type: 'user', user_id: u.id };
    }
    const { data: created, error } = await supabaseAdmin.from('credit_accounts').insert({ ...row, credit_limit: limit, term, term_days, note: String(body.note || '').trim().slice(0, 300) || null, created_by: auth.user.id }).select('id').single();
    if (error) return NextResponse.json({ error: /duplicate|unique/i.test(error.message) ? 'already_exists' : error.message }, { status: 409 });
    // Titulaire(s) prévenu(s)
    try {
      const { notifyWithEmail } = await import('../../../../lib/notify');
      const acc = await accountById(created.id);
      for (const uid of acc ? await holderUserIds(acc) : []) {
        await notifyWithEmail(uid, { title: '💳 Crédit Hornafresh activé', body: `Vous pouvez commander à crédit jusqu'à ${fdj(limit)}, à régler ${term === 'days' ? `sous ${term_days} jours` : 'en fin de mois'}. Choisissez « Crédit » au paiement.`, url: '/profile', subject: 'Votre crédit Hornafresh est activé',
          i18n: { key: term === 'days' ? 'credit.activated_days' : 'credit.activated_month', params: { limit: fdj(limit), days: term_days ?? 0 } } });
      }
    } catch { /* ignore */ }
    return NextResponse.json(await creditOverview());
  }

  const account = await accountById(Number(body.id));
  if (!account) return NextResponse.json({ error: 'account_not_found' }, { status: 404 });

  if (action === 'update') {
    const patch: Record<string, unknown> = { updated_at: now };
    if ('credit_limit' in body) { const v = optInt(body.credit_limit); if (v === undefined) return NextResponse.json({ error: 'limit_invalid' }, { status: 400 }); patch.credit_limit = v ?? 0; }
    if ('term' in body) { patch.term = body.term === 'days' ? 'days' : 'month_end'; const td = optInt(body.term_days); if (patch.term === 'days' && !td) return NextResponse.json({ error: 'term_days_invalid' }, { status: 400 }); patch.term_days = patch.term === 'days' ? td : null; }
    if ('note' in body) patch.note = String(body.note || '').trim().slice(0, 300) || null;
    const { error } = await supabaseAdmin.from('credit_accounts').update(patch).eq('id', account.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(await creditOverview());
  }

  if (action === 'suspend' || action === 'reactivate') {
    const suspend = action === 'suspend';
    const { error } = await supabaseAdmin.from('credit_accounts').update({ status: suspend ? 'suspended' : 'active', auto_suspended: false, suspended_at: suspend ? now : null, suspended_reason: suspend ? (String(body.reason || '').trim().slice(0, 300) || null) : null, updated_at: now }).eq('id', account.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    try {
      const { notifyUser } = await import('../../../../lib/notify');
      for (const uid of await holderUserIds(account)) {
        await notifyUser(uid, suspend
          ? { title: '🛑 Crédit suspendu', body: `Votre crédit Hornafresh est suspendu${body.reason ? ` : ${String(body.reason).slice(0, 200)}` : ''}. Contactez-nous pour en savoir plus.`, url: '/profile', i18n: { key: 'credit.suspended_admin', params: { reason: body.reason ? ` : ${String(body.reason).slice(0, 200)}` : '' } } }
          : { title: '✅ Crédit réactivé', body: 'Vous pouvez de nouveau commander à crédit.', url: '/profile', i18n: { key: 'credit.reactivated', params: {} } });
      }
    } catch { /* ignore */ }
    return NextResponse.json(await creditOverview());
  }

  if (action === 'pay') {
    const amount = optInt(body.amount);
    if (amount === undefined || !amount) return NextResponse.json({ error: 'amount_invalid' }, { status: 400 });
    const method = ['cash', 'waafi', 'dmoney', 'other'].includes(body.method) ? body.method : 'cash';
    const r = await recordPayment(account, amount, method, String(body.note || '').trim().slice(0, 300) || null, auth.user.id);
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 });
    return NextResponse.json({ ...(await creditOverview()), payment: { id: r.payment_id, unallocated: r.unallocated, reactivated: r.reactivated } });
  }

  if (action === 'delete') {
    const s = await creditOverview();
    const a = s.accounts.find(x => x.account.id === account.id);
    if (a && (a.outstanding !== 0 || a.open.length)) return NextResponse.json({ error: 'has_balance' }, { status: 409 });
    const { count } = await supabaseAdmin.from('credit_entries').select('id', { count: 'exact', head: true }).eq('account_id', account.id);
    if (count) return NextResponse.json({ error: 'has_history' }, { status: 409 });
    await supabaseAdmin.from('credit_accounts').delete().eq('id', account.id);
    return NextResponse.json(await creditOverview());
  }

  if (action === 'settings') return NextResponse.json({ settings: await creditSettings() });
  return NextResponse.json({ error: 'action_invalid' }, { status: 400 });
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/admin/credit', GET_);
export const POST = monitored('/api/admin/credit', POST_);
