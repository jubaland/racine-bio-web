// Importe des traductions d'interface préparées en JSON ({ clé: texte }) et écrit le script SQL
// correspondant (traçabilité dans le dépôt). N'écrase jamais une traduction existante.
//   node scripts/i18n_import.mjs <dossier> <sortie.sql> [--dry]
// Fichiers attendus dans <dossier> : tr_en.json, tr_zh.json, tr_am.json, tr_so.json.
// L'afar (aa) reprend le somali en attendant la relecture native (langue masquée du sélecteur).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const [dir, outSql, flag] = process.argv.slice(2);
const dry = flag === '--dry';
const LANGS = ['en', 'zh', 'am', 'so'];
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const rows = [];
let ref = null;
for (const lang of LANGS) {
  const f = path.join(dir, `tr_${lang}.json`);
  if (!existsSync(f)) throw new Error(`fichier manquant : ${f}`);
  const data = JSON.parse(readFileSync(f, 'utf8'));
  const keys = Object.keys(data).sort();
  if (!ref) ref = keys; else {
    const missing = ref.filter(k => !(k in data)), extra = keys.filter(k => !ref.includes(k));
    if (missing.length || extra.length) throw new Error(`${lang} : clés manquantes ${JSON.stringify(missing.slice(0, 5))}, en trop ${JSON.stringify(extra.slice(0, 5))}`);
  }
  for (const k of keys) {
    const v = String(data[k] ?? '');
    if (!v.trim()) throw new Error(`${lang} : traduction vide pour ${k}`);
    rows.push([k, lang, v]);
    if (lang === 'so') rows.push([k, 'aa', v]);
  }
}

const sql = `-- Traductions d'interface générées par scripts/i18n_import.mjs (${ref.length} clés × 5 langues ; fr = fallback dans le code)\n`
  + `insert into public.ui_translations (key, language_code, value)\nselect v.key, v.lang, v.value from (values\n`
  + rows.map(([k, l, v]) => ` (${q(k)},${q(l)},${q(v)})`).join(',\n')
  + `\n) as v(key, lang, value)\nwhere not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);\n`;
writeFileSync(outSql, sql);
console.log(`${ref.length} clés, ${rows.length} lignes → ${outSql}`);
if (dry) process.exit(0);

const token = /SUPABASE_ACCESS_TOKEN=(.+)/.exec(readFileSync('.env.local', 'utf8'))[1].trim();
const r = await fetch('https://api.supabase.com/v1/projects/sneuexxysxlwpokhkjho/database/query', {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }),
});
console.log(r.status, (await r.text()).slice(0, 300));
process.exit(r.ok ? 0 : 1);
