import { supabaseAdmin } from './supabase-admin';
import { computeDelivery, computePromoItems, type DeliveryRules, type DeliveryScope, type PromoBenefit, type PromoKind, type DeliveryQuote } from './delivery-pricing';

// ── Codes promo « livraison offerte » et frais de livraison côté serveur ─────────────────────
// Le navigateur affiche une estimation (lib/delivery-pricing.ts) ; le montant facturé est toujours
// recalculé ici à partir de la base : tarif de l'option, seuil automatique, code promo, parrainage.

export type PromoRow = {
  id: number; code: string; kind: PromoKind; label: string | null; active: boolean; value: number | null; products_scope: 'all' | 'hornafresh';
  starts_at: string | null; ends_at: string | null; min_subtotal: number | null; first_order_only: boolean;
  max_uses: number | null; max_uses_per_user: number | null; scope: DeliveryScope; max_discount: number | null;
  user_id: string | null; created_at: string;
};
// Motifs de refus, traduits côté navigateur (checkout.promo_e_*)
export type PromoReason = 'unknown' | 'inactive' | 'not_started' | 'expired' | 'first_order_only' | 'exhausted' | 'per_user_limit' | 'login_required';
export type ReferralReason = 'unknown' | 'own_code' | 'first_order_only';

const RULE_KEYS = ['delivery.free_threshold', 'delivery.free_threshold_scope'];

export const cleanCode = (s: unknown) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
export const cleanPhone = (s: unknown) => { const d = String(s ?? '').replace(/\D/g, ''); return d.length >= 8 ? d : null; };

/** Seuil automatique de livraison offerte (vide = désactivé). */
export async function deliveryRules(): Promise<DeliveryRules> {
  const { data } = await supabaseAdmin.from('app_settings').select('key, value_num, value_text').in('key', RULE_KEYS);
  const row = (k: string) => (data || []).find((r: any) => r.key === k);
  const th = row('delivery.free_threshold')?.value_num;
  return {
    free_threshold: th != null && Number(th) > 0 ? Math.round(Number(th)) : null,
    threshold_scope: row('delivery.free_threshold_scope')?.value_text === 'all' ? 'all' : 'standard',
  };
}

export async function saveDeliveryRules(r: DeliveryRules) {
  const now = new Date().toISOString();
  await supabaseAdmin.from('app_settings').upsert([
    { key: 'delivery.free_threshold', value_num: r.free_threshold, value_text: null, updated_at: now },
    { key: 'delivery.free_threshold_scope', value_num: null, value_text: r.threshold_scope, updated_at: now },
  ], { onConflict: 'key' });
}

export async function findPromo(code: string): Promise<PromoRow | null> {
  const c = cleanCode(code);
  if (c.length < 3) return null;
  const { data } = await supabaseAdmin.from('promo_codes').select('*').eq('code', c).maybeSingle();
  return (data as PromoRow) || null;
}

/** Utilisations comptées : commandes non annulées (même règle que la fonction promo_redeem). */
async function countUses(promoId: number, who?: { userId: string | null; phone: string | null }) {
  const { data } = await supabaseAdmin.from('promo_redemptions').select('id, user_id, phone, order_id, created_at, orders ( status )').eq('promo_id', promoId);
  const recent = Date.now() - 10 * 60 * 1000;
  const live = (data || []).filter((r: any) => r.order_id == null ? new Date(r.created_at).getTime() > recent : r.orders && r.orders.status !== 'cancelled');
  if (!who) return live.length;
  return live.filter((r: any) => (who.userId && r.user_id === who.userId) || (who.phone && r.phone === who.phone)).length;
}

/** Commandes déjà passées par ce client (compte, ou téléphone pour un invité), annulées exclues. */
async function priorOrders(userId: string | null, phone: string | null) {
  if (!userId && !phone) return 0;
  let q = supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).neq('status', 'cancelled');
  q = userId && phone ? q.or(`user_id.eq.${userId},phone.eq.${phone}`) : userId ? q.eq('user_id', userId) : q.eq('phone', phone!);
  const { count } = await q;
  return count || 0;
}

/** Le code est-il utilisable par ce client, maintenant ? (le panier minimum est géré par le calcul) */
export async function checkPromo(promo: PromoRow | null, who: { userId: string | null; phone: string | null }):
  Promise<{ ok: true; benefit: PromoBenefit } | { ok: false; reason: PromoReason }> {
  if (!promo) return { ok: false, reason: 'unknown' };
  if (!promo.active) return { ok: false, reason: 'inactive' };
  const now = Date.now();
  if (promo.starts_at && now < new Date(promo.starts_at).getTime()) return { ok: false, reason: 'not_started' };
  if (promo.ends_at && now > new Date(promo.ends_at).getTime()) return { ok: false, reason: 'expired' };
  // Code personnel : réservé à un compte ; on ne révèle pas son existence aux autres
  if (promo.user_id) {
    if (!who.userId) return { ok: false, reason: 'login_required' };
    if (who.userId !== promo.user_id) return { ok: false, reason: 'unknown' };
  }
  if (promo.first_order_only && await priorOrders(who.userId, who.phone) > 0) return { ok: false, reason: 'first_order_only' };
  if (promo.max_uses != null && await countUses(promo.id) >= promo.max_uses) return { ok: false, reason: 'exhausted' };
  if (promo.max_uses_per_user != null && (who.userId || who.phone) && await countUses(promo.id, who) >= promo.max_uses_per_user) return { ok: false, reason: 'per_user_limit' };
  return { ok: true, benefit: benefitOf(promo) };
}

export const benefitOf = (p: PromoRow): PromoBenefit => ({
  code: p.code, kind: p.kind || 'free_delivery', scope: p.scope, max_discount: p.max_discount, min_subtotal: p.min_subtotal,
  value: p.value, products_scope: p.products_scope || 'all',
});

/** Montant des articles concernés par un code sur les articles : tous, ou produits Hornafresh seulement (hors marchands). */
export async function eligibleSubtotal(items: { product_id: number | string; price: number | string; quantity: number | string }[], scope: 'all' | 'hornafresh', owners?: Record<number, string | null>) {
  const line = (i: { price: number | string; quantity: number | string }) => Math.max(0, Math.round(Number(i.price) || 0)) * Math.max(0, Math.round(Number(i.quantity) || 0));
  if (scope !== 'hornafresh') return items.reduce((s, i) => s + line(i), 0);
  let own = owners;
  if (!own) {
    const ids = [...new Set(items.map(i => Number(i.product_id)))];
    const { data } = await supabaseAdmin.from('products').select('id, owner_id').in('id', ids);
    own = Object.fromEntries((data || []).map((p: { id: number; owner_id: string | null }) => [p.id, p.owner_id]));
  }
  return items.reduce((s, i) => s + (own![Number(i.product_id)] ? 0 : line(i)), 0);
}

/** Code parrainage : existe, n'est pas le sien, et c'est la première commande (compte, ou téléphone pour un invité). */
export async function checkReferral(code: string, who: { userId: string | null; phone: string | null }):
  Promise<{ ok: true } | { ok: false; reason: ReferralReason }> {
  const c = cleanCode(code);
  const { data } = c ? await supabaseAdmin.from('referral_codes').select('user_id').eq('code', c).maybeSingle() : { data: null as any };
  if (!data) return { ok: false, reason: 'unknown' };
  if (who.userId && data.user_id === who.userId) return { ok: false, reason: 'own_code' };
  let q = supabaseAdmin.from('orders').select('id', { count: 'exact', head: true });
  if (who.userId) q = q.eq('user_id', who.userId); else if (who.phone) q = q.eq('phone', who.phone); else return { ok: true };
  const { count } = await q;
  return (count || 0) > 0 ? { ok: false, reason: 'first_order_only' } : { ok: true };
}

export type ServerQuote = {
  quote: DeliveryQuote;
  benefit: PromoBenefit | null;          // code promo utilisable (quel que soit son type)
  items_discount: number;                // remise du code sur les articles (pourcentage / montant)
  option: { id: number; name: string; price: number } | null;
  hasOptions: boolean;                   // des options de livraison sont proposées : en choisir une est obligatoire
  promo: PromoRow | null;
  promoError: PromoReason | null;        // un code promo a été envoyé mais n'est pas utilisable
  referralError: ReferralReason | null;  // idem pour le code parrainage
};

/** Frais de livraison d'une commande, calculés à partir de la base (jamais des montants du navigateur). */
export async function quoteDelivery(input: {
  optionId?: number | null; optionName?: string | null; subtotal: number;
  userId: string | null; phone: string | null;
  promoCode?: string | null; refCode?: string | null; useReferralCredit?: boolean;
  items?: { product_id: number | string; price: number | string; quantity: number | string }[];   // pour un code sur les articles
  owners?: Record<number, string | null>;                                                           // propriétaire (marchand) par produit, si déjà connu
}): Promise<ServerQuote> {
  const [{ data: opts }, rules] = await Promise.all([
    supabaseAdmin.from('delivery_options').select('id, name, price, is_standard').eq('is_active', true),
    deliveryRules(),
  ]);
  const options = opts || [];
  const option = (input.optionId != null ? options.find((o: any) => o.id === Number(input.optionId)) : null)
    || (input.optionName ? options.find((o: any) => o.name === input.optionName) : null) || null;
  const standard = options.find((o: any) => o.is_standard) || null;
  const who = { userId: input.userId, phone: input.phone };

  let promo: PromoRow | null = null, benefit: PromoBenefit | null = null, promoError: PromoReason | null = null;
  let itemsDiscount = 0;
  if (input.promoCode) {
    promo = await findPromo(input.promoCode);
    const c = await checkPromo(promo, who);
    if (c.ok) {
      benefit = c.benefit;
      if (benefit.kind !== 'free_delivery') {
        benefit.eligible_subtotal = await eligibleSubtotal(input.items || [], benefit.products_scope, input.owners);
        itemsDiscount = computePromoItems({ promo: benefit, subtotal: input.subtotal }).discount;
      }
    } else promoError = c.reason;
  }
  let referralCode = false, referralError: ReferralReason | null = null;
  if (input.refCode) {
    const c = await checkReferral(input.refCode, who);
    if (c.ok) referralCode = true; else referralError = c.reason;
  }
  let referralCredit = false;
  if (input.useReferralCredit && input.userId) {
    const { data: rc } = await supabaseAdmin.from('referral_codes').select('credits').eq('user_id', input.userId).maybeSingle();
    referralCredit = Number(rc?.credits) > 0;
  }

  const quote = computeDelivery({
    base: Number(option?.price) || 0, standardPrice: standard ? Number(standard.price) : null,
    subtotal: input.subtotal, rules, promo: benefit, referralCode, referralCredit,
  });
  return { quote, benefit, items_discount: itemsDiscount, option: option ? { id: option.id, name: option.name, price: Number(option.price) } : null, hasOptions: options.length > 0, promo, promoError, referralError };
}

/** Réserve une utilisation du code (atomique). À appeler juste avant de créer la commande. */
export async function reservePromo(promoId: number, who: { userId: string | null; phone: string | null }, amount: number):
  Promise<{ ok: true; redemptionId: number } | { ok: false; reason: PromoReason }> {
  const { data, error } = await supabaseAdmin.rpc('promo_redeem', { p_promo: promoId, p_user: who.userId, p_phone: who.phone, p_amount: Math.round(amount) });
  if (error) { console.error('[promo] redeem:', error.message); return { ok: false, reason: 'unknown' }; }
  const r = Array.isArray(data) ? data[0] : data;
  return r?.ok ? { ok: true, redemptionId: Number(r.redemption_id) } : { ok: false, reason: (r?.reason as PromoReason) || 'unknown' };
}
export const attachPromo = (redemptionId: number, orderId: number) => supabaseAdmin.from('promo_redemptions').update({ order_id: orderId }).eq('id', redemptionId);
export const releasePromo = (redemptionId: number) => supabaseAdmin.from('promo_redemptions').delete().eq('id', redemptionId);

/** Liste admin : chaque code avec son nombre d'utilisations et le montant offert (commandes non annulées). */
export async function promoOverview() {
  const [{ data: codes }, { data: reds }, rules] = await Promise.all([
    supabaseAdmin.from('promo_codes').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('promo_redemptions').select('promo_id, amount, order_id, orders ( status )'),
    deliveryRules(),
  ]);
  const stats: Record<number, { uses: number; amount: number }> = {};
  for (const r of (reds || []) as any[]) {
    if (!r.order_id || !r.orders || r.orders.status === 'cancelled') continue;
    const s = (stats[r.promo_id] ||= { uses: 0, amount: 0 });
    s.uses++; s.amount += Number(r.amount) || 0;
  }
  // E-mail des clients des codes personnels (pour l'affichage)
  const emails: Record<string, string> = {};
  for (const id of [...new Set((codes || []).map((c: any) => c.user_id).filter(Boolean))] as string[]) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(id);
    if (data?.user?.email) emails[id] = data.user.email;
  }
  return {
    rules,
    codes: (codes || []).map((c: any) => ({ ...c, uses: stats[c.id]?.uses || 0, amount_offered: stats[c.id]?.amount || 0, user_email: c.user_id ? emails[c.user_id] || null : null })),
  };
}
