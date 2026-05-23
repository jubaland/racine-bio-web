import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

// POST — crée commande + articles avec vérification et décrémentation du stock
export async function POST(request: Request) {
  try {
    const { order, items } = await request.json();

    // Vérifier le stock disponible pour chaque article
    const productIds = items.map((i: any) => i.product_id);
    const { data: stockData, error: stockErr } = await supabaseAdmin
      .from('products')
      .select('id, name, stock_qty, unit')
      .in('id', productIds);

    if (stockErr) return NextResponse.json({ error: stockErr.message }, { status: 400 });

    const stockMap: Record<number, { name: string; stock_qty: number; unit: string }> =
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

    // Créer la commande
    const { data: createdOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(order)
      .select()
      .single();

    if (orderError) return NextResponse.json({ error: orderError.message }, { status: 400 });

    // Insérer les articles (snapshot)
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
        }))
      );

    if (snapshotError) {
      const { error: basicError } = await supabaseAdmin
        .from('order_items')
        .insert(
          items.map((item: any) => ({
            order_id:   createdOrder.id,
            product_id: item.product_id,
            quantity:   item.quantity,
            price:      item.price,
          }))
        );
      if (basicError) return NextResponse.json({ error: basicError.message }, { status: 400 });
    }

    // Décrémenter le stock pour chaque article
    await Promise.all(items.map((item: any) => {
      const currentStock = stockMap[item.product_id]?.stock_qty ?? 0;
      const newStock = Math.max(0, currentStock - item.quantity);
      return supabaseAdmin
        .from('products')
        .update({ stock_qty: newStock })
        .eq('id', item.product_id);
    }));

    return NextResponse.json({ order: createdOrder });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET — toutes les commandes avec articles (admin)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`
      id, user_id, total, status, payment_method, phone, address, customer_name, created_at,
      order_items (
        id, product_id, quantity, price,
        product_name, product_image_url, product_unit, product_farm,
        products ( name, unit, image_url, farm )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    const { data: data2, error: error2 } = await supabaseAdmin
      .from('orders')
      .select(`
        id, user_id, total, status, payment_method, phone, address, customer_name, created_at,
        order_items (
          id, product_id, quantity, price,
          products ( name, unit, image_url, farm )
        )
      `)
      .order('created_at', { ascending: false });

    if (error2) return NextResponse.json({ error: error2.message }, { status: 400 });
    return NextResponse.json({ orders: data2 });
  }

  return NextResponse.json({ orders: data });
}

// PATCH — modifier le statut + restaurer le stock si annulation
export async function PATCH(request: Request) {
  const { id, status } = await request.json();

  // Si annulation : récupérer les articles pour restaurer le stock
  if (status === 'cancelled') {
    const { data: currentOrder } = await supabaseAdmin
      .from('orders')
      .select('status')
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
    }
  }

  const { error } = await supabaseAdmin.from('orders').update({ status }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
