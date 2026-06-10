import { supabaseAdmin } from './supabase-admin';
import { sendPushToUser, sendPushToAll } from './push';

type Payload = { title: string; body?: string | null; url?: string | null };

// Notifie UN utilisateur : enregistre dans son centre de notifications + push PWA.
// Réutilisable pour les confirmations de commande, crédits cagnotte, etc.
export async function notifyUser(userId: string, payload: Payload) {
  const { error } = await supabaseAdmin.from('user_notifications').insert({
    user_id: userId,
    title: payload.title,
    body: payload.body ?? null,
    url: payload.url ?? null,
  });
  if (error) console.error('[notify] insert user_notifications error:', error.message);

  await sendPushToUser(userId, { title: payload.title, body: payload.body || '', url: payload.url || '/' });
}

// Notifie TOUS les utilisateurs : une ligne dans le centre de chacun + push PWA à tous.
export async function notifyAllUsers(payload: Payload) {
  // 1) Récupère tous les ids utilisateurs (pagination)
  const ids: string[] = [];
  let page = 1;
  // garde-fou : 50 pages × 1000 = 50 000 utilisateurs max
  while (page <= 50) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) { console.error('[notify] listUsers error:', error.message); break; }
    const users = data?.users || [];
    ids.push(...users.map(u => u.id));
    if (users.length < 1000) break;
    page++;
  }

  // 2) Insère une notification par utilisateur (par lots de 500)
  if (ids.length) {
    const rows = ids.map(id => ({
      user_id: id,
      title: payload.title,
      body: payload.body ?? null,
      url: payload.url ?? null,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabaseAdmin.from('user_notifications').insert(rows.slice(i, i + 500));
      if (error) console.error('[notify] bulk insert error:', error.message);
    }
  }

  // 3) Push PWA à tous les abonnés
  const res = await sendPushToAll({ title: payload.title, body: payload.body || '', url: payload.url || '/' });
  return { recipients: ids.length, sent: res.sent, total: res.total };
}
