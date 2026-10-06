import { createHash } from 'node:crypto';
import { supabaseAdmin } from './supabase-admin';

// Anti-rafale : limite d'essais par adresse sur les points sensibles — vérification de codes
// (promo / parrainage) et création de commandes par des visiteurs sans compte. Compteur à fenêtre
// fixe en base (atomique entre les fonctions serverless). L'adresse n'est jamais stockée : seule
// une empreinte entre dans la clé. Réglages : admin › Surveillance (vide = désactivé).
//   limitCodeChecks(request)  → essais de codes, fenêtre de 15 minutes
//   limitGuestOrders(request) → commandes invité, fenêtre d'une heure
// En cas de doute (réglage absent, erreur technique), on laisse passer : l'anti-rafale ne doit
// jamais bloquer une vente légitime.

export type RateResult = { allowed: true } | { allowed: false; retryAfter: number };

/** Adresse de l'appelant : en-têtes posés par la plateforme (Vercel), repli local. */
export function ipOf(request: Request): string {
  return request.headers.get('x-real-ip')
    || (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || 'local';
}
const fingerprint = (ip: string) => createHash('sha256').update(ip).digest('hex').slice(0, 16);

async function hit(scope: string, ip: string, limit: number | null, windowSecs: number): Promise<RateResult> {
  if (limit == null || limit <= 0) return { allowed: true };   // protection désactivée
  try {
    const { data, error } = await supabaseAdmin.rpc('rate_hit', { p_key: `${scope}:${fingerprint(ip)}`, p_limit: limit, p_window_secs: windowSecs });
    if (error) { console.error('[rate-limit]', error.message); return { allowed: true }; }
    const r = Array.isArray(data) ? data[0] : data;
    return r?.allowed === false ? { allowed: false, retryAfter: Number(r.retry_after) || windowSecs } : { allowed: true };
  } catch (e) { console.error('[rate-limit]', e); return { allowed: true }; }
}

async function setting(key: string): Promise<number | null> {
  const { data } = await supabaseAdmin.from('app_settings').select('value_num').eq('key', key).maybeSingle();
  return data?.value_num != null ? Number(data.value_num) : null;
}

/** Essais de codes (promo + parrainage, budget commun) : N par adresse et par 15 minutes. */
export async function limitCodeChecks(request: Request): Promise<RateResult> {
  return hit('code', ipOf(request), await setting('monitor.code_attempts_15min'), 15 * 60);
}
/** Commandes de visiteurs sans compte : N par adresse et par heure. */
export async function limitGuestOrders(request: Request): Promise<RateResult> {
  return hit('guest-order', ipOf(request), await setting('monitor.guest_orders_hour'), 60 * 60);
}

/** Purge des compteurs expirés (appelée par la tâche quotidienne). */
export async function purgeRateLimits() {
  await supabaseAdmin.from('rate_limits').delete().lt('window_start', new Date(Date.now() - 86400000).toISOString());
}
