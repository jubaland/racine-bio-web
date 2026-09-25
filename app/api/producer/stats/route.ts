import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireMerchant } from '../../../../lib/producer-auth';

// Espace marchand — statistiques de ventes par produit
//   GET /api/producer/stats?period=30d|month|year|all
// Ventes = commandes non annulées ; « livré » = commandes livrées. Montants = prix × quantité.

export async function GET(request: Request) {
  const auth = await requireMerchant(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const period = new URL(request.url).searchParams.get('period') || '30d';
  const now = new Date();
  let from: Date | null = null;
  if (period === '30d') from = new Date(now.getTime() - 30 * 86400000);
  else if (period === 'month') from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  else if (period === 'year') from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  const { data: products } = await supabaseAdmin.from('products')
    .select('id, name, unit, stock_qty, status, likes_count, price').eq('owner_id', auth.user.id).order('name');
  const mine = products || [];
  const rows: Record<number, any> = Object.fromEntries(mine.map((p: any) => [p.id, { product_id: p.id, name: p.name, unit: p.unit || '', price: Number(p.price), stock: p.stock_qty ?? 0, status: p.status, likes: p.likes_count ?? 0, qty: 0, revenue: 0, delivered_qty: 0, delivered_revenue: 0, orders: new Set<string>() }]));
  const totals = { qty: 0, revenue: 0, delivered_qty: 0, delivered_revenue: 0, orders: 0 };

  if (mine.length) {
    const { data: items } = await supabaseAdmin.from('order_items').select('order_id, product_id, quantity, price').in('product_id', mine.map((p: any) => p.id));
    const orderIds = [...new Set((items || []).map((i: any) => i.order_id))];
    const orders: any[] = [];
    for (let i = 0; i < orderIds.length; i += 300) {
      let q = supabaseAdmin.from('orders').select('id, status, created_at').in('id', orderIds.slice(i, i + 300)).neq('status', 'cancelled');
      if (from) q = q.gte('created_at', from.toISOString());
      const { data } = await q; if (data) orders.push(...data);
    }
    const omap: Record<string, any> = Object.fromEntries(orders.map((o: any) => [o.id, o]));
    const allOrders = new Set<string>();
    for (const it of items || []) {
      const o = omap[it.order_id]; if (!o) continue;
      const r = rows[it.product_id]; if (!r) continue;
      const amt = Number(it.price) * it.quantity;
      r.qty += it.quantity; r.revenue += amt; r.orders.add(String(it.order_id)); allOrders.add(String(it.order_id));
      totals.qty += it.quantity; totals.revenue += amt;
      if (o.status === 'delivered') { r.delivered_qty += it.quantity; r.delivered_revenue += amt; totals.delivered_qty += it.quantity; totals.delivered_revenue += amt; }
    }
    totals.orders = allOrders.size;
  }
  const list = Object.values(rows).map((r: any) => ({ ...r, orders: r.orders.size })).sort((a: any, b: any) => b.revenue - a.revenue || a.name.localeCompare(b.name));
  return NextResponse.json({ period, totals, products: list, top: list.find((r: any) => r.qty > 0)?.name || null });
}
