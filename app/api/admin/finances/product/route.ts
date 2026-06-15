import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requirePerm } from '../../../../../lib/admin-auth';

// GET ?product_id=&from=YYYY-MM-DD&to=YYYY-MM-DD
// Détail des ventes d'un produit sur une période (hors commandes annulées).
export async function GET(request: Request) {
  const auth = await requirePerm(request, ['finances'], 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const productId = Number(url.searchParams.get('product_id'));
  if (!productId) return NextResponse.json({ error: 'product_id requis' }, { status: 400 });
  const from = url.searchParams.get('from'); // YYYY-MM-DD
  const to = url.searchParams.get('to');

  // 1) Commandes non annulées de la période
  let oq = supabaseAdmin
    .from('orders')
    .select('id, created_at, status, customer_name')
    .neq('status', 'cancelled');
  if (from) oq = oq.gte('created_at', `${from}T00:00:00`);
  if (to) oq = oq.lte('created_at', `${to}T23:59:59`);
  const { data: orders, error: oErr } = await oq;
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

  const orderMap: Record<string, any> = Object.fromEntries((orders || []).map((o: any) => [o.id, o]));
  const orderIds = (orders || []).map((o: any) => o.id);

  // 2) Lignes de ce produit dans ces commandes
  let lines: any[] = [];
  if (orderIds.length) {
    // (chunk si beaucoup de commandes)
    for (let i = 0; i < orderIds.length; i += 300) {
      const slice = orderIds.slice(i, i + 300);
      const { data } = await supabaseAdmin
        .from('order_items')
        .select('order_id, quantity, price, product_cost')
        .eq('product_id', productId)
        .in('order_id', slice);
      if (data) lines.push(...data);
    }
  }

  // 3) Produit (nom, unité, coût courant en repli)
  const { data: prod } = await supabaseAdmin
    .from('products').select('name, unit, cost_price').eq('id', productId).maybeSingle();

  const rows = lines.map((l: any) => {
    const o = orderMap[l.order_id] || {};
    const qty = Number(l.quantity) || 0;
    const price = Number(l.price) || 0;
    const unitCost = l.product_cost != null ? Number(l.product_cost)
      : (prod?.cost_price != null ? Number(prod.cost_price) : null);
    const revenue = price * qty;
    const cost = unitCost != null ? unitCost * qty : null;
    const margin = cost != null ? revenue - cost : null;
    return {
      order_id: l.order_id,
      date: o.created_at,
      status: o.status,
      customer: o.customer_name || null,
      quantity: qty,
      price,
      unit_cost: unitCost,
      revenue,
      cost,
      margin,
    };
  }).sort((a, b) => (a.date < b.date ? 1 : -1));

  // 4) Synthèse (toutes lignes + sous-ensemble livré)
  const sum = (arr: any[], f: (r: any) => number) => arr.reduce((s, r) => s + (f(r) || 0), 0);
  const pct = (m: number, rev: number) => rev > 0 ? Math.round((m / rev) * 1000) / 10 : null;
  const avg = (rev: number, q: number) => q > 0 ? Math.round(rev / q) : 0;

  const withCost = rows.filter(r => r.cost != null);
  const delivered = rows.filter(r => r.status === 'delivered');
  const deliveredWithCost = delivered.filter(r => r.cost != null);

  const summary = {
    count: rows.length,
    qty: sum(rows, r => r.quantity),
    revenue: sum(rows, r => r.revenue),
    cost: sum(withCost, r => r.cost),
    margin: sum(withCost, r => r.margin),
    marginPct: pct(sum(withCost, r => r.margin), sum(withCost, r => r.revenue)),
    avgPrice: avg(sum(rows, r => r.revenue), sum(rows, r => r.quantity)),
    deliveredQty: sum(delivered, r => r.quantity),
    deliveredRevenue: sum(delivered, r => r.revenue),
    deliveredMargin: sum(deliveredWithCost, r => r.margin),
    deliveredMarginPct: pct(sum(deliveredWithCost, r => r.margin), sum(deliveredWithCost, r => r.revenue)),
    deliveredAvgPrice: avg(sum(delivered, r => r.revenue), sum(delivered, r => r.quantity)),
  };

  return NextResponse.json({ product: { id: productId, name: prod?.name || `#${productId}`, unit: prod?.unit || '' }, rows, summary });
}
