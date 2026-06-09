import { supabaseAdmin } from './supabase-admin';
import { hasPerm } from './permissions';

type PermResult =
  | { ok: true; user: any }
  | { ok: false; status: number; error: string };

// Vérifie le JWT de l'appelant et qu'il possède le droit `action` sur l'un des
// `modules` fournis (admin = tous les droits). À utiliser au début des routes admin.
export async function requirePerm(
  request: Request,
  modules: string | string[],
  action: string = 'view',
): Promise<PermResult> {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!token) return { ok: false, status: 401, error: 'Non authentifié' };

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401, error: 'Token invalide' };

  const mods = Array.isArray(modules) ? modules : [modules];
  const allowed = mods.some(m => hasPerm(user.user_metadata, m, action));
  if (!allowed) return { ok: false, status: 403, error: 'Accès refusé' };

  return { ok: true, user };
}
