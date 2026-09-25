import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireMerchant } from '../../../../lib/producer-auth';

// Espace marchand — commandes contenant ses produits.
// Les tables orders / order_items ne sont pas lisibles par un marchand (RLS) : cette route lit en
// service role et ne renvoie QUE ce qui le concerne : ses articles, le statut, la date et le prénom
// du client. Pas de téléphone ni d'adresse : Hornafresh reste le hub (préparation + livraison).
//   GET /api/producer/orders            → { stats, orders }
//   GET /api/producer/orders?status=x   → filtre par statut
//   GET /api/producer/orders?from=YYYY-MM-DD&to=YYYY-MM-DD → période (date de commande)
//   GET /api/producer/orders?limit=5    → limite (tableau de bord)
// Chaque article porte paid_out (reversé ou non) pour l'export / le rapprochement.

const firstName = (full: string | null) => (full || '').trim().split(/\s+/)[0] || 'Client';

export async function GET(request: Request) {
  const auth = await requireMerchant(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || '';
  // Date valide au calendrier (2026-13-45 est rejeté, pas seulement le format)
  const isDate = (s: string | null) => { if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(s + 'T00:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; };
  const from = isDate(url.searchParams.get('from')) ? url.searchParams.get('from')! : '';
  const to = isDate(url.searchParams.get('to')) ? url.searchParams.get('to')! : '';
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '500', 10) || 500));
  const uid = auth.user.id;

  const { data: products } = await supabaseAdmin.from('products').select('id, name, unit, status').eq('owner_id', uid);
  const mine = products || [];
  const pmap = Object.fromEntries(mine.map((p: any) => [p.id, p]));
  const ids = mine.map((p: any) => p.id);
  const empty = { stats: { products: mine.length, published: mine.filter((p: any) => p.status === 'published').length, orders: 0, revenue: 0, delivered_revenue: 0 }, orders: [] as any[] };
  if (!ids.length) return NextResponse.json(empty);

  const { data: items } = await supabaseAdmin.from('order_items').select('order_id, product_id, quantity, price, payout_id').in('product_id', ids);
  const byOrder: Record<string, any[]> = {};
  (items || []).forEach((i: any) => { (byOrder[i.order_id] ||= []).push(i); });
  const orderIds = Object.keys(byOrder);
  if (!orderIds.length) return NextResponse.json(empty);

  let q = supabaseAdmin.from('orders').select('id, status, created_at, customer_name').in('id', orderIds).order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  if (from) q = q.gte('created_at', `${from}T00:00:00`);
  if (to) q = q.lte('created_at', `${to}T23:59:59`);
  const { data: orders } = await q;

  const all = (orders || []).map((o: any) => {
    const its = (byOrder[o.id] || []).map((i: any) => ({ product_id: i.product_id, name: pmap[i.product_id]?.name || '—', unit: pmap[i.product_id]?.unit || '', quantity: i.quantity, price: i.price, total: i.quantity * i.price, paid_out: i.payout_id != null }));
    return { id: o.id, status: o.status, created_at: o.created_at, customer: firstName(o.customer_name), items: its, subtotal: its.reduce((s: number, i: any) => s + i.total, 0) };
  });

  // Stats sur l'ensemble (hors filtre) : commandes non annulées ; « livré » = encaissé pour de bon
  let stats = empty.stats;
  if (!status && !from && !to) {
    const live = all.filter(o => o.status !== 'cancelled');
    stats = { ...stats, orders: live.length, revenue: live.reduce((s, o) => s + o.subtotal, 0), delivered_revenue: live.filter(o => o.status === 'delivered').reduce((s, o) => s + o.subtotal, 0) };
  } else {
    const { data: allOrders } = await supabaseAdmin.from('orders').select('id, status').in('id', orderIds);
    const live = (allOrders || []).filter((o: any) => o.status !== 'cancelled');
    const sub = (id: string) => (byOrder[id] || []).reduce((s: number, i: any) => s + i.quantity * i.price, 0);
    stats = { ...stats, orders: live.length, revenue: live.reduce((s: number, o: any) => s + sub(o.id), 0), delivered_revenue: live.filter((o: any) => o.status === 'delivered').reduce((s: number, o: any) => s + sub(o.id), 0) };
  }
  return NextResponse.json({ stats, orders: all.slice(0, limit) });
}
