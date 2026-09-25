import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireMerchant } from '../../../../lib/producer-auth';
import { todayStr, createPromotion } from '../../../../lib/promotions';

// Espace marchand — promotions planifiées sur ses produits
//   GET  → { promotions: [...avec produit, état], products: [ses produits publiés] }
//   POST { product_id, promo_price, starts_at, ends_at } → création
//   POST { action: 'cancel', id }                        → annulation (promo à venir ou en cours)
// Règles : produit du marchand ; prix promo > 0 et < prix normal ; dates valides (fin ≥ début ≥ aujourd'hui) ;
//          pas de chevauchement avec une autre promo programmée du même produit ; 90 jours max.

const stateOf = (p: any, day: string) => p.status === 'cancelled' ? 'cancelled' : p.ends_at < day ? 'ended' : p.starts_at > day ? 'upcoming' : 'active';

export async function GET(request: Request) {
  const auth = await requireMerchant(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const day = todayStr();
  const [{ data: products }, { data: promos }] = await Promise.all([
    supabaseAdmin.from('products').select('id, name, unit, price, status').eq('owner_id', auth.user.id).order('name'),
    supabaseAdmin.from('product_promotions').select('*').eq('owner_id', auth.user.id).order('starts_at', { ascending: false }),
  ]);
  const pmap: Record<number, any> = Object.fromEntries((products || []).map((p: any) => [p.id, p]));
  return NextResponse.json({
    today: day,
    products: (products || []).filter((p: any) => p.status === 'published'),
    promotions: (promos || []).map((p: any) => ({ ...p, product: pmap[p.product_id] ? { name: pmap[p.product_id].name, unit: pmap[p.product_id].unit, price: Number(pmap[p.product_id].price) } : null, state: stateOf(p, day) })),
  });
}

export async function POST(request: Request) {
  const auth = await requireMerchant(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const day = todayStr();

  if (body.action === 'cancel') {
    const { data: p } = await supabaseAdmin.from('product_promotions').select('id, status, ends_at').eq('id', body.id).eq('owner_id', auth.user.id).maybeSingle();
    if (!p) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (p.status !== 'scheduled' || p.ends_at < day) return NextResponse.json({ error: 'already_resolved' }, { status: 409 });
    await supabaseAdmin.from('product_promotions').update({ status: 'cancelled' }).eq('id', p.id);
    return NextResponse.json({ ok: true });
  }

  // Règles communes (lib/promotions.ts) : produit du marchand, prix < normal, dates, 90 j, chevauchement
  const r = await createPromotion(supabaseAdmin, body, { actorId: auth.user.id, ownerScope: 'merchant' });
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, promotion: r.promotion });
}
