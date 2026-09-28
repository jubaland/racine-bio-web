import { supabaseAdmin } from './supabase-admin';

// ── Fidélité : carte à tampons ──────────────────────────────────────────────
// Une commande LIVRÉE d'un particulier = un tampon ; N tampons = un crédit sur la cagnotte.
// Réglages dans app_settings (admin › Fidélité). Attribution atomique en base (loyalty_award).

export type LoyaltySettings = { enabled: boolean; orders_required: number; reward_amount: number; min_order: number };
export const LOYALTY_DEFAULTS: LoyaltySettings = { enabled: true, orders_required: 10, reward_amount: 1000, min_order: 1000 };
const KEYS = ['loyalty.enabled', 'loyalty.orders_required', 'loyalty.reward_amount', 'loyalty.min_order'];
const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;

export async function loyaltySettings(): Promise<LoyaltySettings> {
  const { data } = await supabaseAdmin.from('app_settings').select('key, value_num').in('key', KEYS);
  const v: Record<string, number> = Object.fromEntries((data || []).filter((r: any) => r.value_num != null).map((r: any) => [r.key, Number(r.value_num)]));
  return {
    enabled: (v['loyalty.enabled'] ?? 1) === 1,
    orders_required: Math.max(1, Math.round(v['loyalty.orders_required'] ?? LOYALTY_DEFAULTS.orders_required)),
    reward_amount: Math.max(0, Math.round(v['loyalty.reward_amount'] ?? LOYALTY_DEFAULTS.reward_amount)),
    min_order: Math.max(0, Math.round(v['loyalty.min_order'] ?? LOYALTY_DEFAULTS.min_order)),
  };
}

/** Enregistre les réglages (valeurs déjà validées par l'appelant). */
export async function saveLoyaltySettings(s: Partial<LoyaltySettings>) {
  const rows: { key: string; value_num: number; updated_at: string }[] = [];
  const now = new Date().toISOString();
  if (s.enabled != null) rows.push({ key: 'loyalty.enabled', value_num: s.enabled ? 1 : 0, updated_at: now });
  if (s.orders_required != null) rows.push({ key: 'loyalty.orders_required', value_num: s.orders_required, updated_at: now });
  if (s.reward_amount != null) rows.push({ key: 'loyalty.reward_amount', value_num: s.reward_amount, updated_at: now });
  if (s.min_order != null) rows.push({ key: 'loyalty.min_order', value_num: s.min_order, updated_at: now });
  if (rows.length) await supabaseAdmin.from('app_settings').upsert(rows, { onConflict: 'key' });
}

/** Carte du client : tampons en cours, récompenses déjà gagnées. */
export async function loyaltyCard(userId: string) {
  const [s, { count }, { data: rewards }] = await Promise.all([
    loyaltySettings(),
    supabaseAdmin.from('loyalty_stamps').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('reward_id', null),
    supabaseAdmin.from('loyalty_rewards').select('id, amount, stamps_used, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
  ]);
  const stamps = Math.min(count || 0, s.orders_required);
  return { ...s, stamps, remaining: Math.max(0, s.orders_required - stamps), rewards: rewards || [], total_rewarded: (rewards || []).reduce((a: number, r: any) => a + Number(r.amount), 0) };
}

/**
 * À appeler quand une commande passe à « livrée ». Pose le tampon si la commande y a droit et
 * verse la récompense quand le compte est atteint. Ne lève jamais d'erreur (la livraison prime).
 */
export async function onOrderDelivered(orderId: number | string) {
  try {
    const s = await loyaltySettings();
    if (!s.enabled) return { skipped: 'disabled' };
    const { data: o } = await supabaseAdmin.from('orders').select('id, user_id, company_id, status, total, delivery_fee').eq('id', orderId).maybeSingle();
    if (!o || o.status !== 'delivered') return { skipped: 'not_delivered' };
    if (!o.user_id) return { skipped: 'guest' };
    if (o.company_id) return { skipped: 'company' };                         // comptes entreprise exclus
    const goods = (Number(o.total) || 0) - (Number(o.delivery_fee) || 0);    // montant des articles, hors livraison
    if (goods < s.min_order) return { skipped: 'below_min' };

    const { data, error } = await supabaseAdmin.rpc('loyalty_award', { p_user: o.user_id, p_order: o.id, p_required: s.orders_required, p_amount: s.reward_amount });
    if (error) { console.error('[loyalty] award:', error.message); return { error: error.message }; }
    const r = data as any;
    if (!r?.stamped) return { skipped: 'already_or_same_day', ...r };

    const { notifyUser } = await import('./notify');
    if (r.rewarded) {
      await notifyUser(o.user_id, { title: `🎁 Récompense fidélité : +${fdj(r.amount)}`, body: `Merci pour vos ${s.orders_required} commandes ! ${fdj(r.amount)} ont été crédités sur votre cagnotte. Une nouvelle carte commence.`, url: '/profile' });
    } else {
      const left = Math.max(0, s.orders_required - Number(r.open));
      await notifyUser(o.user_id, {
        title: left === 1 ? '⭐ Plus qu\'une commande avant votre récompense' : `⭐ Tampon fidélité ${r.open}/${s.orders_required}`,
        body: left === 1 ? `Encore une commande livrée et ${fdj(s.reward_amount)} seront crédités sur votre cagnotte.` : `Encore ${left} commandes livrées avant ${fdj(s.reward_amount)} sur votre cagnotte.`,
        url: '/profile',
      });
    }
    return r;
  } catch (e: any) { console.error('[loyalty] onOrderDelivered:', e); return { error: e?.message }; }
}

/** Commande annulée : le tampon est retiré s'il n'a pas déjà servi à une récompense. */
export async function onOrderCancelled(orderId: number | string) {
  try { await supabaseAdmin.from('loyalty_stamps').delete().eq('order_id', orderId).is('reward_id', null); }
  catch (e) { console.error('[loyalty] onOrderCancelled:', e); }
}

/** Indicateurs pour l'admin. */
export async function loyaltyStats() {
  const [s, { data: open }, { data: rewards }] = await Promise.all([
    loyaltySettings(),
    supabaseAdmin.from('loyalty_stamps').select('user_id').is('reward_id', null),
    supabaseAdmin.from('loyalty_rewards').select('id, user_id, amount, stamps_used, created_at').order('created_at', { ascending: false }).limit(200),
  ]);
  const perUser: Record<string, number> = {};
  for (const r of open || []) perUser[r.user_id] = (perUser[r.user_id] || 0) + 1;
  const counts = Object.values(perUser);
  return {
    settings: s,
    cards_in_progress: counts.length,
    stamps_open: counts.reduce((a, b) => a + b, 0),
    near_reward: counts.filter(c => c >= s.orders_required - 2).length,   // à 2 commandes ou moins de la récompense
    rewards_count: (rewards || []).length,
    rewards_total: (rewards || []).reduce((a: number, r: any) => a + Number(r.amount), 0),
    rewards: rewards || [],
  };
}
