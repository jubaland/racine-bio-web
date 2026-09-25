// Export des textes d'interface pour relecture native (somali / afar).
// 1) Français de référence = valeur `fr` en base si présente, sinon le texte par défaut trouvé dans le code
//    (motif t('clé', 'texte') dans app/, components/, lib/).
// 2) Sortie : translations-review/data.json (consommé par translations_review_xlsx.py)
import fs from 'node:fs';
import path from 'node:path';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const q = async (sql) => {
  const r = await fetch('https://api.supabase.com/v1/projects/sneuexxysxlwpokhkjho/database/query', { method: 'POST', headers: { Authorization: 'Bearer ' + env.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) });
  return JSON.parse(await r.text());
};

// Textes par défaut (fr) dans le code + fichier d'origine (contexte pour le relecteur)
const fallbacks = {}; const where = {};
const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (!['node_modules', '.next', '_archive'].some(x => e.name.startsWith(x))) walk(p); } else if (/\.(tsx?|mjs)$/.test(e.name) && !e.name.startsWith('_archive')) scan(p); } };  // fichiers archivés ignorés (textes non utilisés)
const re = /\bt\(\s*'((?:[^'\\]|\\.)+)'\s*,\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`)\s*\)/g;
const scan = (file) => {
  const src = fs.readFileSync(file, 'utf8'); let m;
  while ((m = re.exec(src))) { const key = m[1]; const val = (m[2] ?? m[3] ?? m[4] ?? '').replace(/\\'/g, "'").replace(/\\n/g, '\n'); if (!fallbacks[key]) { fallbacks[key] = val; where[key] = path.relative('.', file).replace(/\\/g, '/'); } }
};
for (const d of ['app', 'components', 'lib']) walk(d);

const rows = await q("select key, language_code, value from public.ui_translations");
const byKey = {};
for (const r of rows) (byKey[r.key] ||= {})[r.language_code] = r.value;
const keys = [...new Set([...Object.keys(byKey), ...Object.keys(fallbacks)])].sort();
const ui = keys.map(k => ({ key: k, file: where[k] || '', fr: byKey[k]?.fr ?? fallbacks[k] ?? '', en: byKey[k]?.en ?? '', so: byKey[k]?.so ?? '', aa: byKey[k]?.aa ?? '', aa_copy_of_so: !!(byKey[k]?.aa && byKey[k]?.aa === byKey[k]?.so) }));
const prods = await q("select pt.product_id, p.name as fr_name, p.description as fr_description, pt.language_code, pt.name, pt.description from public.product_translations pt join public.products p on p.id = pt.product_id where pt.language_code in ('so','aa','en') order by pt.product_id, pt.language_code");
const pmap = {};
for (const r of prods) { const o = (pmap[r.product_id] ||= { product_id: r.product_id, fr_name: r.fr_name, fr_description: r.fr_description || '' }); o[`${r.language_code}_name`] = r.name || ''; o[`${r.language_code}_description`] = r.description || ''; }
fs.mkdirSync('translations-review', { recursive: true });
fs.writeFileSync('translations-review/data.json', JSON.stringify({ generated: new Date().toISOString(), ui, products: Object.values(pmap) }, null, 1));
const stats = { keys: ui.length, so_missing: ui.filter(r => !r.so).length, aa_missing: ui.filter(r => !r.aa).length, aa_copy_of_so: ui.filter(r => r.aa_copy_of_so).length, fr_from_code: ui.filter(r => !byKey[r.key]?.fr && fallbacks[r.key]).length, fr_missing: ui.filter(r => !r.fr).length, products: Object.keys(pmap).length };
console.log(JSON.stringify(stats));
