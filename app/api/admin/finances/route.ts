import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';

// GET /api/admin/finances?period=month|30d|year|all
// Indicateurs financiers basés sur les commandes LIVRÉES.
export async function GET(request: Request) {
  const auth = await requirePerm(request, ['finances'], 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const period = url.searchParams.get('period') || 'all';

  // Borne de date (UTC) selon la période
  const now = new Date();
  let from: Date | null = null;
  if (period === 'month') from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  else if (period === '30d') from = new Date(now.getTime() - 30 * 86400000);
  else if (period === 'year') from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  // 1) Commandes livrées sur la période
  let q = supabaseAdmin
    .from('orders')
    .select('id, total, delivery_fee, created_at')
    .eq('status', 'delivered');
  if (from) q = q.gte('created_at', from.toISOString());
  const { data: orders, error: ordErr } = await q;
  if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 500 });

  const orderIds = (orders || []).map(o => o.id);
  const nbOrders = orderIds.length;

  // 2) Lignes d'articles de ces commandes
  let items: any[] = [];
  if (orderIds.length) {
    const { data, error } = await supabaseAdmin
      .from('order_items')
      .select('order_id, product_id, product_name, product_unit, quantity, price, product_cost')
      .in('order_id', orderIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    items = data || [];
  }

  // 3) Coût courant des produits (fallback si pas de snapshot dans la ligne)
  const { data: prods } = await supabaseAdmin.from('products').select('id, name, unit, cost_price');
  const costMap: Record<number, number | null> = {};
  const nameMap: Record<number, { name: string; unit: string }> = {};
  for (const p of prods || []) {
    costMap[p.id] = p.cost_price != null ? Number(p.cost_price) : null;
    nameMap[p.id] = { name: p.name, unit: p.unit };
  }

  // 4) Agrégation par produit
  type Row = { product_id: number; name: string; unit: string; qty: number; revenue: number; cost: number; hasCost: boolean; allCost: boolean };
  const byProduct: Record<number, Row> = {};
  let caProduits = 0, costTotal = 0, caWithCost = 0, marginTotal = 0;

  for (const it of items) {
    const qty = Number(it.quantity) || 0;
    const revenue = (Number(it.price) || 0) * qty;
    caProduits += revenue;

    const unitCost = it.product_cost != null ? Number(it.product_cost)
      : (costMap[it.product_id] != null ? costMap[it.product_id]! : null);
    const knownCost = unitCost != null;
    const lineCost = knownCost ? unitCost! * qty : 0;
    if (knownCost) { costTotal += lineCost; caWithCost += revenue; marginTotal += revenue - lineCost; }

    const r = byProduct[it.product_id] ||= {
      product_id: it.product_id,
      name: it.product_name || nameMap[it.product_id]?.name || `#${it.product_id}`,
      unit: it.product_unit || nameMap[it.product_id]?.unit || '',
      qty: 0, revenue: 0, cost: 0, hasCost: false, allCost: true,
    };
    r.qty += qty;
    r.revenue += revenue;
    if (knownCost) { r.cost += lineCost; r.hasCost = true; } else { r.allCost = false; }
  }

  const products = Object.values(byProduct)
    .map(r => ({
      ...r,
      margin: r.hasCost ? r.revenue - r.cost : null,
      marginPct: r.hasCost && r.revenue > 0 ? Math.round(((r.revenue - r.cost) / r.revenue) * 1000) / 10 : null,
      costComplete: r.allCost && r.hasCost,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const deliveryCollected = (orders || []).reduce((s, o) => s + (Number(o.delivery_fee) || 0), 0);
  const grossPaid = (orders || []).reduce((s, o) => s + (Number(o.total) || 0), 0);
  const missingCost = products.filter(p => !p.costComplete).length;

  return NextResponse.json({
    period,
    kpis: {
      caProduits,                                            // CA produits (hors livraison)
      nbOrders,
      panierMoyen: nbOrders ? Math.round(grossPaid / nbOrders) : 0,
      deliveryCollected,
      costTotal,
      marginTotal,                                           // marge sur les produits au coût connu
      marginPct: caWithCost > 0 ? Math.round((marginTotal / caWithCost) * 1000) / 10 : null,
      caWithCost,                                            // part du CA couverte par un coût connu
    },
    products,
    missingCost,
  });
}
