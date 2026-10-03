// Frais de livraison d'une commande — calcul pur, partagé par le navigateur (affichage au paiement)
// et le serveur (montant réellement facturé). Aucun accès à la base ici.
//
// Une seule remise s'applique (pas de cumul) : la plus avantageuse. À remise égale, on prend celle
// qui ne consomme rien pour le client : seuil automatique, puis code promo, puis code parrainage,
// puis crédit parrainage.

export type DeliveryScope = 'standard' | 'all';   // montant couvert : celui de la livraison standard, ou toute l'option choisie
export type DeliveryRules = { free_threshold: number | null; threshold_scope: DeliveryScope };
export type PromoBenefit = { code: string; scope: DeliveryScope; max_discount: number | null; min_subtotal: number | null };
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
  const promo = input.promo || null;
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
