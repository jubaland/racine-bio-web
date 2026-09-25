// Test de régression — règles marchand (modération + visibilité), Phase 1.
// S'exécute via l'API de gestion dans une transaction ANNULÉE (raise exception) : aucun résidu.
//   node scripts/phase1_test_rules.mjs
import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const q = async (sql) => {
  const r = await fetch('https://api.supabase.com/v1/projects/sneuexxysxlwpokhkjho/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + env.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }),
  });
  return { status: r.status, body: await r.text() };
};
// Marchand fictif : n'importe quel compte existant (aucune écriture ne survit à la transaction)
const uid = JSON.parse((await q("select id from auth.users order by created_at limit 1")).body)[0].id;
const req = JSON.parse((await q("select column_name, data_type from information_schema.columns where table_schema='public' and table_name='products' and is_nullable='NO' and column_default is null and column_name<>'id'")).body);
const vals = { name: "'zz-sim'", price: '100', unit: "'/kg'", status: "'published'", owner_id: 'uid', stock_qty: '5' };
for (const c of req) if (!(c.column_name in vals)) vals[c.column_name] = /int|numeric|double|real/.test(c.data_type) ? '0' : c.data_type === 'boolean' ? 'false' : "'zz'";
const cols = Object.keys(vals).join(', '), values = Object.values(vals).join(', ');
const asM = "perform set_config('request.jwt.claims', json_build_object('sub',uid,'role','authenticated')::text, true); perform set_config('role','authenticated', true);";
const asA = "perform set_config('role','postgres', true); perform set_config('request.jwt.claims','', true);";
const asN = "perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true); perform set_config('role','anon', true);";
const sql = `do $$
declare uid uuid := '${uid}'; pid bigint; s1 text; s2 text; s3 text; s4 text; s5 text; s6 text; v1 int; v2 int; v3 int; r text;
begin
  ${asM}
  insert into products (${cols}) values (${values}) returning id, status into pid, s1;          -- création → pending_review
  ${asA} update products set status='published' where id=pid;                                     -- admin valide
  ${asM} update products set stock_qty = 9 where id = pid; select status into s2 from products where id = pid;  -- stock seul → reste published
  update products set price = 120 where id = pid; select status into s3 from products where id = pid;           -- prix → pending_review
  update products set status='published' where id=pid; select status into s4 from products where id = pid;      -- auto-publication → bloquée
  ${asA} update products set status='published' where id=pid;
  ${asM} update products set images = '["https://example.com/a.jpg"]'::jsonb where id = pid; select status into s6 from products where id = pid;  -- photos → pending_review
  ${asA} update products set status='published' where id=pid;
  ${asN} select count(*) into v1 from products where id = pid;                                     -- sans abonnement → 0
  ${asA} insert into merchant_subscriptions (user_id, plan_id, status, starts_at, ends_at) values (uid, 1, 'active', current_date, current_date + 30);
  ${asN} select count(*) into v2 from products where id = pid;                                     -- actif → 1
  ${asA} update merchant_subscriptions set ends_at = current_date - 1 where user_id = uid;
  ${asN} select count(*) into v3 from products where id = pid;                                     -- échu → 0
  ${asA} select amount::text into r from merchant_subscriptions where user_id = uid;
  raise exception 'RESULTATS|creation=%|stock_seul=%|modif_prix=%|auto_publication=%|modif_photos=%|anon_sans_abo=%|anon_abo_actif=%|anon_abo_echu=%|montant=%', s1, s2, s3, s4, s6, v1, v2, v3, r;
end $$;`;
const res = await q(sql);
const m = res.body.match(/RESULTATS\|[^"\\]*/);
if (!m) { console.log('ERREUR', res.body.slice(0, 500)); process.exit(1); }
const got = Object.fromEntries(m[0].replace('RESULTATS|', '').split('|').map(p => p.split('=')));
const expected = { creation: 'pending_review', stock_seul: 'published', modif_prix: 'pending_review', auto_publication: 'pending_review', modif_photos: 'pending_review', anon_sans_abo: '0', anon_abo_actif: '1', anon_abo_echu: '0', montant: '5000' };
let ko = 0;
for (const [k, v] of Object.entries(expected)) { const ok = got[k] === v; if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${k} = ${got[k]}${ok ? '' : ' (attendu ' + v + ')'}`); }
const res2 = JSON.parse((await q("select (select count(*) from products where name='zz-sim')::int as p, (select count(*) from merchant_subscriptions where notes = 'zz-sim')::int as s")).body)[0];
console.log(`résidus : ${res2.p} produit(s) test — ${ko ? ko + ' KO' : 'tout est conforme'}`);
process.exit(ko ? 1 : 0);
