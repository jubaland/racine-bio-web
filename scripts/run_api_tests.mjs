// Rejoue tous les tests d'API / base (scripts/phase*_test_*.mjs) l'un après l'autre et résume.
// Serveur local requis pour la plupart (npm run dev, port 3000). Chaque script crée ses données
// temporaires et les supprime ; les préparateurs sont mis en pause par les scripts qui créent des commandes.
//   node scripts/run_api_tests.mjs            → tous
//   node scripts/run_api_tests.mjs bundles    → ceux dont le nom contient « bundles »
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const filter = process.argv[2] || '';
const order = (f) => Number((/phase(\d+)/.exec(f) || [0, 99])[1]) + (/phase\d+[a-z]/.test(f) ? 0.5 : 0);
const files = readdirSync('scripts').filter(f => /^phase.*_test_.*\.mjs$/.test(f) && f.includes(filter)).sort((a, b) => order(a) - order(b) || a.localeCompare(b));

const rows = [];
for (const f of files) {
  process.stdout.write(`▶ ${f} … `);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [`scripts/${f}`], { encoding: 'utf8', timeout: 10 * 60 * 1000 });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  const m = [...out.matchAll(/(\d+)\s*OK\s*\/\s*(\d+)\s*KO/g)].pop() || [...out.matchAll(/(\d+)\s*\/\s*(\d+)/g)].pop();
  const failed = out.split('\n').filter(l => l.includes('❌')).map(l => l.trim());
  const okRun = r.status === 0 && failed.length === 0;
  rows.push({ f, okRun, summary: m ? m[0] : (okRun ? 'ok' : `code ${r.status}`), secs: Math.round((Date.now() - t0) / 1000), failed, tail: okRun ? '' : out.trim().split('\n').slice(-6).join('\n') });
  console.log(`${okRun ? '✅' : '❌'} ${rows.at(-1).summary} (${rows.at(-1).secs}s)`);
}

console.log('\n── Résumé ──');
for (const r of rows) {
  console.log(`${r.okRun ? '✅' : '❌'} ${r.f.padEnd(36)} ${r.summary}`);
  for (const l of r.failed) console.log(`     ${l}`);
  if (!r.okRun && !r.failed.length) console.log(r.tail.split('\n').map(l => `     ${l}`).join('\n'));
}
const ko = rows.filter(r => !r.okRun).length;
console.log(`\n${rows.length - ko} suite(s) OK, ${ko} en échec`);
process.exit(ko ? 1 : 0);
