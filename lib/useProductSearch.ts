'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { buildIndex, searchScores, norm } from './search';

// Recherche tolérante de produits, dans toutes les langues (voir lib/search.ts).
// Les noms traduits et les libellés de catégories sont lus une fois, à la première utilisation,
// et partagés entre les pages.
type Extra = { names: Record<number, string[]>; categories: Record<string, string[]> };
let cached: Promise<Extra> | null = null;

async function loadExtra(): Promise<Extra> {
  const names: Record<number, string[]> = {};
  const categories: Record<string, string[]> = {};
  try {
    for (let from = 0; ; from += 1000) {      // l'API renvoie au plus 1 000 lignes par requête
      const { data } = await supabase.from('product_translations').select('product_id, name').order('id').range(from, from + 999);
      for (const r of data || []) if (r.name) (names[r.product_id] ||= []).push(r.name);
      if (!data || data.length < 1000) break;
    }
    const [{ data: cats }, { data: tr }] = await Promise.all([
      supabase.from('categories').select('id, slug, label'),
      supabase.from('category_translations').select('category_id, label'),
    ]);
    const slugOf: Record<number, string> = {};
    for (const c of cats || []) { slugOf[c.id] = c.slug; (categories[c.slug] ||= []).push(c.label); }
    for (const r of tr || []) if (slugOf[r.category_id] && r.label) categories[slugOf[r.category_id]].push(r.label);
  } catch { /* la recherche fonctionne alors sur le français seul */ }
  return { names, categories };
}

/**
 * const { filter } = useProductSearch(products);
 * filter(list, query) → produits de `list` correspondant à la recherche, meilleurs d'abord
 * (recherche vide : liste inchangée).
 */
export function useProductSearch(products: any[]) {
  const [extra, setExtra] = useState<Extra>({ names: {}, categories: {} });
  useEffect(() => {
    let on = true;
    (cached ||= loadExtra()).then(x => { if (on) setExtra(x); });
    return () => { on = false; };
  }, []);

  const index = useMemo(
    () => buildIndex(products, extra.names, p => [p.shop_name, ...(extra.categories[p.category] || [])]),
    [products, extra],
  );

  const filter = <T extends { id: number }>(list: T[], query: string): T[] => {
    if (!norm(query)) return list;
    const scores = searchScores(query, index);
    return list.filter(p => scores.has(p.id)).sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));
  };
  return { filter };
}
