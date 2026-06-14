import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';

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
      .from('orders').select('id, customer_name, payment_method, phone').in('id', orderIds);
    orderMap = Object.fromEntries((ords || []).map((o: any) => [o.id, o]));
  }
  const list = (refunds || []).map((r: any) => ({ ...r, order: orderMap[r.order_id] || null }));
  return NextResponse.json({ refunds: list });
}

// POST { refund_id } — marquer un remboursement manuel comme effectué
export async function POST(request: Request) {
  const auth = await requirePerm(request, ['refunds', 'wallets'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let refund_id: any;
  try { ({ refund_id } = await request.json()); } catch { /* ignore */ }
  if (!refund_id) return NextResponse.json({ error: 'refund_id requis' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('order_refunds')
    .update({ status: 'done', done_at: new Date().toISOString() })
    .eq('id', refund_id)
    .eq('status', 'pending');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
