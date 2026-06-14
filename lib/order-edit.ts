import { supabaseAdmin } from './supabase-admin';
import { notifyUser } from './notify';
import { refundOrderAmount } from './order-refund';

export type ItemChangeResult =
  | { ok: false; status: number; error: string }
  | { ok: true; newTotal: number; refundAmount: number; refundMethod: string; removed: boolean };

// Applique le retrait (new_quantity 0/null) ou la réduction d'un article :
// stock restauré, total recalculé, remboursement selon le paiement, notif client,
// bordereau préparateurs mis à jour. Utilisé par l'admin direct ET l'approbation de demande.
export async function applyItemChange(order_id: any, item_id: any, new_quantity: number | null): Promise<ItemChangeResult> {
  const { data: order, error: oErr } = await supabaseAdmin
    .from('orders')
    .select('id, status, payment_method, user_id, total, delivery_fee, order_items ( id, product_id, quantity, price, product_name, product_unit )')
    .eq('id', order_id)
    .single();
  if (oErr || !order) return { ok: false, status: 404, error: 'Commande introuvable' };
  if (!['pending', 'processing'].includes(order.status)) return { ok: false, status: 409, error: 'order_locked' };

  const items: any[] = order.order_items || [];
  const item = items.find((it: any) => String(it.id) === String(item_id));
  if (!item) return { ok: false, status: 404, error: 'Article introuvable' };

  const currentQty = Number(item.quantity);
  const targetQty = new_quantity == null ? 0 : Number(new_quantity);
  if (isNaN(targetQty) || targetQty < 0) return { ok: false, status: 400, error: 'new_quantity invalide' };
  if (targetQty >= currentQty) return { ok: false, status: 400, error: 'no_decrease' };

  const isRemoval = targetQty === 0;
  if (isRemoval && items.length <= 1) return { ok: false, status: 409, error: 'last_item' };

  const removedQty = currentQty - targetQty;
  const refundAmount = Number(item.price) * removedQty;

  // Stock (delta rendu)
  const { data: prod } = await supabaseAdmin.from('products').select('stock_qty').eq('id', item.product_id).maybeSingle();
  await supabaseAdmin.from('products')
    .update({ stock_qty: (Number(prod?.stock_qty) || 0) + removedQty })
    .eq('id', item.product_id);

  // Ligne : suppression ou réduction
  if (isRemoval) {
    const { error } = await supabaseAdmin.from('order_items').delete().eq('id', item.id);
    if (error) return { ok: false, status: 500, error: error.message };
  } else {
    const { error } = await supabaseAdmin.from('order_items').update({ quantity: targetQty }).eq('id', item.id);
    if (error) return { ok: false, status: 500, error: error.message };
  }

  // Total
  const remainingItemsTotal = items.reduce((s: number, it: any) =>
    s + Number(it.price) * (String(it.id) === String(item_id) ? targetQty : Number(it.quantity)), 0);
  const newTotal = remainingItemsTotal + (Number(order.delivery_fee) || 0);
  await supabaseAdmin.from('orders').update({ total: newTotal }).eq('id', order_id);

  // Remboursement
  const name = item.product_name || 'article';
  const refundMethod = await refundOrderAmount(
    order, refundAmount,
    isRemoval ? `Remboursement : ${name} retiré` : `Remboursement : ${name} (qté réduite)`,
  );

  // Notif client
  if (order.user_id) {
    const shortId = String(order_id).slice(0, 8).toUpperCase();
    const amt = `${refundAmount.toLocaleString('fr-FR')} Fdj`;
    const what = isRemoval ? `« ${name} » retiré` : `« ${name} » réduit à ${targetQty}`;
    const tail =
      refundMethod === 'wallet' ? `${amt} recrédités sur votre cagnotte.`
      : refundMethod === 'cash' ? `Votre montant à payer baisse de ${amt}.`
      : `Remboursement de ${amt} par Waafi en cours.`;
    try {
      await notifyUser(order.user_id, { title: `🧾 Commande #${shortId} modifiée`, body: `${what}. ${tail}`, url: '/profile' });
    } catch { /* ignore */ }
  }

  // Bordereau préparateurs mis à jour
  try {
    const { data: fresh } = await supabaseAdmin
      .from('orders')
      .select('id, total, payment_method, delivery_option_name, customer_name, phone, address, special_instructions, created_at, order_items ( product_id, quantity, product_name, product_unit, product_farm )')
      .eq('id', order_id)
      .single();
    const { data: preps } = await supabaseAdmin.from('preparers').select('email').eq('is_active', true);
    const prepEmails = (preps || []).map((p: any) => p.email).filter(Boolean);
    if (fresh && prepEmails.length) {
      const { sendPrepSlipToPreparers } = await import('./emails');
      await sendPrepSlipToPreparers(fresh, fresh.order_items || [], prepEmails, true);
    }
  } catch (e) { console.error('[prep] re-send slip failed:', e); }

  return { ok: true, newTotal, refundAmount, refundMethod, removed: isRemoval };
}
