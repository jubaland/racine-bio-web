import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  "https://sneuexxysxlwpokhkjho.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZXVleHh5c3hsd3Bva2hramhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTM3OTksImV4cCI6MjA5NDMyOTc5OX0.JizTtZmq83t5KGK2WkMtfIVtUo8VgFg6rI1ZEl4zjZY"
);

export async function fetchProducts() {
  // Boutique : seuls les produits publiés sont visibles (les brouillons et
  // archivés restent en base mais cachés du site). L'admin a sa propre requête.
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  const products = data || [];
  // Enseigne du vendeur pour les produits marchands (owner_id) — une seule requête, uniquement si nécessaire
  const ownerIds = [...new Set(products.map((p: any) => p.owner_id).filter(Boolean))];
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('merchant_profiles').select('user_id, shop_name, rating_avg, rating_count').in('user_id', ownerIds);
    const byOwner: Record<string, any> = Object.fromEntries((profiles || []).map((m: any) => [m.user_id, m]));
    products.forEach((p: any) => {
      if (!p.owner_id) return;
      const m = byOwner[p.owner_id];
      p.shop_name = m?.shop_name || p.farm || null;
      p.shop_rating = m?.rating_avg != null ? Number(m.rating_avg) : null;   // note moyenne du marchand (avis clients)
      p.shop_rating_count = m?.rating_count || 0;
    });
  }
  // Promotions planifiées actives → prix promo + ancien prix barré (calcul à la lecture)
  const { applyPromotions } = await import('./promotions');
  await applyPromotions(supabase, products);
  // Paniers composés : composition, valeur catalogue, stock effectif (composants) ; anti-gaspi expirés retirés
  const { decorateBundles } = await import('./bundles');
  return decorateBundles(supabase, products);
}

export async function fetchCategories() {
  const { data } = await supabase.from('categories').select('*').order('id', { ascending: true });
  return data || [];
}

export async function fetchPromos() {
  const { data } = await supabase.from('promos').select('*').eq('active', true);
  return data || [];
}

export async function fetchProducers() {
  const { data } = await supabase.from('producers').select('*').order('rating', { ascending: false });
  return data || [];
}

// Réglages d'affichage (visibilité des blocs de l'accueil, etc.)
export async function fetchSiteSettings(): Promise<Record<string, boolean>> {
  const { data } = await supabase.from('site_settings').select('key, value');
  const map: Record<string, boolean> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.value; });
  return map;
}

export async function fetchUITranslations(languageCode: string) {
  const { data } = await supabase
    .from('ui_translations')
    .select('key, value')
    .eq('language_code', languageCode);
  const map: Record<string, string> = {};
  if (data) data.forEach((item: any) => { map[item.key] = item.value; });
  return map;
}

export async function fetchProductTranslations(languageCode: string) {
  const { data } = await supabase
    .from('product_translations')
    .select('product_id, name, description')
    .eq('language_code', languageCode);
  const map: Record<number, { name: string; description: string }> = {};
  if (data) data.forEach((item: any) => { map[item.product_id] = { name: item.name, description: item.description }; });
  return map;
}

export async function fetchCategoryTranslations(languageCode: string) {
  const { data } = await supabase
    .from('category_translations')
    .select('category_id, label')
    .eq('language_code', languageCode);
  const map: Record<number, string> = {};
  if (data) data.forEach((item: any) => { map[item.category_id] = item.label; });
  return map;
}

export async function fetchPromoTranslations(languageCode: string) {
  const { data } = await supabase
    .from('promo_translations')
    .select('promo_id, badge, title, sub')
    .eq('language_code', languageCode);
  const map: Record<number, { badge: string; title: string; sub: string }> = {};
  if (data) data.forEach((item: any) => { map[item.promo_id] = { badge: item.badge, title: item.title, sub: item.sub }; });
  return map;
}

export async function fetchDeliveryOptionTranslations(languageCode: string) {
  const { data } = await supabase
    .from('delivery_option_translations')
    .select('delivery_option_id, name, description')
    .eq('language_code', languageCode);
  const map: Record<number, { name: string; description: string }> = {};
  if (data) data.forEach((item: any) => { map[item.delivery_option_id] = { name: item.name, description: item.description }; });
  return map;
}

export async function fetchLanguages() {
  const { data } = await supabase.from('languages').select('*').order('id', { ascending: true });
  return data || [];
}