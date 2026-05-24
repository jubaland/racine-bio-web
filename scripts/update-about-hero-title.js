const https = require('https');

const SUPABASE_URL = 'sneuexxysxlwpokhkjho.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZXVleHh5c3hsd3Bva2hramhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc1Mzc5OSwiZXhwIjoyMDk0MzI5Nzk5fQ.w9Cq_gPz4OIIjFKOx2mlyLnqERSCe-3p6SYILmb1HJs';

// "Nourrir mieux" → "Se nourrir mieux" (forme réflexive)
const rows = [
  ['en', 'about.hero_title', 'Nourish yourself better,'],
  ['zh', 'about.hero_title', '好好滋养自己，'],
  ['so', 'about.hero_title', 'Is quudso si fiican,'],
  ['aa', 'about.hero_title', 'Ofii woyitinni eedi,'],
  ['am', 'about.hero_title', 'ራስዎን በተሻለ ይሙሉ,'],
];

function patch(language_code, key, value) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ value });
    const path = `/rest/v1/ui_translations?key=eq.${encodeURIComponent(key)}&language_code=eq.${language_code}`;
    const req = https.request({
      hostname: SUPABASE_URL,
      path,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(data),
      },
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  let ok = 0, fail = 0;
  for (const [language_code, key, value] of rows) {
    const res = await patch(language_code, key, value);
    if (res.status === 204 || res.status === 200) {
      ok++;
      console.log(`OK  [${language_code}] ${value}`);
    } else {
      console.log(`FAIL [${language_code}]: ${res.status} ${res.body.slice(0, 100)}`);
      fail++;
    }
  }
  console.log(`\nDone: ${ok} ok, ${fail} failed`);
}

main().catch(console.error);
