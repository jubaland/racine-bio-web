import { supabaseAdmin } from './supabase-admin';
import { notifyUser } from './notify';
import { refundOrderAmount } from './order-refund';

export type EditActor = { id: string | null; name: string | null; role: 'admin' | 'manager' | 'system' };
export type EditOptions = {
  actor?: EditActor;
  reason?: string | null;
  // true : commande modifiable quel que soit son statut (sauf annulée) — admin/gestionnaire.
  // false (défaut) : seulement en attente / en préparation — demandes des clients.
  anyStatus?: boolean;
};
export type ItemChangeResult =
  | { ok: false; status: number; error: string; available?: number }
  | { ok: true; newTotal: number; refundAmount: number; refundMethod: string; removed: boolean; newQty: number };

// Applique le retrait (new_quantity 0/null), la réduction OU l'augmentation d'un article :
// stock ajusté, total recalculé, remboursement ou complément selon le paiement, notif client,
// bordereau préparateurs mis à jour, journal des modifications (order_edits).
// Garde-fous : après expédition/livraison, motif obligatoire et alerte admin si l'auteur
// n'est pas administrateur ; commande annulée intouchable ; fidélité recalculée (tampon retiré
// si la commande livrée passe sous la commande minimale).
export async function applyItemChange(order_id: any, item_id: any, new_quantity: number | null, opts: EditOptions = {}): Promise<ItemChangeResult> {
  const { data: order, error: oErr } = await supabaseAdmin
    .from('orders')
    .select('id, status, payment_method, user_id, company_id, total, delivery_fee, promo_discount, admin_discount, customer_name, order_items ( id, product_id, quantity, price, discount, product_name, product_unit )')
    .eq('id', order_id)
    .single();
  if (oErr || !order) return { ok: false, status: 404, error: 'Commande introuvable' };
  if (order.status === 'cancelled') return { ok: false, status: 409, error: 'order_cancelled' };
  const shipped = !['pending', 'processing'].includes(order.status);
  if (shipped && !opts.anyStatus) return { ok: false, status: 409, error: 'order_locked' };
  const reason = String(opts.reason || '').trim().slice(0, 300) || null;
  if (shipped && !reason) return { ok: false, status: 400, error: 'reason_required' };

  const items: any[] = order.order_items || [];
  const item = items.find((it: any) => String(it.id) === String(item_id));
  if (!item) return { ok: false, status: 404, error: 'Article introuvable' };

  const currentQty = Number(item.quantity);
  const targetQty = new_quantity == null ? 0 : Number(new_quantity);
  if (isNaN(targetQty) || targetQty < 0 || !Number.isInteger(targetQty)) return { ok: false, status: 400, error: 'new_quantity invalide' };
  if (targetQty === currentQty) return { ok: false, status: 400, error: 'no_change' };

  const isRemoval = targetQty === 0;
  const isIncrease = targetQty > currentQty;
  if (isRemoval && items.length <= 1) return { ok: false, status: 409, error: 'last_item' };

  const name = item.product_name || 'article';
  const shortId = String(order_id).slice(0, 8).toUpperCase();
  const { applyStockDeltas, reserveStock } = await import('./bundles');
  const lineDiscount = Number(item.discount) || 0;
  let refundAmount = 0;            // montant rendu (réduction) …
  let extraAmount = 0;             // … ou réclamé (augmentation)
  let refundMethod = 'none';
  let keptDiscount = lineDiscount;

  if (isIncrease) {
    // ── Augmentation : stock réservé atomiquement, complément débité selon le paiement ─────────
    const addQty = targetQty - currentQty;
    extraAmount = Number(item.price) * addQty;   // la remise de ligne éventuelle ne grandit pas
    const reservation = await reserveStock(supabaseAdmin, [{ product_id: item.product_id, quantity: addQty }]);
    if (!reservation.ok) {
      const short = reservation.short.find(s => s.product_id === item.product_id);
      return { ok: false, status: 409, error: 'stock_insufficient', available: short ? currentQty + short.available : currentQty };
    }
    const releaseExtra = () => applyStockDeltas(supabaseAdmin, [{ product_id: item.product_id, delta: addQty }]).catch(e => console.error('[order-edit] release stock:', e));
    if (order.payment_method === 'wallet' && order.user_id) {
      const { data: w } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', order.user_id).maybeSingle();
      if ((Number(w?.balance) || 0) < extraAmount) { await releaseExtra(); return { ok: false, status: 409, error: 'wallet_insufficient' }; }
      await supabaseAdmin.rpc('wallet_adjust', { p_user: order.user_id, p_amount: -extraAmount, p_type: 'debit', p_order: order.id, p_note: `Quantité augmentée : ${name}` });
      refundMethod = 'wallet';
    } else if (order.payment_method === 'company_wallet' && order.company_id) {
      const { adjustCompanyWallet } = await import('./company');
      const debit = await adjustCompanyWallet(Number(order.company_id), -extraAmount, 'debit', { orderId: Number(order.id), userId: opts.actor?.id ?? null, note: `Quantité augmentée : ${name} (commande #${order.id})` });
      if (!debit.ok) { await releaseExtra(); return { ok: false, status: 409, error: 'company_wallet_insufficient' }; }
      refundMethod = 'wallet';
    } else if (order.payment_method === 'credit') {
      // Carnet de crédit : la charge de la commande grandit, dans la limite du disponible (retard = bloqué)
      const { accountOfUser, accountOfCompany, summaryOf } = await import('./credit');
      const account = order.company_id ? await accountOfCompany(Number(order.company_id)) : await accountOfUser(order.user_id);
      const sum = account ? await summaryOf(account) : null;
      if (!account || account.status !== 'active' || !sum || sum.overdue > 0 || sum.available < extraAmount) {
        await releaseExtra();
        return { ok: false, status: 409, error: 'credit_unavailable', available: sum?.available ?? 0 };
      }
      const { data: ch } = await supabaseAdmin.from('credit_entries').select('id, amount').eq('order_id', order.id).eq('type', 'charge').order('id').limit(1).maybeSingle();
      if (ch) await supabaseAdmin.from('credit_entries').update({ amount: Number(ch.amount) + extraAmount }).eq('id', ch.id);
      refundMethod = 'credit';
    } else {
      refundMethod = order.payment_method === 'cash' ? 'cash' : 'manual';   // espèces : encaissé à la livraison ; Waafi/D-Money : complément à encaisser
    }
    const { error } = await supabaseAdmin.from('order_items').update({ quantity: targetQty }).eq('id', item.id);
    if (error) { await releaseExtra(); return { ok: false, status: 500, error: error.message }; }
  } else {
    // ── Réduction / retrait : stock rendu, remise de ligne au prorata, remboursement au prix net ──
    const removedQty = currentQty - targetQty;
    keptDiscount = isRemoval ? 0 : Math.round(lineDiscount * targetQty / currentQty);
    refundAmount = Number(item.price) * removedQty - (lineDiscount - keptDiscount);
    await applyStockDeltas(supabaseAdmin, [{ product_id: item.product_id, delta: removedQty }]);
    if (isRemoval) {
      const { error } = await supabaseAdmin.from('order_items').delete().eq('id', item.id);
      if (error) return { ok: false, status: 500, error: error.message };
    } else {
      const { error } = await supabaseAdmin.from('order_items').update({ quantity: targetQty, discount: keptDiscount }).eq('id', item.id);
      if (error) return { ok: false, status: 500, error: error.message };
    }
  }

  // Total
  const { orderTotals } = await import('./order-totals');
  const remaining = items.filter((it: any) => !(isRemoval && String(it.id) === String(item_id)))
    .map((it: any) => String(it.id) === String(item_id) ? { ...it, quantity: targetQty, discount: keptDiscount } : it);
  const totals = orderTotals({ items: remaining, promo_discount: order.promo_discount, admin_discount: order.admin_discount, delivery_fee: order.delivery_fee });
  const newTotal = totals.total;
  await supabaseAdmin.from('orders').update({ total: newTotal }).eq('id', order_id);

  // Remboursement (réductions seulement — l'augmentation a été débitée ci-dessus)
  if (!isIncrease) {
    refundMethod = await refundOrderAmount(
      order, refundAmount,
      isRemoval ? `Remboursement : ${name} retiré` : `Remboursement : ${name} (qté réduite)`,
    );
  }

  // Fidélité : une commande livrée qui passe sous la commande minimale perd son tampon (non utilisé)
  if (order.status === 'delivered' && order.user_id) {
    try {
      const { loyaltySettings } = await import('./loyalty');
      const s = await loyaltySettings();
      if (totals.goods < s.min_order) await supabaseAdmin.from('loyalty_stamps').delete().eq('order_id', order.id).is('reward_id', null);
    } catch (e) { console.error('[order-edit] loyalty:', e); }
  }

  // Journal immuable : qui, quoi, quand, pourquoi, à quel statut
  try {
    await supabaseAdmin.from('order_edits').insert({
      order_id: order.id, item_id: item.id, product_name: name, product_unit: item.product_unit ?? null,
      from_qty: currentQty, to_qty: targetQty, price: Number(item.price),
      amount: isIncrease ? extraAmount : -refundAmount, refund_method: refundMethod, reason,
      by_user: opts.actor?.id ?? null, by_name: opts.actor?.name ?? null, by_role: opts.actor?.role ?? null, order_status: order.status,
    });
  } catch (e) { console.error('[order-edit] journal:', e); }

  // Garde-fou : un gestionnaire modifie une commande expédiée/livrée → l'admin est prévenu
  if (shipped && opts.actor && opts.actor.role !== 'admin') {
    try {
      const { sendPushToAdmin } = await import('./push');
      await sendPushToAdmin({
        title: `✏️ Commande livrée modifiée par ${opts.actor.name || 'un gestionnaire'}`,
        body: `#${shortId} — ${name} : ${currentQty} → ${targetQty}${reason ? ` · ${reason}` : ''}`,
        url: '/admin',
      });
    } catch { /* ignore */ }
  }

  // Notif client
  if (order.user_id) {
    const amt = `${(isIncrease ? extraAmount : refundAmount).toLocaleString('fr-FR')} Fdj`;
    try {
      if (isIncrease) {
        const kind = refundMethod === 'wallet' ? 'wallet' : refundMethod === 'credit' ? 'credit' : refundMethod === 'manual' ? 'waafi' : 'cash';
        const tail =
          kind === 'wallet' ? `${amt} débités de votre cagnotte.`
          : kind === 'credit' ? `${amt} ajoutés à votre carnet de crédit.`
          : kind === 'waafi' ? `Merci d'envoyer le complément de ${amt}.`
          : `Votre montant à payer augmente de ${amt}.`;
        await notifyUser(order.user_id, { title: `🧾 Commande #${shortId} modifiée`, body: `« ${name} » porté à ${targetQty}. ${tail}`, url: '/profile',
          i18n: { key: `order.edit.increased.${kind}`, params: { id: shortId, name, qty: targetQty, amount: amt } } });
      } else {
        const what = isRemoval ? `« ${name} » retiré` : `« ${name} » réduit à ${targetQty}`;
        const tail =
          refundMethod === 'wallet' ? `${amt} recrédités sur votre cagnotte.`
          : refundMethod === 'cash' || refundMethod === 'credit' ? `Votre montant à payer baisse de ${amt}.`
          : `Remboursement de ${amt} par Waafi en cours.`;
        await notifyUser(order.user_id, { title: `🧾 Commande #${shortId} modifiée`, body: `${what}. ${tail}`, url: '/profile',
          i18n: { key: `order.edit.${isRemoval ? 'removed' : 'reduced'}.${refundMethod === 'wallet' ? 'wallet' : refundMethod === 'cash' || refundMethod === 'credit' ? 'cash' : 'waafi'}`, params: { id: shortId, name, qty: targetQty, amount: amt } } });
      }
    } catch { /* ignore */ }
  }

  // Bordereau préparateurs mis à jour (inutile une fois la commande livrée)
  if (!shipped) {
    try {
      const { data: fresh } = await supabaseAdmin
        .from('orders')
        .select('id, total, payment_method, delivery_option_name, customer_name, phone, address, special_instructions, created_at, order_items ( product_id, quantity, product_name, product_unit, product_farm, bundle_contents )')
        .eq('id', order_id)
        .single();
      const { data: preps } = await supabaseAdmin.from('preparers').select('email').eq('is_active', true);
      const prepEmails = (preps || []).map((p: any) => p.email).filter(Boolean);
      if (fresh && prepEmails.length) {
        const { sendPrepSlipToPreparers } = await import('./emails');
        await sendPrepSlipToPreparers(fresh, fresh.order_items || [], prepEmails, true);
      }
    } catch (e) { console.error('[prep] re-send slip failed:', e); }
  }

  return { ok: true, newTotal, refundAmount: isIncrease ? -extraAmount : refundAmount, refundMethod, removed: isRemoval, newQty: targetQty };
}

export type FeeChangeResult =
  | { ok: false; status: number; error: string; available?: number }
  | { ok: true; newTotal: number; newFee: number; delta: number; refundMethod: string };

// Modifie les frais de livraison d'une commande (admin/gestionnaire) : différence remboursée ou
// débitée selon le paiement, total recalculé, journal (kind 'delivery_fee'), client prévenu.
// Mêmes garde-fous que les quantités : commande annulée intouchable, motif obligatoire après
// expédition/livraison, alerte admin si l'auteur est gestionnaire.
export async function applyDeliveryFeeChange(order_id: any, newFee: number, opts: EditOptions & { optionName?: string | null } = {}): Promise<FeeChangeResult> {
  const { data: order, error: oErr } = await supabaseAdmin
    .from('orders')
    .select('id, status, payment_method, user_id, company_id, total, delivery_fee, delivery_option_name, promo_discount, admin_discount, customer_name, order_items ( id, price, quantity, discount )')
    .eq('id', order_id)
    .single();
  if (oErr || !order) return { ok: false, status: 404, error: 'Commande introuvable' };
  if (order.status === 'cancelled') return { ok: false, status: 409, error: 'order_cancelled' };
  const shipped = !['pending', 'processing'].includes(order.status);
  const reason = String(opts.reason || '').trim().slice(0, 300) || null;
  if (shipped && !reason) return { ok: false, status: 400, error: 'reason_required' };
  if (!Number.isInteger(newFee) || newFee < 0) return { ok: false, status: 400, error: 'fee_invalid' };
  const oldFee = Number(order.delivery_fee) || 0;
  const delta = newFee - oldFee;
  if (delta === 0 && (!opts.optionName || opts.optionName === order.delivery_option_name)) return { ok: false, status: 400, error: 'no_change' };

  const shortId = String(order_id).slice(0, 8).toUpperCase();
  let refundMethod = 'none';

  if (delta > 0) {
    // ── Hausse : complément débité selon le paiement ───────────────────────────────────────────
    if (order.payment_method === 'wallet' && order.user_id) {
      const { data: w } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', order.user_id).maybeSingle();
      if ((Number(w?.balance) || 0) < delta) return { ok: false, status: 409, error: 'wallet_insufficient' };
      await supabaseAdmin.rpc('wallet_adjust', { p_user: order.user_id, p_amount: -delta, p_type: 'debit', p_order: order.id, p_note: 'Frais de livraison ajustés' });
      refundMethod = 'wallet';
    } else if (order.payment_method === 'company_wallet' && order.company_id) {
      const { adjustCompanyWallet } = await import('./company');
      const debit = await adjustCompanyWallet(Number(order.company_id), -delta, 'debit', { orderId: Number(order.id), userId: opts.actor?.id ?? null, note: `Frais de livraison ajustés (commande #${order.id})` });
      if (!debit.ok) return { ok: false, status: 409, error: 'company_wallet_insufficient' };
      refundMethod = 'wallet';
    } else if (order.payment_method === 'credit') {
      const { accountOfUser, accountOfCompany, summaryOf } = await import('./credit');
      const account = order.company_id ? await accountOfCompany(Number(order.company_id)) : await accountOfUser(order.user_id);
      const sum = account ? await summaryOf(account) : null;
      if (!account || account.status !== 'active' || !sum || sum.overdue > 0 || sum.available < delta) {
        return { ok: false, status: 409, error: 'credit_unavailable', available: sum?.available ?? 0 };
      }
      const { data: ch } = await supabaseAdmin.from('credit_entries').select('id, amount').eq('order_id', order.id).eq('type', 'charge').order('id').limit(1).maybeSingle();
      if (ch) await supabaseAdmin.from('credit_entries').update({ amount: Number(ch.amount) + delta }).eq('id', ch.id);
      refundMethod = 'credit';
    } else {
      refundMethod = order.payment_method === 'cash' ? 'cash' : 'manual';
    }
  }

  // Total et nouveaux frais (le détail base/remise d'origine reste tel quel : le journal fait foi)
  const { orderTotals } = await import('./order-totals');
  const newTotal = orderTotals({ items: order.order_items || [], promo_discount: order.promo_discount, admin_discount: order.admin_discount, delivery_fee: newFee }).total;
  const patch: Record<string, unknown> = { delivery_fee: newFee, total: newTotal };
  if (opts.optionName) patch.delivery_option_name = opts.optionName;
  const { error: upErr } = await supabaseAdmin.from('orders').update(patch).eq('id', order_id);
  if (upErr) return { ok: false, status: 500, error: upErr.message };

  // Baisse : différence rendue selon le paiement (cagnotte, carnet de crédit, espèces, Waafi)
  if (delta < 0) refundMethod = await refundOrderAmount(order, -delta, 'Frais de livraison ajustés');

  // Journal immuable
  try {
    await supabaseAdmin.from('order_edits').insert({
      kind: 'delivery_fee', order_id: order.id, item_id: null,
      product_name: opts.optionName || order.delivery_option_name || null, product_unit: null,
      from_qty: oldFee, to_qty: newFee, price: 0, amount: delta, refund_method: refundMethod, reason,
      by_user: opts.actor?.id ?? null, by_name: opts.actor?.name ?? null, by_role: opts.actor?.role ?? null, order_status: order.status,
    });
  } catch (e) { console.error('[order-edit] journal livraison:', e); }

  if (shipped && opts.actor && opts.actor.role !== 'admin') {
    try {
      const { sendPushToAdmin } = await import('./push');
      await sendPushToAdmin({ title: `✏️ Livraison modifiée par ${opts.actor.name || 'un gestionnaire'}`, body: `#${shortId} — ${oldFee.toLocaleString('fr-FR')} → ${newFee.toLocaleString('fr-FR')} Fdj${reason ? ` · ${reason}` : ''}`, url: '/admin' });
    } catch { /* ignore */ }
  }

  // Notif client (dans sa langue)
  if (order.user_id && delta !== 0) {
    const amt = `${Math.abs(delta).toLocaleString('fr-FR')} Fdj`;
    const fromTo = { from: `${oldFee.toLocaleString('fr-FR')} Fdj`, to: `${newFee.toLocaleString('fr-FR')} Fdj` };
    const kind = refundMethod === 'wallet' ? 'wallet' : refundMethod === 'credit' ? 'credit' : refundMethod === 'manual' ? 'waafi' : 'cash';
    const tail = delta < 0
      ? (kind === 'wallet' ? `${amt} recrédités sur votre cagnotte.`
        : kind === 'waafi' ? `Remboursement de ${amt} par Waafi en cours.`
        : `Votre montant à payer baisse de ${amt}.`)
      : (kind === 'wallet' ? `${amt} débités de votre cagnotte.`
        : kind === 'credit' ? `${amt} ajoutés à votre carnet de crédit.`
        : kind === 'waafi' ? `Merci d'envoyer le complément de ${amt}.`
        : `Votre montant à payer augmente de ${amt}.`);
    try {
      await notifyUser(order.user_id, {
        title: `🚚 Livraison de la commande #${shortId} ajustée`,
        body: `Frais de livraison : ${fromTo.from} → ${fromTo.to}. ${tail}`,
        url: '/profile',
        i18n: { key: `order.fee.${delta < 0 ? 'reduced' : 'increased'}.${kind}`, params: { id: shortId, ...fromTo, amount: amt } },
      });
    } catch { /* ignore */ }
  }

  return { ok: true, newTotal, newFee, delta, refundMethod };
}
