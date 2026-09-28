// ── Formule d'un marchand : règles pures (utilisables côté client comme côté serveur) ──
// Aucun accès base ici : voir lib/merchant-formula.ts pour les lectures et écritures.

export type FormulaKind = 'subscription' | 'commission';
export type MerchantState = 'active' | 'pending' | 'suspended' | 'expired' | 'none';
export type Formula = { user_id: string; kind: FormulaKind; commission_rate: number | null; status: 'active' | 'suspended'; pending_kind: FormulaKind | null; since: string; note: string | null };
export type CommissionSettings = { enabled: boolean; rate: number | null };

export const today = () => new Date().toISOString().slice(0, 10);

/** Commission d'une ligne, en Fdj entiers (arrondi au plus proche). */
export const commissionOf = (gross: number, rate: number | null | undefined) => Math.round((Number(gross) || 0) * (Number(rate) || 0) / 100);

/** Taux effectif d'une formule : taux particulier du marchand, sinon taux général. */
export function effectiveRate(f: Pick<Formula, 'kind' | 'commission_rate'> | null | undefined, generalRate: number | null | undefined): number {
  if (!f || f.kind !== 'commission') return 0;
  return Number(f.commission_rate ?? generalRate ?? 0) || 0;
}

/**
 * État d'un marchand à partir de ses abonnements et de sa formule (même règle partout : admin,
 * espace marchand, commande, récapitulatif). `expired` seulement après une vraie période active.
 */
export function merchantState(subs: any[], formula: Pick<Formula, 'kind' | 'status'> | null, t = today()) {
  const list = subs || [];
  const active = list.find(s => s.status === 'active' && s.ends_at >= t) || null;
  const pending = list.find(s => s.status === 'pending_payment') || null;
  const last = list[0] || null;
  const hadPeriod = list.some(s => s.status === 'active' || s.status === 'expired');
  const onCommission = formula?.kind === 'commission';
  let state: MerchantState;
  if (active) state = 'active';
  else if (onCommission) state = formula!.status === 'active' ? 'active' : 'suspended';
  else state = pending ? 'pending' : last?.status === 'suspended' ? 'suspended' : hadPeriod ? 'expired' : 'none';
  const days_left = active ? Math.ceil((new Date(active.ends_at + 'T00:00:00Z').getTime() - new Date(t + 'T00:00:00Z').getTime()) / 86400000) : null;
  // Formule en vigueur : un abonnement payé en cours prime (0 % de commission jusqu'à son échéance)
  const kind: FormulaKind = active ? 'subscription' : onCommission ? 'commission' : 'subscription';
  return { state, active, pending, last, days_left, kind };
}
