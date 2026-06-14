import { supabaseAdmin } from './supabase-admin';

export type RefundMethod = 'wallet' | 'cash' | 'manual' | 'none';

// Rembourse `amount` selon le moyen de paiement de la commande.
//  - wallet : recrédite la cagnotte (transaction tracée)
//  - cash   : rien à rembourser (payé à la livraison) → on a juste réduit le dû
//  - waafi/dmoney : remboursement manuel à effectuer → 'manual'
export async function refundOrderAmount(
  order: { id: string | number; payment_method: string; user_id: string | null },
  amount: number,
  note: string,
): Promise<RefundMethod> {
  if (!amount || amount <= 0) return 'none';

  let method: RefundMethod;
  if (order.payment_method === 'wallet' && order.user_id) {
    await supabaseAdmin.rpc('wallet_adjust', {
      p_user: order.user_id,
      p_amount: amount,
      p_type: 'refund',
      p_order: order.id,
      p_note: note,
    });
    method = 'wallet';
  } else if (order.payment_method === 'cash') {
    return 'cash'; // montant dû réduit : aucun remboursement à effectuer
  } else {
    method = 'manual'; // waafi / dmoney → remboursement manuel
  }

  // Journal : cagnotte = déjà effectué ; manuel = à effectuer
  try {
    await supabaseAdmin.from('order_refunds').insert({
      order_id: order.id,
      amount,
      method,
      reason: note,
      status: method === 'wallet' ? 'done' : 'pending',
      done_at: method === 'wallet' ? new Date().toISOString() : null,
    });
  } catch (e) { console.error('[refund] log insert failed:', e); }

  return method;
}
