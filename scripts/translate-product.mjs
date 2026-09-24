#!/usr/bin/env node
/**
 * Génère et insère les traductions d'un produit dans product_translations.
 *
 * Usage :
 *   node scripts/translate-product.mjs <product_id>          # traduit + écrit en base
 *   node scripts/translate-product.mjs <product_id> --dry    # aperçu, sans écriture
 *
 * Le français (valeur du produit) reste la source : aucune ligne 'fr' n'est créée.
 * Les 5 langues cibles sont (re)générées et écrasées à chaque exécution.
 *
 * Traduction : endpoint public Google Translate (sans clé). C'est de la
 * traduction automatique — à relire pour les langues sensibles. L'afar (aa)
 * n'étant pas supporté par Google, on utilise l'oromo (om), proche du contenu
 * aa déjà présent dans la base.
 *
 * Lit NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY depuis .env.local.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- args ---
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const id = args.find(a => /^\d+$/.test(a));
if (!id) {
  console.error('Usage: node scripts/translate-product.mjs <product_id> [--dry]');
  process.exit(1);
}

// --- .env.local ---
function loadEnv() {
  const txt = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}
const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local'); process.exit(1); }
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// langue_code en base -> code Google Translate
const LANGS = [
  { code: 'en', tl: 'en' },
  { code: 'zh', tl: 'zh-CN' },
  { code: 'so', tl: 'so' },
  { code: 'aa', tl: 'om' },   // afar non supporté par Google -> oromo
  { code: 'am', tl: 'am' },
];

async function translate(text, tl) {
  if (!text || !text.trim()) return text ?? '';
  const u = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(u);
  if (!res.ok) throw new Error(`Google Translate ${tl} -> HTTP ${res.status}`);
  const data = await res.json();
  return data[0].map(seg => seg[0]).join('');
}

async function main() {
  // 1. produit source (FR)
  const pr = await fetch(`${URL}/rest/v1/products?select=id,name,description&id=eq.${id}`, { headers });
  const [product] = await pr.json();
  if (!product) { console.error(`Produit #${id} introuvable.`); process.exit(1); }
  console.log(`\nProduit #${id} (source FR)`);
  console.log(`  name: ${product.name}`);
  console.log(`  desc: ${product.description ?? '—'}\n`);

  // 2. traductions
  const rows = [];
  for (const { code, tl } of LANGS) {
    const name = await translate(product.name, tl);
    const description = await translate(product.description, tl);
    rows.push({ product_id: Number(id), language_code: code, name, description });
    console.log(`  [${code}] ${name}`);
    console.log(`        ${description}`);
  }

  if (dry) { console.log('\n--dry : aucune écriture en base.\n'); return; }

  // 3. écriture (overwrite des 5 langues)
  const del = await fetch(`${URL}/rest/v1/product_translations?product_id=eq.${id}&language_code=in.(en,zh,so,aa,am)`, { method: 'DELETE', headers });
  if (!del.ok) { console.error(`DELETE HTTP ${del.status}: ${await del.text()}`); process.exit(1); }
  const ins = await fetch(`${URL}/rest/v1/product_translations`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!ins.ok) { console.error(`INSERT HTTP ${ins.status}: ${await ins.text()}`); process.exit(1); }
  console.log(`\n✅ ${rows.length} traductions écrites pour le produit #${id}. (Aucun déploiement nécessaire.)\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
