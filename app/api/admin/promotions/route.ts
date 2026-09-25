import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';
import { todayStr, createPromotion, promoState } from '../../../../lib/promotions';

// Admin — promotions planifiées sur les produits (module Promotions → onglet « Prix promo produits »)
//   GET  → { today, products (Hornafresh publiés), promotions (toutes, avec produit + enseigne + état) }
//   POST { product_id, promo_price, starts_at, ends_at } → promotion Hornafresh (produit sans propriétaire)
//   POST { action: 'cancel', id }                        → annulation (Hornafresh ou marchand — modération)

export async function GET(request: Request) {
  const auth = await requirePerm(request, ['promos', 'products'], 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const day = todayStr();
  const [{ data: products }, { data: promos }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from('products').select('id, name, unit, price, status, owner_id').order('name'),
    supabaseAdmin.from('product_promotions').select('*').order('starts_at', { ascending: false }).limit(300),
    supabaseAdmin.from('merchant_profiles').select('user_id, shop_name'),
  ]);
  const pmap: Record<number, any> = Object.fromEntries((products || []).map((p: any) => [p.id, p]));
  const shops: Record<string, string> = Object.fromEntries((profiles || []).map((m: any) => [m.user_id, m.shop_name]));
  return NextResponse.json({
    today: day,
    products: (products || []).filter((p: any) => p.status === 'published' && !p.owner_id).map((p: any) => ({ id: p.id, name: p.name, unit: p.unit, price: Number(p.price) })),
    promotions: (promos || []).map((p: any) => ({
      ...p, state: promoState(p, day),
      product: pmap[p.product_id] ? { name: pmap[p.product_id].name, unit: pmap[p.product_id].unit, price: Number(pmap[p.product_id].price) } : null,
      shop: p.owner_id ? (shops[p.owner_id] || 'Marchand') : null,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requirePerm(request, ['promos', 'products'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }
  if (body.action === 'cancel') {
    const { data: p } = await supabaseAdmin.from('product_promotions').select('id, status, ends_at, owner_id, product_id').eq('id', body.id).maybeSingle();
    if (!p) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (p.status !== 'scheduled' || p.ends_at < todayStr()) return NextResponse.json({ error: 'already_resolved' }, { status: 409 });
    await supabaseAdmin.from('product_promotions').update({ status: 'cancelled' }).eq('id', p.id);
    // Promotion d'un marchand annulée par l'admin : on le prévient
    if (p.owner_id) {
      try {
        const { notifyUser } = await import('../../../../lib/notify');
        const { data: prod } = await supabaseAdmin.from('products').select('name').eq('id', p.product_id).maybeSingle();
        await notifyUser(p.owner_id, { title: '🏷️ Promotion annulée par Hornafresh', body: `La promotion sur « ${prod?.name || 'votre produit'} » a été annulée${body.note ? ` : ${String(body.note).slice(0, 200)}` : ''}. Le prix normal s'applique.`, url: '/producer/promotions' });
      } catch { /* ignore */ }
    }
    return NextResponse.json({ ok: true });
  }
  const r = await createPromotion(supabaseAdmin, body, { actorId: auth.user.id, ownerScope: 'hornafresh' });
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, promotion: r.promotion });
}
