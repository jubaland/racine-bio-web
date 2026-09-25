import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';
import { refreshMerchantRating } from '../../../../lib/merchant-reviews';

// Admin — modération des avis marchands : GET (liste) ; POST { action: 'hide' | 'show', id }
export async function GET(request: Request) {
  const auth = await requirePerm(request, 'merchants', 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const [{ data: rows }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from('merchant_reviews').select('*').order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('merchant_profiles').select('user_id, shop_name, rating_avg, rating_count'),
  ]);
  const shops: Record<string, any> = Object.fromEntries((profiles || []).map((m: any) => [m.user_id, m]));
  return NextResponse.json({
    reviews: (rows || []).map((r: any) => ({ ...r, shop: shops[r.owner_id]?.shop_name || 'Marchand' })),
    merchants: (profiles || []).filter((m: any) => m.rating_count > 0).map((m: any) => ({ id: m.user_id, shop: m.shop_name, avg: Number(m.rating_avg), count: m.rating_count })),
  });
}

export async function POST(request: Request) {
  const auth = await requirePerm(request, 'merchants', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }
  if (!['hide', 'show'].includes(body.action) || !body.id) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { data: r } = await supabaseAdmin.from('merchant_reviews').select('id, owner_id').eq('id', body.id).maybeSingle();
  if (!r) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  await supabaseAdmin.from('merchant_reviews').update({ status: body.action === 'hide' ? 'hidden' : 'published' }).eq('id', r.id);
  const agg = await refreshMerchantRating(r.owner_id);
  return NextResponse.json({ ok: true, ...agg });
}
