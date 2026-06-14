import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

async function getUser(request: Request) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!token) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user || null;
}

// Le client a-t-il une commande LIVRÉE contenant ce produit ?
async function isEligible(userId: string, productId: number) {
  const { data: orders } = await supabaseAdmin
    .from('orders').select('id').eq('user_id', userId).eq('status', 'delivered');
  const ids = (orders || []).map(o => o.id);
  if (!ids.length) return false;
  const { data: oi } = await supabaseAdmin
    .from('order_items').select('id').in('order_id', ids).eq('product_id', productId).limit(1);
  return (oi || []).length > 0;
}

async function countLikes(productId: number) {
  const { count } = await supabaseAdmin
    .from('product_likes').select('*', { count: 'exact', head: true }).eq('product_id', productId);
  return count || 0;
}

// GET ?mine=1 : { liked: number[], eligible: number[] } pour l'utilisateur courant.
// Permet à l'accueil de connaître l'état de tous les produits en UNE requête.
export async function GET(request: Request) {
  const url = new URL(request.url);

  if (url.searchParams.get('mine')) {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ liked: [], eligible: [] });
    const { data: likes } = await supabaseAdmin
      .from('product_likes').select('product_id').eq('user_id', user.id);
    const { data: orders } = await supabaseAdmin
      .from('orders').select('id').eq('user_id', user.id).eq('status', 'delivered');
    const ids = (orders || []).map(o => o.id);
    let eligible: number[] = [];
    if (ids.length) {
      const { data: oi } = await supabaseAdmin.from('order_items').select('product_id').in('order_id', ids);
      eligible = [...new Set((oi || []).map((r: any) => r.product_id))];
    }
    return NextResponse.json({ liked: (likes || []).map(l => l.product_id), eligible });
  }

  const productId = Number(url.searchParams.get('product_id'));
  if (!productId) return NextResponse.json({ error: 'product_id requis' }, { status: 400 });

  const { data: prod } = await supabaseAdmin.from('products').select('likes_count').eq('id', productId).maybeSingle();
  const count = prod?.likes_count ?? 0;

  const user = await getUser(request);
  if (!user) return NextResponse.json({ count, liked: false, eligible: false });

  const { data: like } = await supabaseAdmin
    .from('product_likes').select('product_id').eq('product_id', productId).eq('user_id', user.id).maybeSingle();
  const liked = !!like;
  const eligible = liked ? true : await isEligible(user.id, productId);
  return NextResponse.json({ count, liked, eligible });
}

// POST { product_id } : bascule le like (réservé aux clients éligibles)
export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });

  let productId = 0;
  try { productId = Number((await request.json()).product_id); } catch { /* ignore */ }
  if (!productId) return NextResponse.json({ error: 'product_id requis' }, { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from('product_likes').select('product_id').eq('product_id', productId).eq('user_id', user.id).maybeSingle();

  if (existing) {
    await supabaseAdmin.from('product_likes').delete().eq('product_id', productId).eq('user_id', user.id);
  } else {
    if (!(await isEligible(user.id, productId))) {
      return NextResponse.json({ error: 'not_eligible' }, { status: 403 });
    }
    await supabaseAdmin.from('product_likes').insert({ product_id: productId, user_id: user.id });
  }

  const count = await countLikes(productId);
  await supabaseAdmin.from('products').update({ likes_count: count }).eq('id', productId);
  return NextResponse.json({ liked: !existing, count });
}
