import { supabaseAdmin } from './supabase-admin';

// ── Langue côté serveur ──────────────────────────────────────────────────────
// La langue d'un client est enregistrée par /api/lang (user_prefs.lang pour le compte,
// push_subscriptions.lang pour l'appareil). Absente = français.
// Les messages du serveur (notifications) sont des modèles stockés dans ui_translations :
//   srv.<clé>.title / srv.<clé>.body, avec des paramètres {nom}. Le français reste dans le code.

export const SERVER_LANGS = ['fr', 'en', 'zh', 'am', 'so', 'aa'] as const;
export type Lang = typeof SERVER_LANGS[number];
export type Text = { title: string; body?: string | null };
// Paramètre d'un modèle : valeur simple, date (mise au format de la langue), sous-modèle (srv.<clé>, avec son
// texte français de repli), ou liste de paramètres assemblés.
export type Param = string | number | null | undefined
  | { date: string; weekday?: boolean }
  | { key: string; params?: Record<string, Param>; fr: string }
  | { list: Param[]; sep?: string };
export type I18n = { key: string; params?: Record<string, Param> };

export const cleanLang = (l: unknown): Lang | null => (SERVER_LANGS as readonly string[]).includes(String(l)) ? (l as Lang) : null;

/** Langue de chaque compte (absents de la réponse = français). */
export async function langsOfUsers(ids: string[]): Promise<Record<string, Lang>> {
  const out: Record<string, Lang> = {};
  const uniq = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 300) {
    const { data } = await supabaseAdmin.from('user_prefs').select('user_id, lang').in('user_id', uniq.slice(i, i + 300));
    for (const r of data || []) { const l = cleanLang(r.lang); if (l) out[r.user_id] = l; }
  }
  return out;
}
export async function langOfUser(id: string | null | undefined): Promise<Lang> {
  if (!id) return 'fr';
  return (await langsOfUsers([id]))[id] || 'fr';
}

const LOCALE: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB', zh: 'zh-CN', am: 'am-ET', so: 'so-SO', aa: 'so-SO' };

function paramText(v: Param, lang: Lang, t: Record<string, string>): string {
  if (v == null) return '';
  if (typeof v !== 'object') return String(v);
  if ('date' in v) {
    const d = new Date(v.date.length === 10 ? v.date + 'T00:00:00' : v.date);
    try { return d.toLocaleDateString(LOCALE[lang], { ...(v.weekday ? { weekday: 'long' as const } : {}), day: 'numeric', month: 'long' }); }
    catch { return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); }
  }
  if ('list' in v) return v.list.map(x => paramText(x, lang, t)).filter(Boolean).join(v.sep ?? ' ');
  const tpl = lang === 'fr' ? null : t[`srv.${v.key}`];
  return tpl ? fill(tpl, v.params, lang, t) : v.fr;
}

/** Remplace {nom} par sa valeur ; un paramètre inconnu est laissé vide. */
// Un paramètre vide ne laisse ni double espace ni espace avant un point ou une virgule.
export const fill = (tpl: string, params: Record<string, Param> = {}, lang: Lang = 'fr', t: Record<string, string> = {}) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => paramText(params?.[k], lang, t)).replace(/[ 	]{2,}/g, ' ').replace(/ +([.,。，።])/g, '$1').trim();

/** Nombre au format de la langue (séparateur de milliers). */
export const fmtNum = (n: number, lang: Lang) => Math.round(Number(n) || 0).toLocaleString(lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-CN' : 'en-US');

// Modèles chargés une fois par langue et par exécution (fonctions serverless : durée de vie courte)
//   srv.*  : notifications (cloche, push) et objets d'e-mail
//   mail.* : textes des e-mails
const cache: Partial<Record<Lang, Record<string, string>>> = {};
async function templates(lang: Lang): Promise<Record<string, string>> {
  if (lang === 'fr') return {};
  if (cache[lang]) return cache[lang]!;
  const out: Record<string, string> = {};
  for (const prefix of ['srv.%', 'mail.%']) {
    for (let from = 0; ; from += 1000) {
      const { data } = await supabaseAdmin.from('ui_translations').select('key, value').eq('language_code', lang).like('key', prefix).order('key').range(from, from + 999);
      for (const r of data || []) out[r.key] = r.value;
      if (!data || data.length < 1000) break;
    }
  }
  return (cache[lang] = out);
}

/**
 * Texte d'une notification dans la langue voulue. `fr` = texte français déjà rédigé par l'appelant
 * (repli si le modèle n'existe pas dans cette langue : jamais de message vide ni à moitié traduit).
 * `subject` : objet d'e-mail facultatif (modèle srv.<clé>.subject).
 */
export async function localize<T extends Text & { subject?: string | null }>(i18n: I18n | null | undefined, lang: Lang, fr: T): Promise<T> {
  if (!i18n || lang === 'fr') return fr;
  const t = await templates(lang);
  const title = t[`srv.${i18n.key}.title`];
  if (!title) return fr;
  const body = t[`srv.${i18n.key}.body`], subject = t[`srv.${i18n.key}.subject`];
  return {
    ...fr,
    title: fill(title, i18n.params, lang, t),
    body: fr.body ? (body ? fill(body, i18n.params, lang, t) : fr.body) : null,
    ...(fr.subject ? { subject: subject ? fill(subject, i18n.params, lang, t) : fill(title, i18n.params, lang, t) } : {}),
  };
}

/**
 * Textes d'un e-mail : m('clé', 'texte français', { paramètres }) → modèle mail.<clé> dans la langue,
 * le français fourni à défaut. `lang` sert aussi à l'attribut de langue de l'e-mail et aux dates.
 */
export async function mailer(lang: string | null | undefined) {
  const l: Lang = cleanLang(lang) || 'fr';
  const t = await templates(l);
  const m = (key: string, fr: string, params?: Record<string, Param>) => {
    const tpl = l === 'fr' ? null : t[`mail.${key}`];
    // Sans modèle, le français fourni est utilisé, mais ses paramètres (dates, libellés) restent dans la langue
    return fill(tpl || fr, params, l, t);
  };
  return { lang: l, m, locale: LOCALE[l], date: (d: string | Date, opts?: Intl.DateTimeFormatOptions) => { const x = typeof d === 'string' ? new Date(d.length === 10 ? d + 'T00:00:00' : d) : d; try { return x.toLocaleString(LOCALE[l], opts || { dateStyle: 'long' }); } catch { return x.toLocaleString('fr-FR', opts || { dateStyle: 'long' }); } } };
}
export type Mailer = Awaited<ReturnType<typeof mailer>>;

/** Langue d'une commande : celle enregistrée à la commande (invités compris), sinon celle du compte. */
export async function langOfOrder(order: { lang?: string | null; user_id?: string | null } | null | undefined): Promise<Lang> {
  return cleanLang(order?.lang) || await langOfUser(order?.user_id);
}
