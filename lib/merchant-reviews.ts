import { supabaseAdmin } from './supabase-admin';

// Avis clients par marchand : éligibilité, agrégats dénormalisés.

// Le client a-t-il une commande LIVRÉE contenant au moins un produit de ce marchand ?
export async function canReviewMerchant(userId: string, ownerId: string) {
  const { data: orders } = await supabaseAdmin.from('orders').select('id').eq('user_id', userId).eq('status', 'delivered');
  const ids = (orders || []).map((o: any) => o.id);
  if (!ids.length) return false;
  const { data: prods } = await supabaseAdmin.from('products').select('id').eq('owner_id', ownerId);
  const pids = (prods || []).map((p: any) => p.id);
  if (!pids.length) return false;
  const { data: oi } = await supabaseAdmin.from('order_items').select('id').in('order_id', ids).in('product_id', pids).limit(1);
  return (oi || []).length > 0;
}

// Recalcule moyenne + nombre (avis publiés) sur merchant_profiles
export async function refreshMerchantRating(ownerId: string) {
  const { data } = await supabaseAdmin.from('merchant_reviews').select('rating').eq('owner_id', ownerId).eq('status', 'published');
  const n = (data || []).length;
  const avg = n ? Math.round(((data || []).reduce((s: number, r: any) => s + r.rating, 0) / n) * 10) / 10 : null;
  await supabaseAdmin.from('merchant_profiles').update({ rating_avg: avg, rating_count: n }).eq('user_id', ownerId);
  return { avg, count: n };
}
