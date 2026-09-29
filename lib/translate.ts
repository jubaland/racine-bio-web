// ── Traduction automatique par un service en ligne ───────────────────────────
// Sert à PRÉREMPLIR les champs de traduction de l'admin : l'admin relit, corrige, puis enregistre.
// Rien n'est jamais enregistré ni publié automatiquement.
// Service : MyMemory (gratuit, sans clé, quota quotidien par adresse IP). Le texte envoyé est celui
// que l'admin s'apprête à publier (nom de produit, annonce, campagne) : aucune donnée de client.
// Pour changer de service, remplacer `translateOne` ; le reste de l'application n'en dépend pas.

export const TARGET_LANGS = ['en', 'zh', 'am', 'so'] as const;
export type TargetLang = typeof TARGET_LANGS[number];
const CODE: Record<TargetLang, string> = { en: 'en-GB', zh: 'zh-CN', am: 'am-ET', so: 'so-SO' };
const ENDPOINT = 'https://api.mymemory.translated.net/get';
const MAX_CHUNK = 450;          // limite du service par requête (500 octets) : les textes longs sont découpés
export const MAX_TEXT = 2000;   // longueur maximale d'un champ accepté
export const MAX_TOTAL = 6000;  // total par appel, toutes langues confondues avant multiplication

// (propriété déclarée à part : les tests importent ce fichier tel quel dans Node)
export class TranslateError extends Error {
  code: 'quota' | 'unavailable' | 'too_long';
  constructor(code: 'quota' | 'unavailable' | 'too_long', message: string) { super(message); this.code = code; }
}

/** Découpe aux fins de phrase, puis aux espaces, sans jamais dépasser `max` caractères. */
export function chunks(text: string, max = MAX_CHUNK): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const part = rest.slice(0, max);
    const cut = Math.max(part.lastIndexOf('. '), part.lastIndexOf('! '), part.lastIndexOf('? '), part.lastIndexOf(' : '), part.lastIndexOf('\n'));
    const at = cut > max * 0.4 ? cut + 1 : (part.lastIndexOf(' ') > 0 ? part.lastIndexOf(' ') : max);
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
}

// Émojis et symboles en tête de texte : retirés avant l'envoi et remis ensuite (les services les perdent ou les déplacent)
const LEAD = /^((?:\p{Extended_Pictographic}|️|‍|\s)+)/u;
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function translateOne(text: string, to: TargetLang): Promise<string> {
  const url = `${ENDPOINT}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`fr-FR|${CODE[to]}`)}`;
  let res: Response;
  try { res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } }); }
  catch { throw new TranslateError('unavailable', 'Service de traduction injoignable'); }
  if (res.status === 429) throw new TranslateError('quota', 'Quota de traduction atteint');
  if (!res.ok) throw new TranslateError('unavailable', `Service de traduction : réponse ${res.status}`);
  const j: any = await res.json().catch(() => null);
  const out = j?.responseData?.translatedText;
  if (j?.quotaFinished || /MYMEMORY WARNING|QUOTA/i.test(String(out || ''))) throw new TranslateError('quota', 'Quota de traduction atteint');
  if (Number(j?.responseStatus) !== 200 || typeof out !== 'string' || !out.trim()) throw new TranslateError('unavailable', 'Service de traduction : réponse inutilisable');
  return decode(out).trim();
}

/** Traduit un texte français vers une langue. Texte vide → vide. */
export async function translateText(text: string, to: TargetLang): Promise<string> {
  const src = String(text || '').trim();
  if (!src) return '';
  if (src.length > MAX_TEXT) throw new TranslateError('too_long', 'Texte trop long');
  const lead = LEAD.exec(src)?.[1] || '';
  const body = src.slice(lead.length).trim();
  if (!body) return src;                                   // seulement des émojis : rien à traduire
  const parts: string[] = [];
  for (const c of chunks(body)) parts.push(await translateOne(c, to));
  return `${lead}${parts.join(' ')}`.trim();
}

/**
 * Traduit plusieurs champs vers plusieurs langues : { langue → { champ → texte } }.
 * Une langue en échec n'empêche pas les autres ; les échecs sont listés dans `errors`.
 */
export async function translateFields(fields: Record<string, string>, langs: TargetLang[]) {
  const entries = Object.entries(fields).map(([k, v]) => [k, String(v ?? '').trim()] as const).filter(([, v]) => v);
  const total = entries.reduce((s, [, v]) => s + v.length, 0);
  if (entries.some(([, v]) => v.length > MAX_TEXT) || total > MAX_TOTAL) throw new TranslateError('too_long', 'Texte trop long');
  const translations: Record<string, Record<string, string>> = {};
  const errors: { lang: string; code: string }[] = [];
  // Langues en parallèle, champs d'une langue à la suite (ménage le quota du service)
  await Promise.all(langs.map(async lang => {
    const out: Record<string, string> = {};
    try { for (const [k, v] of entries) out[k] = await translateText(v, lang); translations[lang] = out; }
    catch (e: any) { errors.push({ lang, code: e instanceof TranslateError ? e.code : 'unavailable' }); if (Object.keys(out).length) translations[lang] = out; }
  }));
  return { translations, errors, characters: total * langs.length, provider: 'MyMemory' };
}
