import { supabaseAdmin } from './supabase-admin';

// ── Formule d'un marchand : abonnement ou commission ─────────────────────────
// Source unique pour : l'état d'un marchand (actif, en attente, suspendu, expiré), sa formule,
// son taux de commission, et le taux à photographier sur une ligne de commande.
// Aucun chiffre ici. Réglages (admin › Marchands › Plans) :
//   app_settings.merchant.commission_enabled / merchant.commission_rate  → formule et taux généraux
//   merchant_formulas.commission_rate                                    → taux particulier d'un marchand
//   merchant_plans                                                       → plans d'abonnement (prix, durée)

export * from './merchant-state';
import { today, effectiveRate } from './merchant-state';
import type { Formula, CommissionSettings } from './merchant-state';

/** Réglages de la formule commission. `rate` est null tant qu'aucun taux n'a été défini dans l'admin. */
export async function commissionSettings(): Promise<CommissionSettings> {
  const { data } = await supabaseAdmin.from('app_settings').select('key, value_num').in('key', ['merchant.commission_enabled', 'merchant.commission_rate']);
  const v: Record<string, number | null> = Object.fromEntries((data || []).map((r: any) => [r.key, r.value_num != null ? Number(r.value_num) : null]));
  const rate = v['merchant.commission_rate'] ?? null;
  return { enabled: v['merchant.commission_enabled'] === 1 && rate != null, rate };
}

export async function saveCommissionSettings(s: { enabled?: boolean; rate?: number }) {
  const now = new Date().toISOString();
  const rows: any[] = [];
  if (s.enabled != null) rows.push({ key: 'merchant.commission_enabled', value_num: s.enabled ? 1 : 0, updated_at: now });
  if (s.rate != null) rows.push({ key: 'merchant.commission_rate', value_num: s.rate, updated_at: now });
  if (rows.length) await supabaseAdmin.from('app_settings').upsert(rows, { onConflict: 'key' });
}

/** Formules de plusieurs marchands. */
export async function formulasOf(ownerIds: string[]): Promise<Record<string, Formula>> {
  const ids = [...new Set(ownerIds.filter(Boolean))];
  if (!ids.length) return {};
  const { data } = await supabaseAdmin.from('merchant_formulas').select('*').in('user_id', ids);
  return Object.fromEntries((data || []).map((f: any) => [f.user_id, { ...f, commission_rate: f.commission_rate != null ? Number(f.commission_rate) : null }]));
}

/**
 * Pour chaque marchand : est-il commandable aujourd'hui, et à quel taux de commission ?
 * (abonnement payé en cours → 0 % ; formule commission active → taux effectif).
 */
export async function merchantTerms(ownerIds: string[]): Promise<Record<string, { active: boolean; rate: number }>> {
  const ids = [...new Set(ownerIds.filter(Boolean))];
  const out: Record<string, { active: boolean; rate: number }> = {};
  if (!ids.length) return out;
  const [{ data: subs }, forms, settings] = await Promise.all([
    supabaseAdmin.from('merchant_subscriptions').select('user_id').in('user_id', ids).eq('status', 'active').gte('ends_at', today()),
    formulasOf(ids),
    commissionSettings(),
  ]);
  const paid = new Set((subs || []).map((s: any) => s.user_id));
  for (const id of ids) {
    const f = forms[id];
    if (paid.has(id)) out[id] = { active: true, rate: 0 };
    else if (f?.kind === 'commission' && f.status === 'active') out[id] = { active: true, rate: effectiveRate(f, settings.rate) };
    else out[id] = { active: false, rate: 0 };
  }
  return out;
}

/** Taux à photographier sur les lignes de commande : { product_id → taux | null } (null = pas de commission). */
export async function commissionRatesForProducts(products: { id: number; owner_id?: string | null }[]): Promise<Record<number, number | null>> {
  const terms = await merchantTerms(products.map(p => p.owner_id || '').filter(Boolean));
  return Object.fromEntries(products.map(p => [p.id, p.owner_id && terms[p.owner_id]?.rate > 0 ? terms[p.owner_id].rate : null]));
}

/**
 * Passe un marchand à la formule commission (immédiat). Renvoie le taux appliqué.
 * Échoue si la formule n'est pas proposée ou si aucun taux n'est défini dans l'admin.
 * `force` : décision de l'admin, même si la formule n'est plus proposée aux nouveaux marchands.
 */
export async function switchToCommission(userId: string, opts: { note?: string | null; force?: boolean } = {}) {
  const settings = await commissionSettings();
  if (settings.rate == null || (!settings.enabled && !opts.force)) return { ok: false as const, error: 'commission_unavailable' };
  const { data: existing } = await supabaseAdmin.from('merchant_formulas').select('commission_rate').eq('user_id', userId).maybeSingle();
  const { error } = await supabaseAdmin.from('merchant_formulas').upsert({
    user_id: userId, kind: 'commission', status: 'active', pending_kind: null,
    commission_rate: existing?.commission_rate ?? null, since: today(), note: opts.note ?? null, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rate: Number(existing?.commission_rate ?? settings.rate) || 0 };
}

/** Retour à la formule abonnement (posé à l'activation d'une période payée). Le taux particulier est conservé. */
export async function switchToSubscription(userId: string) {
  const { data: existing } = await supabaseAdmin.from('merchant_formulas').select('user_id').eq('user_id', userId).maybeSingle();
  if (!existing) return;
  await supabaseAdmin.from('merchant_formulas').update({ kind: 'subscription', status: 'active', pending_kind: null, since: today(), updated_at: new Date().toISOString() }).eq('user_id', userId);
}

// ── Délais de l'abonnement marchand (admin › Marchands › Plans) ──────────────
// Aucun chiffre ici : un réglage non défini (null) désactive la fonction correspondante.
//   merchant.reminder_first_days  → premier rappel avant l'échéance (jours)
//   merchant.reminder_last_days   → dernier rappel avant l'échéance (jours)
//   merchant.stale_payment_days   → alerte admin si un paiement déclaré attend depuis ce nombre de jours
//   merchant.extend_days          → durée du bouton de prolongation rapide (jours)
export const MERCHANT_DELAY_KEYS = ['reminder_first_days', 'reminder_last_days', 'stale_payment_days', 'extend_days'] as const;
export type MerchantDelayKey = typeof MERCHANT_DELAY_KEYS[number];
export type MerchantDelays = Record<MerchantDelayKey, number | null>;
export const MERCHANT_DELAY_MAX = 365;

export async function merchantDelays(): Promise<MerchantDelays> {
  const { data } = await supabaseAdmin.from('app_settings').select('key, value_num').in('key', MERCHANT_DELAY_KEYS.map(k => `merchant.${k}`));
  const v: Record<string, number | null> = Object.fromEntries((data || []).map((r: any) => [r.key, r.value_num != null ? Number(r.value_num) : null]));
  return Object.fromEntries(MERCHANT_DELAY_KEYS.map(k => [k, v[`merchant.${k}`] ?? null])) as MerchantDelays;
}

/** Enregistre les délais fournis ; `null` retire le réglage (fonction désactivée). */
export async function saveMerchantDelays(patch: Partial<MerchantDelays>) {
  const now = new Date().toISOString();
  const rows = MERCHANT_DELAY_KEYS.filter(k => k in patch).map(k => ({ key: `merchant.${k}`, value_num: patch[k] ?? null, updated_at: now }));
  if (rows.length) await supabaseAdmin.from('app_settings').upsert(rows, { onConflict: 'key' });
}
