// Audit des traductions d'interface pour un ensemble de fichiers : pour chaque clé t('clé', 'texte fr')
// (ou ui.clé / ui['clé']), signale par langue : traduction absente, vide, ou identique au français.
//   node scripts/i18n_audit.mjs <sortie.json> <fichier…>
// Sortie : { missing: { lang: { clé: fr } }, same_as_fr: { lang: { clé: valeur } }, no_fallback: [clés] }
import { readFileSync, writeFileSync } from 'node:fs';

const [out, ...files] = process.argv.slice(2);
const LANGS = ['en', 'zh', 'am', 'so', 'aa'];
const token = /SUPABASE_ACCESS_TOKEN=(.+)/.exec(readFileSync('.env.local', 'utf8'))[1].trim();
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/sneuexxysxlwpokhkjho/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};

const found = {}; const bare = new Set();
const reT = /\bt\(\s*'([a-zA-Z0-9_.]+)'\s*,\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`)\s*\)/g;
const reUi = /\bui(?:\.([a-zA-Z0-9_]+)|\[\s*'([a-zA-Z0-9_.]+)'\s*\])(?:\s*\|\|\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"))?/g;
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  let m;
  while ((m = reT.exec(s))) found[m[1]] ??= (m[2] ?? m[3] ?? m[4]).replace(/\\'/g, "'").replace(/\\"/g, '"');
  while ((m = reUi.exec(s))) {
    const k = m[1] ?? m[2]; const fr = m[3] ?? m[4];
    if (k === 'length') continue;
    if (fr != null) found[k] ??= fr.replace(/\\'/g, "'"); else bare.add(k);
  }
}
for (const k of bare) if (!(k in found)) found[k] = null;
const keys = Object.keys(found);
const rows = await q(`select key, language_code, value from ui_translations where key in (${keys.map(k => `'${k.replace(/'/g, "''")}'`).join(',')})`);
const db = {}; for (const r of rows) (db[r.key] ||= {})[r.language_code] = r.value;

const missing = {}, same = {};
for (const k of keys) {
  const fr = found[k] ?? db[k]?.fr ?? null;
  for (const l of LANGS) {
    const v = db[k]?.[l];
    if (v == null || !String(v).trim()) (missing[l] ||= {})[k] = fr;
    else if (fr && v.trim() === fr.trim() && /[a-zà-ÿ]{4,}/i.test(fr)) (same[l] ||= {})[k] = v;
  }
}
writeFileSync(out, JSON.stringify({ missing, same_as_fr: same, no_fallback: keys.filter(k => found[k] == null && !db[k]?.fr) }, null, 1));
console.log(`${keys.length} clés`);
for (const l of LANGS) console.log(`  ${l} : ${Object.keys(missing[l] || {}).length} absentes, ${Object.keys(same[l] || {}).length} identiques au français`);
