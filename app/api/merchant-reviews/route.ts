import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { canReviewMerchant, refreshMerchantRating } from '../../../lib/merchant-reviews';

// Avis clients par marchand
//   GET  ?owner=<uuid>                     → { avg, count, reviews: [{name, rating, comment, date}], mine, eligible }
//   POST { owner_id, rating, comment }     → crée ou met à jour l'avis du client connecté (éligible = commande livrée)

async function getUser(request: Request) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!token) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user || null;
}

export async function GET(request: Request) {
  const owner = new URL(request.url).searchParams.get('owner') || '';
  if (!/^[0-9a-f-]{36}$/i.test(owner)) return NextResponse.json({ error: 'owner requis' }, { status: 400 });
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabaseAdmin.from('merchant_profiles').select('rating_avg, rating_count').eq('user_id', owner).maybeSingle(),
    supabaseAdmin.from('merchant_reviews').select('user_name, rating, comment, created_at').eq('owner_id', owner).eq('status', 'published').order('created_at', { ascending: false }).limit(50),
  ]);
  const base = { avg: profile?.rating_avg != null ? Number(profile.rating_avg) : null, count: profile?.rating_count || 0, reviews: (rows || []).map((r: any) => ({ name: r.user_name || 'Client', rating: r.rating, comment: r.comment, date: r.created_at })) };
  const user = await getUser(request);
  if (!user) return NextResponse.json({ ...base, mine: null, eligible: false });
  const { data: mine } = await supabaseAdmin.from('merchant_reviews').select('rating, comment, status, updated_at').eq('owner_id', owner).eq('user_id', user.id).maybeSingle();
  const eligible = mine ? true : await canReviewMerchant(user.id, owner);
  return NextResponse.json({ ...base, mine: mine || null, eligible });
}

export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });
  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const owner = String(body.owner_id || ''), rating = Number(body.rating);
  const comment = String(body.comment || '').trim().slice(0, 600) || null;
  if (!/^[0-9a-f-]{36}$/i.test(owner) || !(rating >= 1 && rating <= 5) || !Number.isInteger(rating)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  if (owner === user.id) return NextResponse.json({ error: 'self_review' }, { status: 403 });
  const { data: profile } = await supabaseAdmin.from('merchant_profiles').select('user_id, shop_name').eq('user_id', owner).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!(await canReviewMerchant(user.id, owner))) return NextResponse.json({ error: 'not_eligible' }, { status: 403 });

  const firstName = String(user.user_metadata?.full_name || '').trim().split(/\s+/)[0] || null;
  const { data: existing } = await supabaseAdmin.from('merchant_reviews').select('id, status').eq('owner_id', owner).eq('user_id', user.id).maybeSingle();
  if (existing) {
    // Un avis masqué par l'admin reste masqué même modifié (la modération n'est pas contournable)
    await supabaseAdmin.from('merchant_reviews').update({ rating, comment, user_name: firstName, updated_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    const { error } = await supabaseAdmin.from('merchant_reviews').insert({ owner_id: owner, user_id: user.id, user_name: firstName, rating, comment });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    try {
      const { notifyUser } = await import('../../../lib/notify');
      await notifyUser(owner, { title: `⭐ Nouvel avis client : ${rating}/5`, body: `${firstName || 'Un client'} a noté ${profile.shop_name} ${rating}/5${comment ? ` : « ${comment.slice(0, 120)}${comment.length > 120 ? '…' : ''} »` : ''}.`, url: '/producer/dashboard' });
    } catch { /* ignore */ }
  }
  const agg = await refreshMerchantRating(owner);
  return NextResponse.json({ ok: true, updated: !!existing, ...agg });
}
