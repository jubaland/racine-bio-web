import { createHmac, timingSafeEqual } from 'node:crypto';

// ── Lien de désabonnement des annonces par e-mail ────────────────────────────
// Le lien porte l'identifiant du client et une signature : il ne peut être ni deviné ni forgé.
// Aucune donnée stockée : la signature se recalcule à partir d'un secret du serveur.
const secret = () => process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const sign = (userId: string) => createHmac('sha256', secret()).update(`unsubscribe:${userId}`).digest('base64url').slice(0, 24);

export const unsubscribeToken = (userId: string) => `${Buffer.from(userId).toString('base64url')}.${sign(userId)}`;
export const unsubscribeUrl = (userId: string, lang?: string | null) => `https://www.hornafresh.com/api/unsubscribe?t=${unsubscribeToken(userId)}${lang && lang !== 'fr' ? `&lang=${lang}` : ''}`;

/** Identifiant du client si le jeton est valide, sinon null. */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token || !secret()) return null;
  const [id64, sig] = String(token).split('.');
  if (!id64 || !sig) return null;
  let userId = '';
  try { userId = Buffer.from(id64, 'base64url').toString('utf8'); } catch { return null; }
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const expected = sign(userId);
  if (expected.length !== sig.length) return null;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig)) ? userId : null;
}
