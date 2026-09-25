import type { SupabaseClient } from '@supabase/supabase-js';

// ── Paniers composés (thématiques / anti-gaspi) ─────────────────────────────
// Un panier est un produit Hornafresh (products.is_bundle) dont la composition est dans
// bundle_items. Ce module centralise :
//   • la lecture de la composition (avec les infos des composants),
//   • la disponibilité effective (stock du panier ET stock des composants, validité),
//   • le coût / la valeur d'un panier (marge Finances, « vous économisez »),
//   • l'ajustement de stock commun à toute l'app (commande, annulation, retrait d'article,
//     abonnement) : pour un panier, les composants sont ajustés en cascade.

export type BundleComponent = {
  product_id: number; quantity: number; sort_order: number;
  name: string; unit: string; stock_qty: number; price: number; cost_price: number | null;
  status: string; image_url: string | null; is_bundle: boolean; owner_id: string | null;
  origin_country: string | null; product_type: string | null; farm: string | null; is_local: boolean; // infos fiche produit (affichées dans le contenu du panier)
};
export type BundleContentsMap = Record<number, BundleComponent[]>;
export type BundleSnapshot = { product_id: number; name: string; unit: string; quantity: number };

/** Composition des paniers demandés (ids), avec l'état courant de chaque composant. */
export async function loadBundleContents(db: SupabaseClient, bundleIds: number[]): Promise<BundleContentsMap> {
  const ids = [...new Set(bundleIds.filter(Boolean))];
  const out: BundleContentsMap = {};
  if (!ids.length) return out;
  const { data: rows } = await db.from('bundle_items').select('bundle_id, product_id, quantity, sort_order').in('bundle_id', ids).order('sort_order');
  const compIds = [...new Set((rows || []).map((r: any) => r.product_id))];
  const { data: comps } = compIds.length
    ? await db.from('products').select('id, name, unit, stock_qty, price, cost_price, status, image_url, is_bundle, owner_id, origin_country, product_type, farm, is_local').in('id', compIds)
    : { data: [] as any[] };
  const byId: Record<number, any> = Object.fromEntries((comps || []).map((c: any) => [c.id, c]));
  for (const id of ids) out[id] = [];
  for (const r of rows || []) {
    const c = byId[r.product_id];
    // Composant invisible (non publié pour le client anonyme, supprimé…) → gardé avec stock 0 : le panier devient indisponible
    out[r.bundle_id].push({
      product_id: r.product_id, quantity: Number(r.quantity), sort_order: r.sort_order,
      name: c?.name ?? `Produit #${r.product_id}`, unit: c?.unit ?? '', stock_qty: c && c.status === 'published' ? Number(c.stock_qty) || 0 : 0,
      price: Number(c?.price) || 0, cost_price: c?.cost_price != null ? Number(c.cost_price) : null,
      status: c?.status ?? 'missing', image_url: c?.image_url ?? null, is_bundle: !!c?.is_bundle, owner_id: c?.owner_id ?? null,
      origin_country: c?.origin_country ?? null, product_type: c?.product_type ?? null, farm: c?.farm ?? null, is_local: !!c?.is_local,
    });
  }
  return out;
}

/** Nombre de paniers réellement commandables : stock du panier, stock des composants, validité. */
export function bundleAvailability(bundle: { stock_qty?: number | null; bundle_ends_at?: string | null; status?: string }, contents: BundleComponent[], now = Date.now()): number {
  if (bundle.status && bundle.status !== 'published') return 0;
  if (bundle.bundle_ends_at && new Date(bundle.bundle_ends_at).getTime() <= now) return 0;
  if (!contents.length) return 0;
  let avail = Math.max(0, Math.floor(Number(bundle.stock_qty) || 0));
  for (const c of contents) avail = Math.min(avail, Math.floor(c.stock_qty / c.quantity));
  return Math.max(0, avail);
}

/** Valeur catalogue des composants d'un panier (prix unitaires × quantités). */
export const bundleValue = (contents: BundleComponent[]) => contents.reduce((s, c) => s + c.price * c.quantity, 0);

/** Coût d'un panier = somme des coûts des composants ; null si aucun coût connu. */
export function bundleCost(contents: BundleComponent[]): number | null {
  const known = contents.filter(c => c.cost_price != null);
  if (!known.length) return null;
  return known.reduce((s, c) => s + (c.cost_price as number) * c.quantity, 0);
}

/** Photo de la composition pour order_items.bundle_contents (par panier). */
export const bundleSnapshot = (contents: BundleComponent[]): BundleSnapshot[] =>
  contents.map(c => ({ product_id: c.product_id, name: c.name, unit: c.unit, quantity: c.quantity }));

/** Libellé court d'une composition : « 2 kg Tomates, 1 botte Menthe ». */
export const describeContents = (contents: { name: string; unit?: string | null; quantity: number }[], factor = 1) =>
  contents.map(c => `${fmtQty(c.quantity * factor)} ${c.unit || ''} ${c.name}`.replace(/\s+/g, ' ').trim()).join(', ');
const fmtQty = (n: number) => Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);

export type StockChange = { product_id: number; name: string; unit: string; owner_id: string | null; before: number; after: number };

/**
 * Applique des variations de stock (delta < 0 = commande, > 0 = remise en stock). Pour un panier,
 * le panier ET ses composants (delta × quantité) sont ajustés. Les deltas sont agrégés par produit,
 * lecture puis écriture (même approche que le reste de l'app). Renvoie l'avant/après par produit
 * touché — utilisé pour les alertes de stock bas.
 */
export async function applyStockDeltas(db: SupabaseClient, lines: { product_id: number; delta: number }[]): Promise<StockChange[]> {
  const deltas: Record<number, number> = {};
  const add = (id: number, d: number) => { if (d) deltas[id] = (deltas[id] || 0) + d; };
  const ids = [...new Set(lines.map(l => Number(l.product_id)).filter(Boolean))];
  if (!ids.length) return [];
  const { data: prods } = await db.from('products').select('id, is_bundle').in('id', ids);
  const bundleIds = (prods || []).filter((p: any) => p.is_bundle).map((p: any) => p.id);
  const contents = bundleIds.length ? await loadBundleContents(db, bundleIds) : {};
  for (const l of lines) {
    const id = Number(l.product_id); const d = Number(l.delta) || 0;
    add(id, d);
    for (const c of contents[id] || []) add(c.product_id, d * c.quantity);
  }
  const touched = Object.keys(deltas).map(Number);
  const { data: current } = await db.from('products').select('id, name, unit, owner_id, stock_qty').in('id', touched);
  const changes: StockChange[] = [];
  await Promise.all((current || []).map(async (p: any) => {
    const before = Number(p.stock_qty) || 0;
    const after = Math.max(0, before + deltas[p.id]);
    await db.from('products').update({ stock_qty: after }).eq('id', p.id);
    changes.push({ product_id: p.id, name: p.name, unit: p.unit, owner_id: p.owner_id, before, after });
  }));
  return changes;
}

/**
 * Enrichit une liste de produits (site public / API) : pour chaque panier, attache
 * `bundle_items` (composition), `bundle_value` (valeur catalogue), et remplace `stock_qty` par la
 * disponibilité effective. Les paniers anti-gaspi expirés sont retirés de la liste.
 */
export async function decorateBundles<T extends { id: number; is_bundle?: boolean; stock_qty?: number; bundle_ends_at?: string | null; status?: string }>(db: SupabaseClient, products: T[]): Promise<T[]> {
  const bundles = products.filter(p => p.is_bundle);
  if (!bundles.length) return products;
  const contents = await loadBundleContents(db, bundles.map(b => b.id));
  const now = Date.now();
  return products.filter(p => {
    if (!p.is_bundle) return true;
    if (p.bundle_ends_at && new Date(p.bundle_ends_at).getTime() <= now) return false;
    const c = contents[p.id] || [];
    (p as any).bundle_items = c.map(x => ({ product_id: x.product_id, name: x.name, unit: x.unit, quantity: x.quantity, image_url: x.image_url, price: x.price, origin_country: x.origin_country, product_type: x.product_type, farm: x.farm, is_local: x.is_local }));
    (p as any).bundle_value = bundleValue(c);
    (p as any).stock_qty = bundleAvailability(p, c, now);
    return true;
  });
}
