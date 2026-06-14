import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requirePerm } from '../../../../../lib/admin-auth';
import { notifyUser } from '../../../../../lib/notify';
import { refundOrderAmount } from '../../../../../lib/order-refund';

// POST { order_id, item_id, new_quantity? }
//  - new_quantity absent / 0      → retire l'article entier
//  - 0 < new_quantity < quantité  → réduit la quantité
// Restaure le stock du delta, recalcule le total, rembourse selon le paiement.
export async function POST(request: Request) {
  const auth = await requirePerm(request, 'orders', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let order_id: any, item_id: any, new_quantity: any;
  try { ({ order_id, item_id, new_quantity } = await request.json()); } catch { /* ignore */ }
  if (!order_id || !item_id) return NextResponse.json({ error: 'order_id et item_id requis' }, { status: 400 });

  const { data: order, error: oErr } = await supabaseAdmin
    .from('orders')
    .select('id, status, payment_method, user_id, total, delivery_fee, order_items ( id, product_id, quantity, price, product_name )')
    .eq('id', order_id)
    .single();
  if (oErr || !order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });

  if (!['pending', 'processing'].includes(order.status)) {
    return NextResponse.json({ error: 'order_locked' }, { status: 409 });
  }

  const items: any[] = order.order_items || [];
  const item = items.find((it: any) => String(it.id) === String(item_id));
  if (!item) return NextResponse.json({ error: 'Article introuvable' }, { status: 404 });

  const currentQty = Number(item.quantity);
  const targetQty = new_quantity == null ? 0 : Number(new_quantity);
  if (isNaN(targetQty) || targetQty < 0) return NextResponse.json({ error: 'new_quantity invalide' }, { status: 400 });
  if (targetQty >= currentQty) return NextResponse.json({ error: 'no_decrease' }, { status: 400 });

  const isRemoval = targetQty === 0;
  if (isRemoval && items.length <= 1) {
    return NextResponse.json({ error: 'last_item' }, { status: 409 });
  }

  const removedQty = currentQty - targetQty;            // quantité rendue
  const refundAmount = Number(item.price) * removedQty;

  // 1) Restaurer le stock (du delta retiré)
  const { data: prod } = await supabaseAdmin.from('products').select('stock_qty').eq('id', item.product_id).maybeSingle();
  await supabaseAdmin.from('products')
    .update({ stock_qty: (Number(prod?.stock_qty) || 0) + removedQty })
    .eq('id', item.product_id);

  // 2) Supprimer la ligne (retrait) ou réduire la quantité
  if (isRemoval) {
    const { error } = await supabaseAdmin.from('order_items').delete().eq('id', item.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin.from('order_items').update({ quantity: targetQty }).eq('id', item.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 3) Recalculer le total (articles restants + frais de livraison inchangés)
  const remainingItemsTotal = items.reduce((s: number, it: any) => {
    if (String(it.id) !== String(item_id)) return s + Number(it.price) * Number(it.quantity);
    return s + Number(it.price) * targetQty;            // ligne modifiée
  }, 0);
  const deliveryFee = Number(order.delivery_fee) || 0;
  const newTotal = remainingItemsTotal + deliveryFee;
  await supabaseAdmin.from('orders').update({ total: newTotal }).eq('id', order_id);

  // 4) Remboursement selon le moyen de paiement
  const name = item.product_name || 'article';
  const refundMethod = await refundOrderAmount(
    order, refundAmount,
    isRemoval ? `Remboursement : ${name} retiré` : `Remboursement : ${name} (qté réduite)`,
  );

  // 5) Notifier le client (centre + push)
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

  // 6) Renvoyer un bordereau MIS À JOUR aux préparateurs (ils avaient l'ancien)
  try {
    const { data: fresh } = await supabaseAdmin
      .from('orders')
      .select('id, total, payment_method, delivery_option_name, customer_name, phone, address, special_instructions, created_at, order_items ( product_id, quantity, product_name, product_unit, product_farm )')
      .eq('id', order_id)
      .single();
    const { data: preps } = await supabaseAdmin.from('preparers').select('email').eq('is_active', true);
    const prepEmails = (preps || []).map((p: any) => p.email).filter(Boolean);
    if (fresh && prepEmails.length) {
      const { sendPrepSlipToPreparers } = await import('../../../../../lib/emails');
      await sendPrepSlipToPreparers(fresh, fresh.order_items || [], prepEmails, true);
    }
  } catch (e) { console.error('[prep] re-send slip failed:', e); }

  return NextResponse.json({ ok: true, newTotal, refundAmount, refundMethod, removed: isRemoval });
}
