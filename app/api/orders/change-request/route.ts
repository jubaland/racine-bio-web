import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';

async function getUser(request: Request) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!token) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user || null;
}

// POST { order_id, item_id, new_quantity } — le client demande un retrait/réduction.
export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });

  let order_id: any, item_id: any, new_quantity: any;
  try { ({ order_id, item_id, new_quantity } = await request.json()); } catch { /* ignore */ }
  if (!order_id || !item_id) return NextResponse.json({ error: 'order_id et item_id requis' }, { status: 400 });

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, status, order_items ( id, product_id, quantity, price, product_name, product_unit )')
    .eq('id', order_id)
    .single();
  if (!order || order.user_id !== user.id) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  if (!['pending', 'processing'].includes(order.status)) return NextResponse.json({ error: 'order_locked' }, { status: 409 });

  const items: any[] = order.order_items || [];
  const item = items.find((it: any) => String(it.id) === String(item_id));
  if (!item) return NextResponse.json({ error: 'Article introuvable' }, { status: 404 });

  const currentQty = Number(item.quantity);
  const targetQty = new_quantity == null ? 0 : Number(new_quantity);
  if (isNaN(targetQty) || targetQty < 0 || targetQty >= currentQty) {
    return NextResponse.json({ error: 'new_quantity invalide' }, { status: 400 });
  }
  const isRemoval = targetQty === 0;
  if (isRemoval && items.length <= 1) return NextResponse.json({ error: 'last_item' }, { status: 409 });

  // Pas deux demandes en attente sur le même article
  const { data: dup } = await supabaseAdmin
    .from('order_change_requests')
    .select('id').eq('item_id', item_id).eq('status', 'pending').maybeSingle();
  if (dup) return NextResponse.json({ error: 'already_requested' }, { status: 409 });

  const refundAmount = Number(item.price) * (currentQty - targetQty);
  const { error: insErr } = await supabaseAdmin.from('order_change_requests').insert({
    order_id, item_id, user_id: user.id,
    product_name: item.product_name || null,
    unit: item.product_unit || null,
    type: isRemoval ? 'remove' : 'reduce',
    current_quantity: currentQty,
    new_quantity: targetQty,
    refund_amount: refundAmount,
    status: 'pending',
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Alerter l'admin (cloche + push)
  try {
    const { sendPushToAdmin } = await import('../../../../lib/push');
    const shortId = String(order_id).slice(0, 8).toUpperCase();
    const what = isRemoval ? `retrait de « ${item.product_name || 'article'} »` : `réduction de « ${item.product_name || 'article'} » à ${targetQty}`;
    await sendPushToAdmin({ title: '✋ Demande de modification', body: `Commande #${shortId} : ${what}`, url: '/admin' });
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true });
}

// GET — demandes en attente (admin / gestionnaire Commandes)
export async function GET(request: Request) {
  const auth = await requirePerm(request, 'orders', 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: reqs, error } = await supabaseAdmin
    .from('order_change_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Infos commande (client) pour l'affichage
  const orderIds = [...new Set((reqs || []).map((r: any) => r.order_id))];
  let orderMap: Record<string, any> = {};
  if (orderIds.length) {
    const { data: ords } = await supabaseAdmin
      .from('orders').select('id, customer_name, status, payment_method').in('id', orderIds);
    orderMap = Object.fromEntries((ords || []).map((o: any) => [o.id, o]));
  }
  const requests = (reqs || []).map((r: any) => ({ ...r, order: orderMap[r.order_id] || null }));
  return NextResponse.json({ requests });
}
