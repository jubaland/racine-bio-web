import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireMerchant } from '../../../../lib/producer-auth';
import { todayStr } from '../../../../lib/promotions';

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

  const product_id = Number(body.product_id), promo_price = Number(body.promo_price);
  const starts_at = String(body.starts_at || ''), ends_at = String(body.ends_at || '');
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!product_id || !promo_price || !isDate(starts_at) || !isDate(ends_at)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { data: prod } = await supabaseAdmin.from('products').select('id, price, status, owner_id').eq('id', product_id).maybeSingle();
  if (!prod || prod.owner_id !== auth.user.id) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (prod.status !== 'published') return NextResponse.json({ error: 'not_published' }, { status: 409 });
  if (!(promo_price < Number(prod.price))) return NextResponse.json({ error: 'price_not_lower' }, { status: 400 });
  if (starts_at < day) return NextResponse.json({ error: 'start_in_past' }, { status: 400 });
  if (ends_at < starts_at) return NextResponse.json({ error: 'end_before_start' }, { status: 400 });
  if ((new Date(ends_at).getTime() - new Date(starts_at).getTime()) / 86400000 > 90) return NextResponse.json({ error: 'too_long' }, { status: 400 });
  const { data: overlap } = await supabaseAdmin.from('product_promotions').select('id').eq('product_id', product_id).eq('status', 'scheduled')
    .lte('starts_at', ends_at).gte('ends_at', starts_at).limit(1);
  if (overlap && overlap.length) return NextResponse.json({ error: 'overlap' }, { status: 409 });

  const { data: created, error } = await supabaseAdmin.from('product_promotions')
    .insert({ product_id, owner_id: auth.user.id, promo_price, starts_at, ends_at, created_by: auth.user.id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, promotion: { ...created, state: stateOf(created, day) } });
}
