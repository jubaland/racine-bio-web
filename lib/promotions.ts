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

// Création d'une promotion avec les règles communes (marchand ou admin).
//  - ownerScope : 'merchant' → le produit doit appartenir à `actorId` ; 'hornafresh' → produit sans propriétaire
//  - prix promo > 0 et < prix normal ; début ≥ aujourd'hui ; fin ≥ début ; 90 jours max ; pas de chevauchement
export async function createPromotion(admin: SupabaseClient, input: { product_id: any; promo_price: any; starts_at: any; ends_at: any }, opts: { actorId: string; ownerScope: 'merchant' | 'hornafresh' }) {
  const day = todayStr();
  const product_id = Number(input.product_id), promo_price = Number(input.promo_price);
  const starts_at = String(input.starts_at || ''), ends_at = String(input.ends_at || '');
  const isDate = (s: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(s + 'T00:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; };
  if (!product_id || !promo_price || !isDate(starts_at) || !isDate(ends_at)) return { error: 'invalid', status: 400 } as const;
  const { data: prod } = await admin.from('products').select('id, price, status, owner_id').eq('id', product_id).maybeSingle();
  if (!prod) return { error: 'not_found', status: 404 } as const;
  if (opts.ownerScope === 'merchant' && prod.owner_id !== opts.actorId) return { error: 'not_found', status: 404 } as const;
  if (opts.ownerScope === 'hornafresh' && prod.owner_id) return { error: 'merchant_product', status: 403 } as const;
  if (prod.status !== 'published') return { error: 'not_published', status: 409 } as const;
  if (!(promo_price < Number(prod.price))) return { error: 'price_not_lower', status: 400 } as const;
  if (starts_at < day) return { error: 'start_in_past', status: 400 } as const;
  if (ends_at < starts_at) return { error: 'end_before_start', status: 400 } as const;
  if ((new Date(ends_at).getTime() - new Date(starts_at).getTime()) / 86400000 > 90) return { error: 'too_long', status: 400 } as const;
  const { data: overlap } = await admin.from('product_promotions').select('id').eq('product_id', product_id).eq('status', 'scheduled').lte('starts_at', ends_at).gte('ends_at', starts_at).limit(1);
  if (overlap && overlap.length) return { error: 'overlap', status: 409 } as const;
  const { data: created, error } = await admin.from('product_promotions')
    .insert({ product_id, owner_id: opts.ownerScope === 'merchant' ? opts.actorId : null, promo_price, starts_at, ends_at, created_by: opts.actorId }).select().single();
  if (error || !created) return { error: error?.message || 'insert_failed', status: 500 } as const;
  return { promotion: { ...created, state: promoState(created, day) } } as const;
}

export const promoState = (p: { status: string; starts_at: string; ends_at: string }, day = todayStr()) =>
  p.status === 'cancelled' ? 'cancelled' : p.ends_at < day ? 'ended' : p.starts_at > day ? 'upcoming' : 'active';

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
