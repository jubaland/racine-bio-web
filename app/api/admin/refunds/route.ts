import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';
import { notifyUser } from '../../../../lib/notify';

// GET — journal des remboursements (à effectuer + effectués)
export async function GET(request: Request) {
  const auth = await requirePerm(request, ['refunds', 'wallets'], 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: refunds, error } = await supabaseAdmin
    .from('order_refunds')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orderIds = [...new Set((refunds || []).map((r: any) => r.order_id))];
  let orderMap: Record<string, any> = {};
  if (orderIds.length) {
    const { data: ords } = await supabaseAdmin
      .from('orders').select('id, customer_name, payment_method, phone, user_id').in('id', orderIds);
    orderMap = Object.fromEntries((ords || []).map((o: any) => [o.id, o]));
  }
  const list = (refunds || []).map((r: any) => ({ ...r, order: orderMap[r.order_id] || null }));
  return NextResponse.json({ refunds: list });
}

// POST { refund_id, action } — résoudre un remboursement en attente.
//   action 'waafi'  → marqué remboursé par Waafi (effectué)
//   action 'wallet' → crédite la cagnotte du client (avoir) puis effectué
//   action 'reject' → rejeté (aucun remboursement dû)
export async function POST(request: Request) {
  const auth = await requirePerm(request, ['refunds', 'wallets'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let refund_id: any, action: any;
  try { ({ refund_id, action } = await request.json()); } catch { /* ignore */ }
  if (!refund_id) return NextResponse.json({ error: 'refund_id requis' }, { status: 400 });
  const act = action || 'waafi';
  if (!['waafi', 'wallet', 'reject'].includes(act)) {
    return NextResponse.json({ error: 'action invalide' }, { status: 400 });
  }

  const { data: refund } = await supabaseAdmin
    .from('order_refunds').select('*').eq('id', refund_id).maybeSingle();
  if (!refund) return NextResponse.json({ error: 'Remboursement introuvable' }, { status: 404 });
  if (refund.status !== 'pending') return NextResponse.json({ error: 'already_resolved' }, { status: 409 });

  const { data: order } = await supabaseAdmin
    .from('orders').select('id, user_id').eq('id', refund.order_id).maybeSingle();
  const shortId = String(refund.order_id).slice(0, 8).toUpperCase();
  const amt = `${Number(refund.amount).toLocaleString('fr-FR')} Fdj`;
  const now = new Date().toISOString();

  if (act === 'reject') {
    await supabaseAdmin.from('order_refunds').update({ status: 'rejected', done_at: now }).eq('id', refund_id).eq('status', 'pending');
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  if (act === 'wallet') {
    if (!order?.user_id) return NextResponse.json({ error: 'no_account' }, { status: 400 });
    await supabaseAdmin.rpc('wallet_adjust', {
      p_user: order.user_id,
      p_amount: Number(refund.amount),
      p_type: 'refund',
      p_order: refund.order_id,
      p_note: `Remboursement (avoir) : ${refund.reason || 'commande modifiée'}`,
    });
    await supabaseAdmin.from('order_refunds').update({ method: 'wallet', status: 'done', done_at: now }).eq('id', refund_id).eq('status', 'pending');
    try {
      await notifyUser(order.user_id, {
        title: `💰 Remboursement — Commande #${shortId}`,
        body: `${amt} ont été crédités sur votre cagnotte.`,
        url: '/profile',
      });
    } catch { /* ignore */ }
    return NextResponse.json({ ok: true, status: 'done', method: 'wallet' });
  }

  // act === 'waafi'
  await supabaseAdmin.from('order_refunds').update({ status: 'done', done_at: now }).eq('id', refund_id).eq('status', 'pending');
  if (order?.user_id) {
    try {
      await notifyUser(order.user_id, {
        title: `📱 Remboursement — Commande #${shortId}`,
        body: `${amt} vous ont été remboursés par Waafi.`,
        url: '/profile',
      });
    } catch { /* ignore */ }
  }
  return NextResponse.json({ ok: true, status: 'done', method: 'manual' });
}
