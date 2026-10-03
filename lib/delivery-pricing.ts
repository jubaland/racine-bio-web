// Frais de livraison d'une commande — calcul pur, partagé par le navigateur (affichage au paiement)
// et le serveur (montant réellement facturé). Aucun accès à la base ici.
//
// Une seule remise s'applique (pas de cumul) : la plus avantageuse. À remise égale, on prend celle
// qui ne consomme rien pour le client : seuil automatique, puis code promo, puis code parrainage,
// puis crédit parrainage.

export type DeliveryScope = 'standard' | 'all';   // montant couvert : celui de la livraison standard, ou toute l'option choisie
export type DeliveryRules = { free_threshold: number | null; threshold_scope: DeliveryScope };
export type PromoKind = 'free_delivery' | 'percent' | 'amount';
export type PromoBenefit = {
  code: string;
  kind: PromoKind;
  scope: DeliveryScope;                 // livraison offerte : montant couvert
  max_discount: number | null;          // plafond (Fdj) — obligatoire pour un pourcentage
  min_subtotal: number | null;          // panier minimum (articles)
  value: number | null;                 // % ou Fdj selon le type
  products_scope: 'all' | 'hornafresh'; // articles concernés : tous, ou produits Hornafresh seulement
  eligible_subtotal?: number | null;    // montant des articles concernés, calculé par le serveur pour ce panier
};
export type DiscountSource = 'threshold' | 'promo' | 'referral_code' | 'referral_credit';
export type DeliveryQuote = {
  base: number;                      // tarif de l'option choisie
  discount: number;                  // montant offert
  fee: number;                       // montant facturé
  source: DiscountSource | null;
  promo_code: string | null;         // renseigné seulement si c'est le code promo qui s'applique
  threshold_remaining: number | null; // ce qu'il manque au panier pour le seuil automatique (null : pas de seuil, ou atteint)
  promo_missing: number | null;      // ce qu'il manque au panier pour utiliser le code promo saisi
};

export const NO_RULES: DeliveryRules = { free_threshold: null, threshold_scope: 'standard' };

const int = (n: unknown) => Math.max(0, Math.round(Number(n) || 0));

export function computeDelivery(input: {
  base: number;
  standardPrice: number | null;      // tarif de l'option « standard » (null : aucune option standard définie)
  subtotal: number;                  // montant des articles
  rules: DeliveryRules;
  promo?: PromoBenefit | null;       // code promo déjà validé (dates, limites, client)
  referralCode?: boolean;            // code parrainage valable (première commande)
  referralCredit?: boolean;          // crédit parrainage utilisé
}): DeliveryQuote {
  const base = int(input.base);
  const subtotal = int(input.subtotal);
  const cover = (scope: DeliveryScope) => scope === 'all' ? base : Math.min(base, int(input.standardPrice));

  const threshold = input.rules.free_threshold != null && input.rules.free_threshold > 0 ? int(input.rules.free_threshold) : null;
  const thresholdReached = threshold != null && subtotal >= threshold;
  const promo = input.promo && (input.promo.kind ?? 'free_delivery') === 'free_delivery' ? input.promo : null;   // les codes sur les articles ne touchent pas la livraison
  const promoMissing = promo?.min_subtotal != null && subtotal < promo.min_subtotal ? promo.min_subtotal - subtotal : null;

  const candidates: [DiscountSource, number][] = [
    ['threshold', thresholdReached ? cover(input.rules.threshold_scope) : 0],
    ['promo', promo && promoMissing == null ? Math.min(cover(promo.scope), promo.max_discount != null ? int(promo.max_discount) : base) : 0],
    ['referral_code', input.referralCode ? cover('standard') : 0],
    ['referral_credit', input.referralCredit ? cover('standard') : 0],
  ];
  let source: DiscountSource | null = null, discount = 0;
  for (const [s, d] of candidates) if (d > discount) { source = s; discount = d; }

  return {
    base, discount, fee: base - discount, source,
    promo_code: source === 'promo' ? promo!.code : null,
    threshold_remaining: threshold != null && !thresholdReached && base > 0 ? threshold - subtotal : null,
    promo_missing: promoMissing,
  };
}

/** Remise d'un code promo « pourcentage » ou « montant » sur les articles (jamais sur la livraison). */
export function computePromoItems(input: { promo?: PromoBenefit | null; subtotal: number }): { discount: number; missing: number | null } {
  const promo = input.promo;
  const subtotal = int(input.subtotal);
  if (!promo || (promo.kind ?? 'free_delivery') === 'free_delivery' || !promo.value) return { discount: 0, missing: null };
  if (promo.min_subtotal != null && subtotal < promo.min_subtotal) return { discount: 0, missing: promo.min_subtotal - subtotal };
  const eligible = Math.min(subtotal, promo.eligible_subtotal != null ? int(promo.eligible_subtotal) : subtotal);
  let discount = promo.kind === 'percent' ? Math.floor(eligible * Math.min(100, promo.value) / 100) : Math.min(eligible, int(promo.value));
  if (promo.max_discount != null) discount = Math.min(discount, int(promo.max_discount));
  return { discount, missing: null };
}
