import { supabaseAdmin } from './supabase-admin';
import { refundOrderAmount } from './order-refund';
import { sendStatusUpdate, sendOrderCancelledToPreparers } from './emails';

// Marque comme traitées les demandes d'annulation en attente d'une commande.
async function resolvePendingCancelRequests(orderId: any) {
  await supabaseAdmin.from('order_cancel_requests')
    .update({ status: 'approved', resolved_at: new Date().toISOString() })
    .eq('order_id', orderId).eq('status', 'pending');
}

// Annulation effective : stock restauré, remboursement, statut, notifications
// (client + préparateurs). Mutualisé entre annulation admin directe et validation
// d'une demande de gestionnaire. Idempotent (garde « déjà annulée »).
export async function executeCancellation(orderId: any): Promise<{ ok: boolean; error?: string }> {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, status, total, payment_method, user_id, email, customer_name')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: 'not_found' };
  if (order.status === 'cancelled') { await resolvePendingCancelRequests(orderId); return { ok: true }; }

  // 1) Restaurer le stock
  const { data: items } = await supabaseAdmin
    .from('order_items').select('product_id, quantity').eq('order_id', orderId);
  if (items && items.length) {
    const ids = items.map((i: any) => i.product_id);
    const { data: stockData } = await supabaseAdmin.from('products').select('id, stock_qty').in('id', ids);
    const stockMap: Record<number, number> = Object.fromEntries((stockData || []).map((p: any) => [p.id, p.stock_qty ?? 0]));
    await Promise.all(items.map((it: any) =>
      supabaseAdmin.from('products').update({ stock_qty: (stockMap[it.product_id] ?? 0) + it.quantity }).eq('id', it.product_id)
    ));
  }

  // 2) Remboursement (cagnotte auto / espèces rien / Waafi à effectuer)
  await refundOrderAmount(
    { id: orderId, payment_method: order.payment_method, user_id: order.user_id },
    Number(order.total) || 0,
    'Remboursement : commande annulée',
  );

  // 3) Statut annulé
  const { data: updated } = await supabaseAdmin
    .from('orders').update({ status: 'cancelled' }).eq('id', orderId).select().single();

  // 4) Notifier le client (email + push)
  try {
    let customerEmail: string | null = order.email ?? null;
    if (order.user_id) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(order.user_id);
      customerEmail = userData?.user?.email ?? null;
    }
    if (customerEmail && updated) await sendStatusUpdate(updated, customerEmail);
    if (order.user_id) {
      const { sendPushToUser } = await import('./push');
      await sendPushToUser(order.user_id, {
        title: '❌ Commande annulée',
        body: `Commande #${String(orderId).slice(0, 8).toUpperCase()}`,
        url: '/profile',
      });
    }
    // 5) Préparateurs : ne pas préparer
    const { data: preps } = await supabaseAdmin.from('preparers').select('email').eq('is_active', true);
    const prepEmails = (preps || []).map((p: any) => p.email).filter(Boolean);
    if (prepEmails.length && updated) await sendOrderCancelledToPreparers(updated, prepEmails);
  } catch (e) { console.error('[cancel] notify failed:', e); }

  // 6) Clôturer les demandes d'annulation en attente
  await resolvePendingCancelRequests(orderId);
  return { ok: true };
}
