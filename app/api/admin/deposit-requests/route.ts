import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { sendDepositApproved } from '../../../../lib/emails';
import { requirePerm } from '../../../../lib/admin-auth';

// Liste des demandes de recharge — récentes d'abord, en attente en tête
export async function GET(request: Request) {
  const auth = await requirePerm(request, 'wallets', 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await supabaseAdmin
    .from('deposit_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ids = [...new Set((data || []).map((r: any) => r.user_id))];
  const info: Record<string, { name: string | null; email: string | null }> = {};
  await Promise.all(ids.map(async (id) => {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
    info[id] = { name: u?.user?.user_metadata?.full_name ?? null, email: u?.user?.email ?? null };
  }));
  const requests = (data || []).map((r: any) => ({ ...r, ...info[r.user_id] }));
  return NextResponse.json({ requests });
}

// Valider ou refuser une demande
export async function POST(request: Request) {
  const auth = await requirePerm(request, 'wallets', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id, action, note } = await request.json();
  const { data: req } = await supabaseAdmin.from('deposit_requests').select('*').eq('id', id).single();
  if (!req) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
  if (req.status !== 'pending') return NextResponse.json({ error: 'déjà traité' }, { status: 400 });

  if (action === 'approve') {
    const { data: bal, error } = await supabaseAdmin.rpc('wallet_adjust', {
      p_user: req.user_id, p_amount: Number(req.amount), p_type: 'deposit', p_order: null,
      p_note: 'Recharge validée' + (req.reference ? ` (réf. ${req.reference})` : ''),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await supabaseAdmin.from('deposit_requests')
      .update({ status: 'approved', note: note || null, reviewed_at: new Date().toISOString() }).eq('id', id);
    // Notifs client — awaitées (serverless)
    try {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(req.user_id);
      if (u?.user?.email) await sendDepositApproved(u.user.email, Number(req.amount), Number(bal));
    } catch (e) { console.error('[deposit approve] email error:', e); }
    try {
      const { sendPushToUser } = await import('../../../../lib/push');
      await sendPushToUser(req.user_id, { title: '✅ Cagnotte rechargée', body: `+${Number(req.amount).toLocaleString('fr-FR')} Fdj`, url: '/profile' });
    } catch (e) { console.error('[deposit approve] push error:', e); }
    return NextResponse.json({ ok: true, balance: bal });
  }

  if (action === 'reject') {
    await supabaseAdmin.from('deposit_requests')
      .update({ status: 'rejected', note: note || null, reviewed_at: new Date().toISOString() }).eq('id', id);
    try {
      const { sendPushToUser } = await import('../../../../lib/push');
      await sendPushToUser(req.user_id, { title: '❌ Recharge refusée', body: 'Votre demande de recharge n\'a pas été validée. Contactez-nous.', url: '/profile' });
    } catch (e) { console.error('[deposit reject] push error:', e); }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'action invalide' }, { status: 400 });
}
