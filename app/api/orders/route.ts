import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { sendOrderConfirmation, sendNewOrderAlert, sendStatusUpdate, sendPrepSlipToPreparers, sendOrderCancelledToPreparers } from '../../../lib/emails';
import { requirePerm } from '../../../lib/admin-auth';
import { refundOrderAmount } from '../../../lib/order-refund';

// POST — crée commande + articles avec vérification et décrémentation du stock
export async function POST(request: Request) {
  try {
    const { order, items, ref_code, use_referral_credit } = await request.json();

    // Vérifier le stock disponible pour chaque article
    const productIds = items.map((i: any) => i.product_id);
    const { data: stockData, error: stockErr } = await supabaseAdmin
      .from('products')
      .select('id, name, stock_qty, unit, cost_price')
      .in('id', productIds);

    if (stockErr) return NextResponse.json({ error: stockErr.message }, { status: 400 });

    const stockMap: Record<number, { name: string; stock_qty: number; unit: string; cost_price: number | null }> =
      Object.fromEntries((stockData || []).map((p: any) => [p.id, p]));

    const insufficientItems = items.filter((item: any) => {
      const available = stockMap[item.product_id]?.stock_qty ?? 0;
      return item.quantity > available;
    });

    if (insufficientItems.length > 0) {
      return NextResponse.json({
        error: 'stock_insufficient',
        items: insufficientItems.map((item: any) => ({
          product_id: item.product_id,
          name: stockMap[item.product_id]?.name ?? `Produit #${item.product_id}`,
          available: stockMap[item.product_id]?.stock_qty ?? 0,
          unit: stockMap[item.product_id]?.unit ?? '',
          requested: item.quantity,
        })),
      }, { status: 400 });
    }

    // Paiement par cagnotte : vérifier le solde AVANT de créer la commande
    if (order.payment_method === 'wallet') {
      if (!order.user_id) {
        return NextResponse.json({ error: 'wallet_requires_account' }, { status: 400 });
      }
      const { data: w } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', order.user_id).maybeSingle();
      if ((Number(w?.balance) || 0) < Number(order.total)) {
        return NextResponse.json({ error: 'wallet_insufficient', balance: Number(w?.balance) || 0 }, { status: 400 });
      }
    }

    // Créer la commande
    const { data: createdOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(order)
      .select()
      .single();

    if (orderError) return NextResponse.json({ error: orderError.message }, { status: 400 });

    // Paiement par cagnotte : débiter après création de la commande
    if (order.payment_method === 'wallet' && createdOrder.user_id) {
      await supabaseAdmin.rpc('wallet_adjust', {
        p_user: createdOrder.user_id,
        p_amount: -Number(createdOrder.total),
        p_type: 'debit',
        p_order: createdOrder.id,
        p_note: 'Paiement commande',
      });
    }

    // Insérer les articles (snapshot produit)
    const { error: snapshotError } = await supabaseAdmin
      .from('order_items')
      .insert(
        items.map((item: any) => ({
          order_id:          createdOrder.id,
          product_id:        item.product_id,
          quantity:          item.quantity,
          price:             item.price,
          product_name:      item.product_name      ?? null,
          product_image_url: item.product_image_url ?? null,
          product_unit:      item.product_unit      ?? null,
          product_farm:      item.product_farm      ?? null,
          product_cost:      stockMap[item.product_id]?.cost_price ?? null,
        }))
      );

    if (snapshotError) return NextResponse.json({ error: snapshotError.message }, { status: 400 });

    // Décrémenter le stock pour chaque article
    await Promise.all(items.map((item: any) => {
      const currentStock = stockMap[item.product_id]?.stock_qty ?? 0;
      const newStock = Math.max(0, currentStock - item.quantity);
      return supabaseAdmin
        .from('products')
        .update({ stock_qty: newStock })
        .eq('id', item.product_id);
    }));

    // Consommer un crédit parrainage si demandé
    if (use_referral_credit && createdOrder.user_id) {
      try {
        const { data: rc } = await supabaseAdmin
          .from('referral_codes')
          .select('credits')
          .eq('user_id', createdOrder.user_id)
          .maybeSingle();
        if (rc && rc.credits > 0) {
          await supabaseAdmin
            .from('referral_codes')
            .update({ credits: rc.credits - 1 })
            .eq('user_id', createdOrder.user_id);
        }
      } catch (_) {}
    }

    // Attribuer un crédit au parrain — fire-and-forget
    if (ref_code && createdOrder.user_id) {
      (async () => {
        try {
          // Le code parrainage n'est valable qu'à la 1ère commande du filleul
          const { count: ordersCount } = await supabaseAdmin
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', createdOrder.user_id);
          if (ordersCount && ordersCount > 1) return; // pas la première commande

          const { data: refRecord } = await supabaseAdmin
            .from('referral_codes')
            .select('user_id, credits')
            .eq('code', String(ref_code).toUpperCase())
            .maybeSingle();
          if (!refRecord || refRecord.user_id === createdOrder.user_id) return;

          const { count } = await supabaseAdmin
            .from('referrals')
            .select('id', { count: 'exact', head: true })
            .eq('referee_id', createdOrder.user_id);
          if (count && count > 0) return; // déjà parrainé

          await supabaseAdmin.from('referrals').insert({
            code:        String(ref_code).toUpperCase(),
            referrer_id: refRecord.user_id,
            referee_id:  createdOrder.user_id,
            order_id:    createdOrder.id,
          });
          await supabaseAdmin
            .from('referral_codes')
            .update({ credits: refRecord.credits + 1 })
            .eq('user_id', refRecord.user_id);
        } catch (_) {}
      })();
    }

    // Push — awaité avant la réponse (< 200ms, serverless-safe)
    try {
      const { sendPushToUser, sendPushToAdmin } = await import('../../../lib/push');
      const shortId = String(createdOrder.id).slice(0, 8).toUpperCase();
      if (createdOrder.user_id) await sendPushToUser(createdOrder.user_id, { title: '✅ Commande confirmée', body: `Commande #${shortId} — ${Number(createdOrder.total).toLocaleString('fr-FR')} Fdj`, url: '/profile' });
      await sendPushToAdmin({ title: '🛍️ Nouvelle commande', body: `#${shortId} — ${createdOrder.customer_name} — ${Number(createdOrder.total).toLocaleString('fr-FR')} Fdj`, url: '/admin' });

      // Alertes stock bas (seuil : 5 unités)
      const LOW = 5;
      type StockItem = { name: string; newStock: number; wasAbove: boolean };
      const lowStock: StockItem[] = items
        .map((item: any) => {
          const current = stockMap[item.product_id]?.stock_qty ?? 0;
          const newStock = Math.max(0, current - item.quantity);
          return { name: stockMap[item.product_id]?.name ?? `Produit #${item.product_id}`, newStock, wasAbove: current > LOW };
        })
        .filter((p: StockItem) => p.newStock <= LOW && p.wasAbove);

      if (lowStock.length === 1) {
        const p = lowStock[0];
        await sendPushToAdmin({
          title: `⚠️ Stock bas — ${p.name}`,
          body: `Plus que ${p.newStock} unité${p.newStock !== 1 ? 's' : ''} restante${p.newStock !== 1 ? 's' : ''}`,
          url: '/admin',
        });
      } else if (lowStock.length > 1) {
        await sendPushToAdmin({
          title: `⚠️ Stock bas — ${lowStock.length} produits`,
          body: lowStock.map(p => `${p.name} (${p.newStock})`).join(', '),
          url: '/admin',
        });
      }
    } catch (_) {}

    // Emails — awaités avant la réponse (serverless : le code après le return ne s'exécute pas)
    try {
        let customerEmail: string | null = null;
        if (createdOrder.user_id) {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(createdOrder.user_id);
          customerEmail = userData?.user?.email ?? null;
        } else {
          customerEmail = createdOrder.email ?? null; // commande invité
        }
        const emailItems = items.map((item: any) => ({
          ...item,
          product_name: item.product_name ?? stockMap[item.product_id]?.name ?? null,
          product_unit: item.product_unit ?? stockMap[item.product_id]?.unit ?? null,
        }));
        console.log('[email] sending to admin:', process.env.ADMIN_EMAIL, '| customer:', customerEmail);
        await sendNewOrderAlert(createdOrder, emailItems, customerEmail);
        console.log('[email] admin alert sent');
        if (customerEmail) {
          await sendOrderConfirmation(createdOrder, emailItems, customerEmail);
          console.log('[email] customer confirmation sent');
        }
        // Bordereau de préparation → tous les préparateurs actifs
        const { data: preparers } = await supabaseAdmin.from('preparers').select('email').eq('is_active', true);
        const prepEmails = (preparers || []).map((p: any) => p.email).filter(Boolean);
        if (prepEmails.length) {
          await sendPrepSlipToPreparers(createdOrder, emailItems, prepEmails);
          console.log('[email] prep slip sent to', prepEmails.length, 'preparers');
        }
    } catch (err) {
      console.error('[email] ERROR:', err);
    }

    return NextResponse.json({ order: createdOrder });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET — toutes les commandes avec articles (admin / gestionnaire "Commandes")
export async function GET(request: Request) {
  const auth = await requirePerm(request, 'orders', 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`
      id, user_id, total, delivery_fee, delivery_option_name, status, payment_method, phone, email, address, customer_name, special_instructions, created_at,
      order_items (
        id, product_id, quantity, price,
        product_name, product_image_url, product_unit, product_farm
      )
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ orders: data });
}

// PATCH — modifier le statut + restaurer le stock si annulation
export async function PATCH(request: Request) {
  const auth = await requirePerm(request, 'orders', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id, status } = await request.json();

  // Si annulation : restaurer le stock ET rembourser selon le moyen de paiement
  if (status === 'cancelled') {
    const { data: currentOrder } = await supabaseAdmin
      .from('orders')
      .select('status, total, payment_method, user_id')
      .eq('id', id)
      .single();

    if (currentOrder && currentOrder.status !== 'cancelled') {
      const { data: orderItems } = await supabaseAdmin
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', id);

      if (orderItems && orderItems.length > 0) {
        const productIds = orderItems.map((i: any) => i.product_id);
        const { data: stockData } = await supabaseAdmin
          .from('products')
          .select('id, stock_qty')
          .in('id', productIds);

        const stockMap: Record<number, number> =
          Object.fromEntries((stockData || []).map((p: any) => [p.id, p.stock_qty ?? 0]));

        await Promise.all(orderItems.map((item: any) =>
          supabaseAdmin
            .from('products')
            .update({ stock_qty: (stockMap[item.product_id] ?? 0) + item.quantity })
            .eq('id', item.product_id)
        ));
      }

      // Remboursement du montant restant (cagnotte auto / espèces rien / Waafi manuel)
      await refundOrderAmount(
        { id, payment_method: currentOrder.payment_method, user_id: currentOrder.user_id },
        Number(currentOrder.total) || 0,
        'Remboursement : commande annulée',
      );
    }
  }

  const { data: updatedOrder, error } = await supabaseAdmin
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Notifier le client — awaité (serverless : le code après le return ne s'exécute pas)
  try {
    let customerEmail: string | null = null;
    if (updatedOrder?.user_id) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(updatedOrder.user_id);
      customerEmail = userData?.user?.email ?? null;
    } else {
      customerEmail = updatedOrder?.email ?? null; // commande invité
    }
    if (customerEmail) await sendStatusUpdate(updatedOrder, customerEmail);

    // Annulation : prévenir les préparateurs de ne pas préparer
    if (updatedOrder?.status === 'cancelled') {
      const { data: preps } = await supabaseAdmin.from('preparers').select('email').eq('is_active', true);
      const prepEmails = (preps || []).map((p: any) => p.email).filter(Boolean);
      if (prepEmails.length) await sendOrderCancelledToPreparers(updatedOrder, prepEmails);
    }

    // Push — uniquement pour les utilisateurs connectés (les invités n'ont pas d'abonnement)
    if (updatedOrder?.user_id) {
      try {
        const { sendPushToUser } = await import('../../../lib/push');
        const STATUS_PUSH: Record<string, string> = {
          processing: '🚚 Commande en préparation',
          shipping:   '📦 Commande expédiée',
          delivered:  '✅ Commande livrée !',
          cancelled:  '❌ Commande annulée',
        };
        if (STATUS_PUSH[updatedOrder.status]) {
          await sendPushToUser(updatedOrder.user_id, {
            title: STATUS_PUSH[updatedOrder.status],
            body: `Commande #${String(updatedOrder.id).slice(0, 8).toUpperCase()}`,
            url: '/profile',
          });
        }
      } catch (_) {}
    }
  } catch (_) { /* email failure must not affect response */ }

  return NextResponse.json({ ok: true });
}
