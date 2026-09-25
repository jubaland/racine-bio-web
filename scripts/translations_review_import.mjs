// Import des corrections du classeur de relecture (somali / afar) dans la base.
//   node scripts/translations_review_import.mjs translations-review/relecture-so-aa-<date>.xlsx [--dry]
// Lit les colonnes « corrigé » (Interface : F somali, H afar ; Produits : F/H noms, J/L descriptions),
// ignore les cellules vides, et applique par lots via l'API de gestion Supabase (transaction unique).
// --dry : affiche le nombre de corrections par langue sans rien écrire.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const file = process.argv[2]; const dry = process.argv.includes('--dry');
if (!file || !fs.existsSync(file)) { console.error('Fichier .xlsx introuvable'); process.exit(1); }
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));

// Lecture du classeur via Python/openpyxl (pas de dépendance Node supplémentaire)
const py = `
import json, sys
from openpyxl import load_workbook
wb = load_workbook(sys.argv[1], data_only=True)
out = {'ui': [], 'products': []}
ws = wb['Interface']
for row in ws.iter_rows(min_row=2, values_only=True):
    key, so_fix, aa_fix = row[0], row[5], row[7]
    if not key: continue
    if so_fix and str(so_fix).strip(): out['ui'].append({'key': key, 'lang': 'so', 'value': str(so_fix).strip()})
    if aa_fix and str(aa_fix).strip(): out['ui'].append({'key': key, 'lang': 'aa', 'value': str(aa_fix).strip()})
if 'Produits' in wb.sheetnames:
    wp = wb['Produits']
    for row in wp.iter_rows(min_row=2, values_only=True):
        pid = row[0]
        if not pid: continue
        for lang, ni, di in (('so', 5, 9), ('aa', 7, 11)):
            name = row[ni]; desc = row[di]
            if (name and str(name).strip()) or (desc and str(desc).strip()):
                out['products'].append({'product_id': int(pid), 'lang': lang, 'name': str(name).strip() if name and str(name).strip() else None, 'description': str(desc).strip() if desc and str(desc).strip() else None})
print(json.dumps(out, ensure_ascii=False))
`;
const parsed = JSON.parse(execFileSync('python', ['-c', py, file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
const esc = (s) => String(s).replace(/'/g, "''");
const counts = { so: parsed.ui.filter(u => u.lang === 'so').length, aa: parsed.ui.filter(u => u.lang === 'aa').length, products: parsed.products.length };
console.log('Corrections trouvées :', JSON.stringify(counts));
if (dry) { console.log('(mode --dry : rien n\'est écrit)'); process.exit(0); }
if (!parsed.ui.length && !parsed.products.length) { console.log('Rien à importer.'); process.exit(0); }

const stmts = ['begin;'];
for (const u of parsed.ui) {
  stmts.push(`update public.ui_translations set value = '${esc(u.value)}' where key = '${esc(u.key)}' and language_code = '${u.lang}';`);
  stmts.push(`insert into public.ui_translations (key, language_code, value) select '${esc(u.key)}', '${u.lang}', '${esc(u.value)}' where not exists (select 1 from public.ui_translations where key = '${esc(u.key)}' and language_code = '${u.lang}');`);
}
for (const p of parsed.products) {
  const sets = [p.name != null ? `name = '${esc(p.name)}'` : null, p.description != null ? `description = '${esc(p.description)}'` : null].filter(Boolean).join(', ');
  stmts.push(`update public.product_translations set ${sets} where product_id = ${p.product_id} and language_code = '${p.lang}';`);
  stmts.push(`insert into public.product_translations (product_id, language_code, name, description) select ${p.product_id}, '${p.lang}', ${p.name != null ? `'${esc(p.name)}'` : 'null'}, ${p.description != null ? `'${esc(p.description)}'` : 'null'} where not exists (select 1 from public.product_translations where product_id = ${p.product_id} and language_code = '${p.lang}');`);
}
stmts.push('commit;');
const r = await fetch('https://api.supabase.com/v1/projects/sneuexxysxlwpokhkjho/database/query', { method: 'POST', headers: { Authorization: 'Bearer ' + env.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: stmts.join('\n') }) });
console.log(r.status === 201 ? '✅ Corrections appliquées (site à jour au prochain chargement).' : `❌ ${r.status} ${(await r.text()).slice(0, 400)}`);
