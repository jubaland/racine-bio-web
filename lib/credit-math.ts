// Crédit client — types et calculs purs (aucun accès à la base), partagés par le serveur, les écrans et les tests.

export type CreditTerm = 'month_end' | 'days';
export type CreditAccount = {
  id: number; holder_type: 'user' | 'company'; user_id: string | null; company_id: number | null;
  credit_limit: number; term: CreditTerm; term_days: number | null; status: 'active' | 'suspended';
  auto_suspended: boolean; suspended_at: string | null; suspended_reason: string | null; note: string | null; created_at: string;
};
export type CreditEntry = {
  id: number; account_id: number; type: 'charge' | 'payment' | 'refund' | 'adjustment'; amount: number;
  order_id: number | null; due_at: string | null; paid_amount: number; method: string | null; note: string | null; created_at: string;
};
export type CreditSettings = {
  enabled: boolean; remind_before_days: number; overdue_remind_days: number; suspend_after_days: number;
  default_limit: number | null; default_term: CreditTerm; default_term_days: number;
};
export const CREDIT_DEFAULTS: CreditSettings = { enabled: true, remind_before_days: 3, overdue_remind_days: 7, suspend_after_days: 15, default_limit: null, default_term: 'month_end', default_term_days: 30 };

export type OpenCharge = { id: number; order_id: number | null; created_at: string; due_at: string; amount: number; paid_amount: number; remaining: number };
export type CreditSummary = {
  account: CreditAccount;
  outstanding: number;            // dû = charges − paiements (négatif : avoir)
  overdue: number;                // part du dû dont la date limite est dépassée
  overdue_since: string | null;   // plus ancienne échéance dépassée
  available: number;              // plafond − dû
  next_due: string | null;        // prochaine échéance (charges non réglées)
  next_due_amount: number;        // montant dû à cette échéance (charges dues jusqu'à cette date)
  open: OpenCharge[];
  usable: boolean;                // peut commander à crédit aujourd'hui (actif, pas de retard)
};

export const fdj = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} Fdj`;
export const todayStr = (d = new Date()) => d.toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86400000);
export const dateFr = (day: string) => new Date(day + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Date limite d'une commande passée le jour `day` : dernier jour du mois, ou N jours plus tard. */
export function dueDateFor(term: CreditTerm, termDays: number | null, day: string): string {
  if (term === 'days') return addDays(day, Math.max(1, termDays || CREDIT_DEFAULTS.default_term_days));
  const d = new Date(day + 'T00:00:00Z');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

/** Encours, retard, disponible et prochaine échéance d'un compte, à partir de ses écritures. */
export function summarize(account: Pick<CreditAccount, 'credit_limit' | 'status'> & Partial<CreditAccount>, entries: CreditEntry[], day = todayStr(), enabled = true): CreditSummary {
  const charges = entries.filter(e => e.type === 'charge');
  const paid = entries.filter(e => e.type === 'payment').reduce((s, e) => s + e.amount, 0);
  const outstanding = charges.reduce((s, e) => s + e.amount, 0) - paid;
  const open: OpenCharge[] = charges.filter(e => e.amount > e.paid_amount)
    .map(e => ({ id: e.id, order_id: e.order_id, created_at: e.created_at, due_at: e.due_at || e.created_at.slice(0, 10), amount: e.amount, paid_amount: e.paid_amount, remaining: e.amount - e.paid_amount }))
    .sort((a, b) => a.due_at.localeCompare(b.due_at) || a.created_at.localeCompare(b.created_at));
  const late = open.filter(c => c.due_at < day);
  const overdue = late.reduce((s, c) => s + c.remaining, 0);
  const upcoming = open.filter(c => c.due_at >= day);
  const next_due = upcoming.length ? upcoming[0].due_at : null;
  const next_due_amount = next_due ? open.filter(c => c.due_at <= next_due).reduce((s, c) => s + c.remaining, 0) : 0;
  return {
    account: account as CreditAccount, outstanding, overdue, overdue_since: late.length ? late[0].due_at : null,
    available: Math.max(0, account.credit_limit - outstanding), next_due, next_due_amount, open,
    usable: enabled && account.status === 'active' && overdue === 0,
  };
}
