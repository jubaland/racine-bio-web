const https = require('https');

const SUPABASE_URL = 'sneuexxysxlwpokhkjho.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZXVleHh5c3hsd3Bva2hramhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc1Mzc5OSwiZXhwIjoyMDk0MzI5Nzk5fQ.w9Cq_gPz4OIIjFKOx2mlyLnqERSCe-3p6SYILmb1HJs';

const updates = [
  ['en', 'Who are we?'],
  ['zh', '我们是谁？'],
  ['so', 'Yaan nahay?'],
  ['aa', 'Eenyu taana?'],
  ['am', 'እኛ ማን ነን?'],
];

function patch(lang, value) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ value });
    const path = `/rest/v1/ui_translations?key=eq.learnMore&language_code=eq.${lang}`;
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
  for (const [lang, value] of updates) {
    const res = await patch(lang, value);
    console.log(`[${lang}] learnMore: ${res.status}`);
  }
  console.log('Done!');
}

main().catch(console.error);
