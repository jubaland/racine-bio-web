import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requirePerm } from '../../../../../lib/admin-auth';
import { notifyUser } from '../../../../../lib/notify';

// POST { order_id, item_id } — retire un article d'une commande payée.
// Restaure le stock, recalcule le total, et rembourse selon le moyen de paiement :
//  - wallet : recrédit de la cagnotte (avoir)
//  - cash   : réduction du montant dû (rien à rembourser)
//  - waafi  : remboursement manuel signalé (la commande est ajustée)
export async function POST(request: Request) {
  const auth = await requirePerm(request, 'orders', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let order_id: any, item_id: any;
  try { ({ order_id, item_id } = await request.json()); } catch { /* ignore */ }
  if (!order_id || !item_id) return NextResponse.json({ error: 'order_id et item_id requis' }, { status: 400 });

  // Commande + articles
  const { data: order, error: oErr } = await supabaseAdmin
    .from('orders')
    .select('id, status, payment_method, user_id, total, delivery_fee, order_items ( id, product_id, quantity, price, product_name )')
    .eq('id', order_id)
    .single();
  if (oErr || !order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });

  // Fenêtre de modification : avant expédition uniquement
  if (!['pending', 'processing'].includes(order.status)) {
    return NextResponse.json({ error: 'order_locked' }, { status: 409 });
  }

  const items: any[] = order.order_items || [];
  const item = items.find((it: any) => String(it.id) === String(item_id));
  if (!item) return NextResponse.json({ error: 'Article introuvable' }, { status: 404 });

  // On ne vide pas une commande : pour tout retirer, annuler la commande.
  if (items.length <= 1) {
    return NextResponse.json({ error: 'last_item' }, { status: 409 });
  }

  const refundAmount = Number(item.price) * Number(item.quantity);

  // 1) Restaurer le stock
  const { data: prod } = await supabaseAdmin.from('products').select('stock_qty').eq('id', item.product_id).maybeSingle();
  await supabaseAdmin.from('products')
    .update({ stock_qty: (Number(prod?.stock_qty) || 0) + Number(item.quantity) })
    .eq('id', item.product_id);

  // 2) Supprimer la ligne
  const { error: delErr } = await supabaseAdmin.from('order_items').delete().eq('id', item.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // 3) Recalculer le total (articles restants + frais de livraison inchangés)
  const remainingItemsTotal = items
    .filter((it: any) => String(it.id) !== String(item_id))
    .reduce((s: number, it: any) => s + Number(it.price) * Number(it.quantity), 0);
  const deliveryFee = Number(order.delivery_fee) || 0;
  const newTotal = remainingItemsTotal + deliveryFee;
  await supabaseAdmin.from('orders').update({ total: newTotal }).eq('id', order_id);

  // 4) Remboursement selon le moyen de paiement
  let refundMethod: 'wallet' | 'cash' | 'manual' = 'manual';
  if (order.payment_method === 'wallet' && order.user_id) {
    refundMethod = 'wallet';
    await supabaseAdmin.rpc('wallet_adjust', {
      p_user: order.user_id,
      p_amount: refundAmount,
      p_type: 'refund',
      p_order: order_id,
      p_note: `Remboursement : ${item.product_name || 'article'} retiré`,
    });
  } else if (order.payment_method === 'cash') {
    refundMethod = 'cash';
  } else {
    refundMethod = 'manual'; // waafi / dmoney → remboursement manuel
  }

  // 5) Notifier le client (centre de notifications + push)
  if (order.user_id) {
    const shortId = String(order_id).slice(0, 8).toUpperCase();
    const amt = `${refundAmount.toLocaleString('fr-FR')} Fdj`;
    const body =
      refundMethod === 'wallet' ? `« ${item.product_name || 'Article'} » retiré. ${amt} recrédités sur votre cagnotte.`
      : refundMethod === 'cash' ? `« ${item.product_name || 'Article'} » retiré. Votre montant à payer baisse de ${amt}.`
      : `« ${item.product_name || 'Article'} » retiré. Remboursement de ${amt} par Waafi en cours.`;
    try {
      await notifyUser(order.user_id, { title: `🧾 Commande #${shortId} modifiée`, body, url: '/profile' });
    } catch { /* ignore */ }
  }

  return NextResponse.json({ ok: true, newTotal, refundAmount, refundMethod });
}
