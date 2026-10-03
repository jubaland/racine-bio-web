// Montants d'une commande — calcul pur, partagé par la création, la modification d'une ligne,
// la remise admin, les e-mails, le reçu et les écrans. Le prix d'une ligne reste toujours le prix
// réel : les remises sont stockées à part (ligne, code promo, remise admin) et jamais cumulées
// au-delà du montant des articles. La livraison n'est jamais réduite par ces remises.

export type TotalsInput = {
  items: { price: number | string; quantity: number | string; discount?: number | string | null }[];
  promo_discount?: number | string | null;   // code promo (pourcentage / montant) sur les articles
  admin_discount?: number | string | null;   // remise globale accordée par l'admin
  delivery_fee?: number | string | null;
};
export type Totals = {
  items_sum: number;        // articles au prix réel
  line_discounts: number;   // remises admin par ligne
  promo_discount: number;
  admin_discount: number;
  discounts: number;        // toutes remises sur les articles
  goods: number;            // articles après remises
  delivery_fee: number;
  total: number;
};

const n = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

export function orderTotals(o: TotalsInput): Totals {
  const items_sum = o.items.reduce((s, it) => s + n(it.price) * n(it.quantity), 0);
  const line_discounts = Math.min(items_sum, o.items.reduce((s, it) => s + n(it.discount), 0));
  const promo_discount = Math.min(items_sum - line_discounts, n(o.promo_discount));
  const admin_discount = Math.min(items_sum - line_discounts - promo_discount, n(o.admin_discount));
  const discounts = line_discounts + promo_discount + admin_discount;
  const goods = items_sum - discounts;
  const delivery_fee = n(o.delivery_fee);
  return { items_sum, line_discounts, promo_discount, admin_discount, discounts, goods, delivery_fee, total: goods + delivery_fee };
}
