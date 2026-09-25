import { supabaseAdmin } from './supabase-admin';
import { roleOf } from './permissions';

// Authentification d'un marchand pour les routes /api/producer/* :
// jeton Bearer + rôle `producer` (ou adhésion approuvée — ancien flux).
export type MerchantAuth = { ok: true; user: any } | { ok: false; status: number; error: string };

export async function requireMerchant(request: Request): Promise<MerchantAuth> {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!token) return { ok: false, status: 401, error: 'Non authentifié' };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401, error: 'Token invalide' };
  if (roleOf(user.user_metadata) !== 'producer') {
    const { data: req } = await supabaseAdmin.from('producer_requests').select('id').eq('email', user.email).eq('status', 'approved').maybeSingle();
    if (!req) return { ok: false, status: 403, error: 'Réservé aux marchands' };
  }
  return { ok: true, user };
}
