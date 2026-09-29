import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { commissionOf } from '../../../../lib/merchant-formula';
import { requirePerm } from '../../../../lib/admin-auth';
import { monitored } from '../../../../lib/monitor';

// GET /api/admin/finances?period=month|30d|year|all
// Indicateurs financiers basés sur les commandes LIVRÉES.
async function GET_(request: Request) {
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
    .select('id, total, delivery_fee, created_at, company_id')
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
      .select('order_id, product_id, product_name, product_unit, quantity, price, product_cost, commission_rate')
      .in('order_id', orderIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    items = data || [];
  }

  // 3) Coût courant des produits (fallback si pas de snapshot dans la ligne) + produits marchands
  //    Modèle « abonnement seul » : le prix d'un produit marchand est intégralement reversé au
  //    marchand → pour Hornafresh, coût = prix, marge = 0. Ces ventes sont isolées (caMarchands).
  const [{ data: prods }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from('products').select('id, name, unit, cost_price, owner_id'),
    supabaseAdmin.from('merchant_profiles').select('user_id, shop_name'),
  ]);
  const shopMap: Record<string, string> = Object.fromEntries((profiles || []).map((m: any) => [m.user_id, m.shop_name]));
  const costMap: Record<number, number | null> = {};
  const nameMap: Record<number, { name: string; unit: string }> = {};
  const merchantOf: Record<number, string | null> = {};
  for (const p of prods || []) {
    costMap[p.id] = p.cost_price != null ? Number(p.cost_price) : null;
    nameMap[p.id] = { name: p.name, unit: p.unit };
    merchantOf[p.id] = p.owner_id ? (shopMap[p.owner_id] || 'Marchand') : null;
  }

  // 4) Agrégation par produit
  type Row = { product_id: number; name: string; unit: string; qty: number; revenue: number; cost: number; hasCost: boolean; allCost: boolean; merchant: string | null };
  const byProduct: Record<number, Row> = {};
  let caProduits = 0, costTotal = 0, caWithCost = 0, marginTotal = 0, caMarchands = 0, commissions = 0;

  for (const it of items) {
    const qty = Number(it.quantity) || 0;
    const revenue = (Number(it.price) || 0) * qty;
    caProduits += revenue;
    const merchant = merchantOf[it.product_id] || null;
    // Produit marchand : le coût est ce qui est reversé (brut − commission au taux photographié sur la ligne)
    const commission = merchant ? commissionOf(revenue, (it as any).commission_rate) : 0;
    if (merchant) { caMarchands += revenue; commissions += commission; }

    const unitCost = merchant ? null
      : it.product_cost != null ? Number(it.product_cost)
      : (costMap[it.product_id] != null ? costMap[it.product_id]! : null);
    const knownCost = merchant ? true : unitCost != null;
    const lineCost = merchant ? revenue - commission : knownCost ? unitCost! * qty : 0;
    if (knownCost) { costTotal += lineCost; caWithCost += revenue; marginTotal += revenue - lineCost; }

    const r = byProduct[it.product_id] ||= {
      product_id: it.product_id,
      name: it.product_name || nameMap[it.product_id]?.name || `#${it.product_id}`,
      unit: it.product_unit || nameMap[it.product_id]?.unit || '',
      qty: 0, revenue: 0, cost: 0, hasCost: false, allCost: true, merchant,
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
  // Ventes aux comptes entreprise (commandes livrées rattachées à une société), livraison comprise
  const companyOrders = (orders || []).filter((o: any) => o.company_id);
  const caEntreprises = companyOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const missingCost = products.filter(p => !p.costComplete).length;

  return NextResponse.json({
    period,
    kpis: {
      caProduits,                                            // CA produits (hors livraison), ventes marchands incluses
      caMarchands,                                           // ventes des produits marchands (brut)
      commissions,                                           // commissions retenues sur ces ventes (marge Hornafresh)
      reverseMarchands: caMarchands - commissions,           // net reversé aux marchands
      caHornafresh: caProduits - caMarchands,                // CA propre Hornafresh
      caEntreprises, nbOrdersEntreprises: companyOrders.length, // dont commandes des comptes entreprise
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

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/admin/finances', GET_);
