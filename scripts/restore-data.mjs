// Restauration des données Hornafresh depuis cette sauvegarde (via l'API Supabase).
//
// À lancer DEPUIS le dossier du projet (pour node_modules) :
//   node "C:/Users/bongo/hornafresh-backups/2026-09-22-avant-marchands/restore-data.mjs" [options]
//
// Options :
//   (aucune)            → restaure TOUTES les tables (upsert : réécrit/recrée les lignes de la sauvegarde,
//                          ne supprime PAS les lignes créées après la sauvegarde)
//   --tables a,b,c      → ne restaure que ces tables
//   --wipe              → vide chaque table AVANT de la restaurer (retour exact à l'état sauvegardé)
//   --dry               → simulation : affiche ce qui serait fait, ne modifie rien
//
// ⚠️ Le schéma (tables/colonnes) n'est pas restauré par ce script : si le chantier a ajouté
//    des tables/colonnes, supprimez-les via le SQL Editor Supabase (voir README).
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const URL_ = 'https://sneuexxysxlwpokhkjho.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZXVleHh5c3hsd3Bva2hramhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc1Mzc5OSwiZXhwIjoyMDk0MzI5Nzk5fQ.w9Cq_gPz4OIIjFKOx2mlyLnqERSCe-3p6SYILmb1HJs';
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

const args = process.argv.slice(2);
const only = (args[args.indexOf('--tables') + 1] || '').split(',').filter(Boolean);
const wipe = args.includes('--wipe');
const dry = args.includes('--dry');

const spec = JSON.parse(fs.readFileSync(path.join(DIR, 'schema-openapi.json'), 'utf8'));
// Colonnes clé primaire (PostgREST les marque "<pk/>" dans la description)
const pkOf = t => Object.entries(spec.definitions[t]?.properties || {})
  .filter(([, p]) => /<pk\/>/.test(p.description || '')).map(([c]) => c);

// Ordre : tables "parents" d'abord (clés étrangères)
const ORDER = ['languages', 'currencies', 'categories', 'producers', 'products', 'delivery_options', 'promos',
  'orders', 'order_items', 'wallets', 'wallet_transactions', 'subscriptions', 'subscription_items'];
const files = fs.readdirSync(path.join(DIR, 'data')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
const tables = [...ORDER.filter(t => files.includes(t)), ...files.filter(t => !ORDER.includes(t))]
  .filter(t => t !== 'users_with_roles' && (!only.length || only.includes(t)));

for (const t of tables) {
  const rows = JSON.parse(fs.readFileSync(path.join(DIR, 'data', `${t}.json`), 'utf8'));
  const pk = pkOf(t);
  if (wipe) {
    if (!pk.length) { console.log(`${t}: pas de clé primaire → wipe ignoré`); }
    else if (!dry) {
      const r = await fetch(`${URL_}/rest/v1/${t}?${pk[0]}=not.is.null`, { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } });
      console.log(`${t}: wipe HTTP ${r.status}`);
    } else console.log(`${t}: [dry] wipe`);
  }
  if (!rows.length) { console.log(`${t}: 0 ligne`); continue; }
  if (dry) { console.log(`${t}: [dry] upsert ${rows.length} lignes (pk: ${pk.join(',') || '—'})`); continue; }
  let ok = 0;
  // 1) Tentative en lot (upsert)
  let identity = false;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const r = await fetch(`${URL_}/rest/v1/${t}${pk.length ? `?on_conflict=${pk.join(',')}` : ''}`, {
      method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(chunk),
    });
    if (r.ok) { ok += chunk.length; continue; }
    const txt = await r.text();
    if (txt.includes('428C9')) { identity = true; break; } // id GENERATED ALWAYS → repli ligne à ligne
    console.log(`  ${t} lot ${i}: HTTP ${r.status} ${txt.slice(0, 160)}`);
  }
  // 2) Repli : UPDATE par clé primaire (ligne existante), sinon INSERT sans l'id (régénéré)
  if (identity && pk.length) {
    ok = 0;
    for (const row of rows) {
      const filter = pk.map(c => `${c}=eq.${encodeURIComponent(row[c])}`).join('&');
      const body = Object.fromEntries(Object.entries(row).filter(([c]) => !pk.includes(c)));
      const u = await fetch(`${URL_}/rest/v1/${t}?${filter}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(body) });
      const updated = u.ok ? await u.json() : [];
      if (updated.length) { ok++; continue; }
      const ins = await fetch(`${URL_}/rest/v1/${t}`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body) });
      if (ins.ok) ok++; else console.log(`  ${t} ${filter}: HTTP ${ins.status} ${(await ins.text()).slice(0, 120)}`);
    }
  }
  console.log(`${t}: ${ok}/${rows.length} lignes restaurées${identity ? ' (mode ligne à ligne)' : ''}`);
}
console.log('\nTerminé. Pensez au schéma (README) et aux images (storage/) si nécessaire.');
