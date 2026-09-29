import { supabaseAdmin } from './supabase-admin';

// ── Comptes entreprise (prépayés) — socle serveur ───────────────────────────
// Appartenance, rôles, cagnotte société, réglages. Toutes les écritures passent par ici
// (service role) ; les pages lisent via /api/company/*.

export type CompanyRole = 'manager' | 'buyer' | 'accountant';
export type Membership = { company_id: number; role: CompanyRole; company: any };

export const ROLE_LABEL: Record<CompanyRole, string> = { manager: 'Gérant', buyer: 'Acheteur', accountant: 'Comptable' };
export const DEFAULT_MIN_TOPUP = 5000;

/** Utilisateur authentifié par son jeton (Bearer), ou null. */
export async function userFromRequest(request: Request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return error ? null : data.user;
}

/** Société de l'utilisateur (une seule en v1) avec son rôle, ou null. */
export async function membershipOf(userId: string): Promise<Membership | null> {
  const { data } = await supabaseAdmin.from('company_members').select('company_id, role, companies(*)').eq('user_id', userId).maybeSingle();
  if (!data) return null;
  return { company_id: data.company_id, role: data.role as CompanyRole, company: (data as any).companies };
}

type Guard = { ok: true; user: any; membership: Membership } | { ok: false; status: number; error: string };

/** Garde d'API : utilisateur connecté, membre d'une société ACTIVE, avec l'un des rôles demandés. */
export async function requireCompany(request: Request, roles: CompanyRole[] = ['manager', 'buyer', 'accountant'], opts: { allowInactive?: boolean } = {}): Promise<Guard> {
  const user = await userFromRequest(request);
  if (!user) return { ok: false, status: 401, error: 'unauthorized' };
  const membership = await membershipOf(user.id);
  if (!membership) return { ok: false, status: 403, error: 'no_company' };
  if (!opts.allowInactive && membership.company?.status !== 'active') return { ok: false, status: 403, error: 'company_inactive' };
  if (!roles.includes(membership.role)) return { ok: false, status: 403, error: 'forbidden_role' };
  return { ok: true, user, membership };
}

export async function companyBalance(companyId: number): Promise<number> {
  const { data } = await supabaseAdmin.from('company_wallets').select('balance').eq('company_id', companyId).maybeSingle();
  return Number(data?.balance) || 0;
}

/** Mouvement de cagnotte société (atomique). Un débit au-delà du solde renvoie { ok:false, error:'insufficient' }. */
export async function adjustCompanyWallet(companyId: number, amount: number, type: 'deposit' | 'debit' | 'refund' | 'adjustment',
  opts: { orderId?: number | null; userId?: string | null; note?: string | null } = {}): Promise<{ ok: boolean; balance?: number; error?: string }> {
  const { data, error } = await supabaseAdmin.rpc('company_wallet_adjust', {
    p_company: companyId, p_amount: amount, p_type: type, p_order: opts.orderId ?? null, p_user: opts.userId ?? null, p_note: opts.note ?? null,
  });
  if (error) return { ok: false, error: /insufficient/.test(error.message) ? 'insufficient' : error.message };
  return { ok: true, balance: Number(data) };
}

/** Recharge minimale applicable : celle de la société si définie, sinon le réglage global. */
export async function minTopupFor(company: { min_topup?: number | null } | null): Promise<number> {
  if (company?.min_topup != null) return Number(company.min_topup);
  return globalMinTopup();
}
export async function globalMinTopup(): Promise<number> {
  const { data } = await supabaseAdmin.from('app_settings').select('value_num').eq('key', 'company.min_topup').maybeSingle();
  return data?.value_num != null ? Number(data.value_num) : DEFAULT_MIN_TOPUP;
}

/** Identifiants des membres d'une société ayant l'un des rôles (notifications). */
export async function memberIds(companyId: number, roles: CompanyRole[] = ['manager']): Promise<string[]> {
  const { data } = await supabaseAdmin.from('company_members').select('user_id, role').eq('company_id', companyId).in('role', roles);
  return (data || []).map((m: any) => m.user_id);
}

/** Notifie (cloche + push) les membres d'une société ayant l'un des rôles. */
// i18n : modèle traduit (srv.c.*) — chaque membre reçoit le message dans la langue de son compte
export async function notifyCompany(companyId: number, roles: CompanyRole[], payload: { title: string; body?: string; url?: string; i18n?: { key: string; params?: Record<string, any> } }) {
  const { notifyUser } = await import('./notify');
  for (const id of await memberIds(companyId, roles)) {
    try { await notifyUser(id, { url: '/entreprise', ...payload }); } catch (e) { console.error('[company] notify:', e); }
  }
}

export const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;
