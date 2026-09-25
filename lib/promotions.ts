import type { SupabaseClient } from '@supabase/supabase-js';

// Promotions planifiées : prix effectif calculé à la lecture.
// Applique aux produits : price = prix promo, old_price = prix normal, promo_ends_at, promo_id.
// `client` : client anonyme (site) ou service role (API commandes) — la table est en lecture publique.

export const todayStr = () => new Date().toISOString().slice(0, 10);

export async function activePromotions(client: SupabaseClient, productIds: number[], day = todayStr()) {
  if (!productIds.length) return {} as Record<number, { id: number; promo_price: number; ends_at: string; starts_at: string }>;
  const { data } = await client.from('product_promotions')
    .select('id, product_id, promo_price, starts_at, ends_at')
    .in('product_id', productIds).eq('status', 'scheduled').lte('starts_at', day).gte('ends_at', day);
  const map: Record<number, { id: number; promo_price: number; ends_at: string; starts_at: string }> = {};
  for (const p of data || []) {
    // Plusieurs promos actives (ne devrait pas arriver) : la moins chère l'emporte
    if (!map[p.product_id] || Number(p.promo_price) < map[p.product_id].promo_price) map[p.product_id] = { id: p.id, promo_price: Number(p.promo_price), ends_at: p.ends_at, starts_at: p.starts_at };
  }
  return map;
}

export async function applyPromotions<T extends { id: number; price: number | string; old_price?: number | string | null }>(client: SupabaseClient, products: T[]) {
  const promos = await activePromotions(client, products.map(p => p.id));
  for (const p of products as any[]) {
    const pr = promos[p.id];
    if (pr && pr.promo_price < Number(p.price)) {
      p.old_price = Number(p.price);
      p.price = pr.promo_price;
      p.promo_ends_at = pr.ends_at;
      p.promo_id = pr.id;
    }
  }
  return products;
}
