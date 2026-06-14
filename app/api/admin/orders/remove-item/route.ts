import { NextResponse } from 'next/server';
import { requirePerm } from '../../../../../lib/admin-auth';
import { applyItemChange } from '../../../../../lib/order-edit';

// POST { order_id, item_id, new_quantity? } — retrait/réduction direct par l'admin.
export async function POST(request: Request) {
  const auth = await requirePerm(request, 'orders', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let order_id: any, item_id: any, new_quantity: any;
  try { ({ order_id, item_id, new_quantity } = await request.json()); } catch { /* ignore */ }
  if (!order_id || !item_id) return NextResponse.json({ error: 'order_id et item_id requis' }, { status: 400 });

  const r = await applyItemChange(order_id, item_id, new_quantity ?? null);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
