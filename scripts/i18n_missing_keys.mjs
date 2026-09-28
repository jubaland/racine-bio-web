// Liste les clés d'interface t('clé', 'texte français') présentes dans le code mais sans traduction
// anglaise en base (donc à traduire dans les 5 langues). Sortie : JSON { clé: texte français }.
//   node scripts/i18n_missing_keys.mjs <sortie.json> <fichier…>
import { readFileSync, writeFileSync } from 'node:fs';

const [out, ...files] = process.argv.slice(2);
const env = readFileSync('.env.local', 'utf8');
const token = /SUPABASE_ACCESS_TOKEN=(.+)/.exec(env)[1].trim();

const found = {};
const re = /\bt\(\s*'([a-zA-Z0-9_.]+)'\s*,\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*\)/g;
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(s))) found[m[1]] ??= (m[2] ?? m[3]).replace(/\\'/g, "'").replace(/\\"/g, '"');
}
const keys = Object.keys(found);
const r = await fetch('https://api.supabase.com/v1/projects/sneuexxysxlwpokhkjho/database/query', {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `select key from ui_translations where language_code='en' and key in (${keys.map(k => `'${k}'`).join(',')})` }),
});
const have = new Set((await r.json()).map(x => x.key));
const missing = Object.fromEntries(keys.filter(k => !have.has(k)).map(k => [k, found[k]]));
writeFileSync(out, JSON.stringify(missing, null, 1));
console.log(`${keys.length} clés dans le code, ${Object.keys(missing).length} sans traduction`);
