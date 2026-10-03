import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requirePerm } from '../../../../../lib/admin-auth';
import { orderTotals } from '../../../../../lib/order-totals';
import { refundOrderAmount } from '../../../../../lib/order-refund';
import { notifyUser } from '../../../../../lib/notify';
import { monitored } from '../../../../../lib/monitor';

// Remise accordée par l'admin sur une commande existante (marchandage, geste commercial).
// Le prix des lignes reste le prix réel : la remise est stockée à part et à la charge d'Hornafresh
// (un marchand est reversé sur le prix réel). Journal des remises conservé sur la commande.
//   mode 'line'   : nouveau prix unitaire sur une ligne (ex. 300 → 270)
//   mode 'global' : montant global sur la commande (remplace la remise globale précédente)
//   mode 'reset'  : annule toutes les remises admin
// Commande prépayée (cagnotte, cagnotte société) : la différence est recréditée ; une remise ne peut
// pas y être réduite (il faudrait re-débiter).

const fdj = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} Fdj`;

async function POST_(request: Request) {
  const auth = await requirePerm(request, 'orders', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => ({}));
  const mode = String(body.mode || '');
  const note = String(body.note || '').trim().slice(0, 300);
  if (!['line', 'global', 'reset'].includes(mode)) return NextResponse.json({ error: 'mode_invalid' }, { status: 400 });
  if (mode !== 'reset' && !note) return NextResponse.json({ error: 'note_required' }, { status: 400 });

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, status, payment_method, user_id, company_id, total, delivery_fee, promo_discount, admin_discount, discount_history, order_items ( id, product_id, quantity, price, discount, product_name, product_unit )')
    .eq('id', Number(body.order_id)).maybeSingle();
  if (!order) return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
  if (order.status === 'cancelled') return NextResponse.json({ error: 'order_cancelled' }, { status: 409 });

  const items: any[] = order.order_items || [];
  const before = orderTotals({ items, promo_discount: order.promo_discount, admin_discount: order.admin_discount, delivery_fee: order.delivery_fee });
  const entry: Record<string, unknown> = { at: new Date().toISOString(), by: auth.user.id, by_name: auth.user.user_metadata?.full_name || auth.user.email || null, kind: mode, note: note || null };
  let adminDiscount = Number(order.admin_discount) || 0;
  const lineUpdates: { id: number; discount: number }[] = [];

  if (mode === 'line') {
    const item = items.find(it => String(it.id) === String(body.item_id));
    if (!item) return NextResponse.json({ error: 'item_not_found' }, { status: 404 });
    const newPrice = Number(body.new_price);
    const price = Number(item.price), qty = Number(item.quantity);
    if (!Number.isInteger(newPrice) || newPrice < 0 || newPrice >= price) return NextResponse.json({ error: 'price_invalid' }, { status: 400 });
    lineUpdates.push({ id: item.id, discount: (price - newPrice) * qty });
    Object.assign(entry, { item_id: item.id, name: item.product_name, from: price, to: newPrice, amount: (price - newPrice) * qty });
  } else if (mode === 'global') {
    const amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount <= 0) return NextResponse.json({ error: 'amount_invalid' }, { status: 400 });
    if (amount > before.goods + before.admin_discount) return NextResponse.json({ error: 'amount_too_high', max: before.goods + before.admin_discount }, { status: 400 });
    adminDiscount = amount;
    Object.assign(entry, { from: order.admin_discount, amount });
  } else {
    adminDiscount = 0;
    for (const it of items) if (Number(it.discount) > 0) lineUpdates.push({ id: it.id, discount: 0 });
    Object.assign(entry, { amount: -(before.line_discounts + before.admin_discount) });
  }

  const after = orderTotals({
    items: items.map(it => { const u = lineUpdates.find(l => l.id === it.id); return u ? { ...it, discount: u.discount } : it; }),
    promo_discount: order.promo_discount, admin_discount: adminDiscount, delivery_fee: order.delivery_fee,
  });
  const prepaid = ['wallet', 'company_wallet'].includes(order.payment_method);
  if (after.total > before.total && prepaid) return NextResponse.json({ error: 'prepaid_increase' }, { status: 409 });

  for (const u of lineUpdates) {
    const { error } = await supabaseAdmin.from('order_items').update({ discount: u.discount }).eq('id', u.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const history = Array.isArray(order.discount_history) ? order.discount_history : [];
  const { error } = await supabaseAdmin.from('orders').update({ total: after.total, admin_discount: adminDiscount, discount_history: [...history, entry] }).eq('id', order.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Prépayé : différence recréditée (transaction tracée)
  let refund: string = 'none';
  if (after.total < before.total) refund = await refundOrderAmount(order, before.total - after.total, `Remise accordée : ${note || 'remise annulée'}`);

  // Client prévenu (dans sa langue)
  if (order.user_id && after.total !== before.total) {
    const shortId = String(order.id).slice(0, 8).toUpperCase();
    const diff = Math.abs(after.total - before.total);
    const key = after.total < before.total ? 'order.discount' : 'order.discount_removed';
    try {
      await notifyUser(order.user_id, {
        title: after.total < before.total ? `🎁 Remise sur votre commande #${shortId}` : `🧾 Commande #${shortId} mise à jour`,
        body: after.total < before.total
          ? `Une remise de ${fdj(diff)} vous est accordée. Nouveau total : ${fdj(after.total)}${refund === 'wallet' ? ' (différence recréditée sur votre cagnotte)' : ''}.`
          : `La remise a été retirée. Nouveau total : ${fdj(after.total)}.`,
        url: '/profile',
        i18n: { key, params: { id: shortId, amount: fdj(diff), total: fdj(after.total) } },
      });
    } catch { /* ignore */ }
  }

  return NextResponse.json({ ok: true, total: after.total, before: before.total, refund, totals: after });
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const POST = monitored('/api/admin/orders/discount', POST_);
