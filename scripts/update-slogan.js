const https = require('https');

const SUPABASE_URL = 'sneuexxysxlwpokhkjho.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZXVleHh5c3hsd3Bva2hramhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc1Mzc5OSwiZXhwIjoyMDk0MzI5Nzk5fQ.w9Cq_gPz4OIIjFKOx2mlyLnqERSCe-3p6SYILmb1HJs';

const translations = [
  ['en', 'The premium, fresh, organic, local and regional market of Djibouti'],
  ['zh', '吉布提优质、新鲜、有机、本地和地区性市场'],
  ['so', 'Suuqa heerka sare, cusub, dabiiciga ah, maxalliga ah ee Jabuuti'],
  ['aa', 'Jabuutii suuqa qulqulluu, cusaa, orgaanikii, naannoo fi naannoo'],
  ['am', 'የጅቡቲ ፕሪሚዬም፣ ትኩስ፣ ኦርጋኒክ፣ አካባቢያዊ እና ክልላዊ ገበያ'],
];

function patch(lang, value) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ value });
    const req = https.request({
      hostname: SUPABASE_URL,
      path: `/rest/v1/ui_translations?key=eq.footer&language_code=eq.${lang}`,
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
  for (const [lang, value] of translations) {
    const res = await patch(lang, value);
    console.log(`[${lang}] footer: ${res.status} ${res.status !== 204 ? res.body : 'OK'}`);
  }
}

main().catch(console.error);
