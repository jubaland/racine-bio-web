import { supabaseAdmin } from './supabase-admin';
import { sendPushToUser, sendPushToAll } from './push';
import { langOfUser, langsOfUsers, localize, cleanLang, type I18n, type Lang, type Text } from './i18n-server';

// title / body : texte français (toujours fourni). i18n : modèle traduit (srv.<clé>.title / .body dans
// ui_translations) utilisé si le client a choisi une autre langue ; sans modèle, le français est envoyé.
type Payload = { title: string; body?: string | null; url?: string | null; i18n?: I18n | null };

// Notifie UN utilisateur : enregistre dans son centre de notifications + push PWA.
// Réutilisable pour les confirmations de commande, crédits cagnotte, etc.
export async function notifyUser(userId: string, payload: Payload) {
  const fr: Text = { title: payload.title, body: payload.body ?? null };
  const userLang = payload.i18n ? await langOfUser(userId) : 'fr';
  const mine = await localize(payload.i18n, userLang, fr);

  const { error } = await supabaseAdmin.from('user_notifications').insert({
    user_id: userId,
    title: mine.title,
    body: mine.body ?? null,
    url: payload.url ?? null,
  });
  if (error) console.error('[notify] insert user_notifications error:', error.message);

  // Push : langue de chaque appareil, sinon celle du compte
  const i18n = payload.i18n;
  await sendPushToUser(userId, { title: fr.title, body: fr.body || '', url: payload.url || '/' },
    i18n ? async (deviceLang) => { const t = await localize(i18n, deviceLang || userLang, fr); return { title: t.title, body: t.body || '' }; } : undefined);
}

/**
 * Notifie TOUS les utilisateurs : une ligne dans le centre de chacun + push PWA à tous.
 * `translations` (facultatif) : { en: { title, body }, … } saisi par l'admin pour une annonce ;
 * chaque client reçoit la version de sa langue, le français à défaut.
 */
export async function notifyAllUsers(payload: Payload, translations?: Record<string, { title?: string; body?: string | null }> | null) {
  const pick = (lang: Lang | null | undefined): Text => {
    const t = lang ? translations?.[lang] : null;
    return t?.title?.trim() ? { title: t.title.trim(), body: t.body?.trim() || null } : { title: payload.title, body: payload.body ?? null };
  };

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

  // 2) Insère une notification par utilisateur, dans sa langue (par lots de 500)
  const hasTr = !!translations && Object.keys(translations).length > 0;
  const langs = hasTr ? await langsOfUsers(ids) : {};
  if (ids.length) {
    const rows = ids.map(id => {
      const t = pick(langs[id]);
      return { user_id: id, title: t.title, body: t.body ?? null, url: payload.url ?? null };
    });
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabaseAdmin.from('user_notifications').insert(rows.slice(i, i + 500));
      if (error) console.error('[notify] bulk insert error:', error.message);
    }
  }

  // 3) Push PWA à tous les abonnés (langue de l'appareil, sinon du compte)
  const res = await sendPushToAll({ title: payload.title, body: payload.body || '', url: payload.url || '/' },
    hasTr ? (deviceLang, userId) => { const t = pick(cleanLang(deviceLang) || (userId ? langs[userId] : null)); return { title: t.title, body: t.body || '' }; } : undefined);
  return { recipients: ids.length, sent: res.sent, total: res.total, translated: res.translated };
}

/**
 * Aperçu d'une annonce sans rien envoyer : texte retenu par langue et nombre de comptes et
 * d'appareils concernés (une langue sans traduction saisie reçoit le français).
 */
export async function previewAllUsers(payload: Payload, translations?: Record<string, { title?: string; body?: string | null }> | null) {
  const ids: string[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    ids.push(...(data?.users || []).map(u => u.id));
    if ((data?.users || []).length < 1000) break;
  }
  const langs = await langsOfUsers(ids);
  const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('lang, user_id');
  const accounts: Record<string, number> = {}, devices: Record<string, number> = {};
  for (const id of ids) { const l = langs[id] || 'fr'; accounts[l] = (accounts[l] || 0) + 1; }
  for (const d of subs || []) { const l = cleanLang(d.lang) || (d.user_id ? langs[d.user_id] : null) || 'fr'; devices[l] = (devices[l] || 0) + 1; }
  const texts: Record<string, Text & { translated: boolean }> = {};
  for (const l of new Set(['fr', ...Object.keys(accounts), ...Object.keys(devices)])) {
    const t = l === 'fr' ? null : translations?.[l];
    const ok = !!t?.title?.trim();
    texts[l] = ok ? { title: t!.title!.trim(), body: t!.body?.trim() || null, translated: true } : { title: payload.title, body: payload.body ?? null, translated: l === 'fr' };
  }
  return { recipients: ids.length, accounts, devices, texts };
}
