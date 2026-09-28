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
export const fill = (tpl: string, params: Record<string, Param> = {}, lang: Lang = 'fr', t: Record<string, string> = {}) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => paramText(params?.[k], lang, t)).replace(/[ 	]{2,}/g, ' ').trim();

/** Nombre au format de la langue (séparateur de milliers). */
export const fmtNum = (n: number, lang: Lang) => Math.round(Number(n) || 0).toLocaleString(lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-CN' : 'en-US');

// Modèles chargés une fois par langue et par exécution (fonctions serverless : durée de vie courte)
const cache: Partial<Record<Lang, Record<string, string>>> = {};
async function templates(lang: Lang): Promise<Record<string, string>> {
  if (lang === 'fr') return {};
  if (cache[lang]) return cache[lang]!;
  const { data } = await supabaseAdmin.from('ui_translations').select('key, value').eq('language_code', lang).like('key', 'srv.%');
  return (cache[lang] = Object.fromEntries((data || []).map((r: any) => [r.key, r.value])));
}

/**
 * Texte d'une notification dans la langue voulue. `fr` = texte français déjà rédigé par l'appelant
 * (repli si le modèle n'existe pas dans cette langue : jamais de message vide ni à moitié traduit).
 */
export async function localize(i18n: I18n | null | undefined, lang: Lang, fr: Text): Promise<Text> {
  if (!i18n || lang === 'fr') return fr;
  const t = await templates(lang);
  const title = t[`srv.${i18n.key}.title`];
  if (!title) return fr;
  const body = t[`srv.${i18n.key}.body`];
  return { title: fill(title, i18n.params, lang, t), body: fr.body ? (body ? fill(body, i18n.params, lang, t) : fr.body) : null };
}
