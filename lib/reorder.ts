// ── Recommander une commande passée (pur, utilisable côté client) ─────────────
// À partir des articles d'une ancienne commande et du catalogue actuel (produits visibles, prix promo
// et stock effectif déjà calculés par fetchProducts), dit ce qui peut être remis au panier :
//   ok          : disponible à la quantité d'origine
//   reduced     : disponible, mais en quantité moindre (stock)
//   unavailable : produit retiré, en rupture, ou boutique inactive
// Le prix est toujours celui d'aujourd'hui (le serveur l'impose de toute façon à la commande).

export type PastItem = { product_id: number; quantity: number; price: number; product_name?: string | null; product_unit?: string | null; product_image_url?: string | null };
export type ReorderLine = {
  product_id: number; name: string; unit: string; image_url: string | null;
  wanted: number; quantity: number; status: 'ok' | 'reduced' | 'unavailable';
  old_price: number; price: number | null;          // price null : indisponible
  product: any | null;                               // produit du catalogue, à remettre au panier
};
export type ReorderPlan = { lines: ReorderLine[]; available: number; reduced: number; unavailable: number; total: number; old_total: number; price_changed: boolean };

export function planReorder(items: PastItem[], catalog: any[]): ReorderPlan {
  const byId = new Map<number, any>(catalog.map(p => [p.id, p]));
  // Un même produit présent sur plusieurs lignes est regroupé
  const merged = new Map<number, PastItem>();
  for (const it of items || []) {
    const cur = merged.get(it.product_id);
    if (cur) cur.quantity += Number(it.quantity) || 0; else merged.set(it.product_id, { ...it, quantity: Number(it.quantity) || 0 });
  }
  const lines: ReorderLine[] = [];
  for (const it of merged.values()) {
    const p = byId.get(it.product_id) || null;
    const stock = p ? Math.max(0, Number(p.stock_qty) || 0) : 0;
    const quantity = Math.min(it.quantity, stock);
    lines.push({
      product_id: it.product_id,
      name: p?.name || it.product_name || `#${it.product_id}`,
      unit: (p?.unit || it.product_unit || '').replace(/^\s*\/\s*/, ''),
      image_url: p?.image_url || it.product_image_url || null,
      wanted: it.quantity, quantity,
      status: quantity <= 0 ? 'unavailable' : quantity < it.quantity ? 'reduced' : 'ok',
      old_price: Number(it.price) || 0,
      price: quantity > 0 ? Number(p.price) : null,
      product: quantity > 0 ? p : null,
    });
  }
  const kept = lines.filter(l => l.status !== 'unavailable');
  return {
    lines,
    available: kept.length,
    reduced: lines.filter(l => l.status === 'reduced').length,
    unavailable: lines.filter(l => l.status === 'unavailable').length,
    total: kept.reduce((s, l) => s + (l.price || 0) * l.quantity, 0),
    old_total: lines.reduce((s, l) => s + l.old_price * l.wanted, 0),
    price_changed: kept.some(l => l.price !== l.old_price),
  };
}
