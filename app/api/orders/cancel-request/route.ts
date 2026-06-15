import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';

// GET — demandes d'annulation en attente (admin / gestionnaire Commandes)
export async function GET(request: Request) {
  const auth = await requirePerm(request, 'orders', 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: reqs, error } = await supabaseAdmin
    .from('order_cancel_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orderIds = [...new Set((reqs || []).map((r: any) => r.order_id))];
  let orderMap: Record<string, any> = {};
  if (orderIds.length) {
    const { data: ords } = await supabaseAdmin
      .from('orders').select('id, customer_name, status, total, payment_method').in('id', orderIds);
    orderMap = Object.fromEntries((ords || []).map((o: any) => [o.id, o]));
  }
  const requests = (reqs || []).map((r: any) => ({ ...r, order: orderMap[r.order_id] || null }));
  return NextResponse.json({ requests });
}
