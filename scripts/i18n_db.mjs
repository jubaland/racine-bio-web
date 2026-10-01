// Accès commun des outils de traduction à la table ui_translations, par la clé de service
// (l'API de gestion Supabase demande un jeton personnel qui expire ; la clé de service, non).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
export const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** Lignes (key, language_code, value) des clés demandées, par paquets (l'API renvoie au plus 1 000 lignes). */
export async function rowsFor(keys, langs = null) {
  const out = [];
  for (let i = 0; i < keys.length; i += 150) {
    let q = db.from('ui_translations').select('key, language_code, value').in('key', keys.slice(i, i + 150));
    if (langs) q = q.in('language_code', langs);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...(data || []));
  }
  return out;
}

/** Insère les traductions absentes seulement (jamais d'écrasement). Renvoie le nombre insérées. */
export async function insertMissing(rows) {
  const keys = [...new Set(rows.map(r => r.key))];
  const have = new Set((await rowsFor(keys)).map(r => `${r.key}|${r.language_code}`));
  const fresh = rows.filter(r => !have.has(`${r.key}|${r.language_code}`));
  for (let i = 0; i < fresh.length; i += 500) {
    const { error } = await db.from('ui_translations').insert(fresh.slice(i, i + 500));
    if (error) throw new Error(error.message);
  }
  return fresh.length;
}
