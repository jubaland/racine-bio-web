import { supabaseAdmin } from './supabase-admin';

// ── Traductions des produits ─────────────────────────────────────────────────
// Un produit (Hornafresh ou marchand) a une ligne product_translations par langue (nom + description).
// Suggestions gratuites : le nom traduit d'un autre produit portant le même nom français
// (« Orange Egypte » du marchand ← « Orange Egypte » du catalogue). Rien n'est inventé : sans
// correspondance, le champ reste vide et le nom français s'affiche dans cette langue.

export const PRODUCT_LANGS = ['en', 'zh', 'am', 'so'] as const;          // langues proposées à la saisie
export type ProductLang = typeof PRODUCT_LANGS[number];
export type Tr = { name: string; description: string };
export type TrSet = Partial<Record<string, Tr>>;

/** Nom comparable : minuscules, sans accents, sans ponctuation ni espaces superflus. */
export const normName = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Traductions enregistrées de plusieurs produits : { product_id → { lang → { name, description } } }. */
export async function translationsOf(productIds: number[]): Promise<Record<number, TrSet>> {
  const out: Record<number, TrSet> = {};
  const ids = [...new Set(productIds)];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabaseAdmin.from('product_translations').select('product_id, language_code, name, description').in('product_id', ids.slice(i, i + 200));
    for (const r of data || []) (out[r.product_id] ||= {})[r.language_code] = { name: r.name || '', description: r.description || '' };
  }
  return out;
}

/**
 * Suggestions de NOM pour des produits, tirées des produits homonymes déjà traduits.
 * { product_id → { lang → nom } } ; seules les langues sans traduction enregistrée sont suggérées.
 */
export async function suggestNames(products: { id: number; name: string }[]): Promise<Record<number, Partial<Record<string, string>>>> {
  const out: Record<number, Partial<Record<string, string>>> = {};
  if (!products.length) return out;
  const { data: all } = await supabaseAdmin.from('products').select('id, name');
  const byNorm: Record<string, number[]> = {};
  for (const p of all || []) (byNorm[normName(p.name)] ||= []).push(p.id);
  const twins = products.map(p => ({ p, ids: (byNorm[normName(p.name)] || []).filter(id => id !== p.id) }));
  const tr = await translationsOf([...products.map(p => p.id), ...twins.flatMap(t => t.ids)]);
  for (const { p, ids } of twins) {
    for (const lang of PRODUCT_LANGS) {
      if (tr[p.id]?.[lang]?.name) continue;
      const hit = ids.map(id => tr[id]?.[lang]?.name).find(Boolean);
      if (hit) (out[p.id] ||= {})[lang] = hit;
    }
  }
  return out;
}

/**
 * Enregistre les traductions fournies (une langue sans nom est ignorée ; un nom vidé supprime la ligne).
 * L'afar (aa) reprend le somali tant que la langue est masquée, comme pour le reste du site.
 */
export async function saveTranslations(productId: number, input: Record<string, { name?: string; description?: string } | null | undefined>) {
  const rows: { product_id: number; language_code: string; name: string; description: string }[] = [];
  const remove: string[] = [];
  for (const lang of PRODUCT_LANGS) {
    if (!(lang in (input || {}))) continue;
    const name = String(input[lang]?.name || '').trim().slice(0, 120);
    const description = String(input[lang]?.description || '').trim().slice(0, 1000);
    if (!name) { remove.push(lang); if (lang === 'so') remove.push('aa'); continue; }
    rows.push({ product_id: productId, language_code: lang, name, description });
    if (lang === 'so') rows.push({ product_id: productId, language_code: 'aa', name, description });
  }
  if (remove.length) await supabaseAdmin.from('product_translations').delete().eq('product_id', productId).in('language_code', remove);
  if (rows.length) {
    const { error } = await supabaseAdmin.from('product_translations').upsert(rows, { onConflict: 'product_id,language_code' });
    if (error) return { ok: false as const, error: error.message };
  }
  return { ok: true as const, saved: rows.filter(r => r.language_code !== 'aa').length, removed: remove.filter(l => l !== 'aa').length };
}

/**
 * À la validation d'un produit : applique les suggestions aux langues encore vides
 * (le produit n'apparaît pas en français dans les autres langues si son nom est déjà connu).
 */
export async function applySuggestions(product: { id: number; name: string }) {
  const s = (await suggestNames([product]))[product.id] || {};
  const input = Object.fromEntries(Object.entries(s).map(([lang, name]) => [lang, { name: name!, description: '' }]));
  if (!Object.keys(input).length) return { ok: true as const, saved: 0, removed: 0 };
  return saveTranslations(product.id, input);
}
