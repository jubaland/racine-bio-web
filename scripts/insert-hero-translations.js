const https = require('https');

const SUPABASE_URL = 'sneuexxysxlwpokhkjho.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZXVleHh5c3hsd3Bva2hramhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc1Mzc5OSwiZXhwIjoyMDk0MzI5Nzk5fQ.w9Cq_gPz4OIIjFKOx2mlyLnqERSCe-3p6SYILmb1HJs';

const rows = [
  // hero.delivery_info
  ['en', 'hero.delivery_info', 'Practical info'],
  ['zh', 'hero.delivery_info', '实用信息'],
  ['so', 'hero.delivery_info', 'Macluumaadka'],
  ['aa', 'hero.delivery_info', 'Odeeffannoo'],
  ['am', 'hero.delivery_info', 'ተግባራዊ መረጃ'],

  // hero.delivery_zone
  ['en', 'hero.delivery_zone', 'Delivery zone'],
  ['zh', 'hero.delivery_zone', '配送区域'],
  ['so', 'hero.delivery_zone', 'Xaaladda gaarsiinta'],
  ['aa', 'hero.delivery_zone', "Ida'amuu qopha"],
  ['am', 'hero.delivery_zone', 'የማድረሻ ዞን'],

  // hero.delivery_zone_desc
  ['en', 'hero.delivery_zone_desc', 'Djibouti City and surroundings'],
  ['zh', 'hero.delivery_zone_desc', '吉布提市及周边地区'],
  ['so', 'hero.delivery_zone_desc', 'Magaalada Jabuuti iyo degaanada agagaarka'],
  ['aa', 'hero.delivery_zone_desc', 'Jabuutii magaala fi naannoo isii'],
  ['am', 'hero.delivery_zone_desc', 'ጅቡቲ ከተማ እና አካባቢዋ'],

  // hero.delivery_delay
  ['en', 'hero.delivery_delay', 'Delivery time'],
  ['zh', 'hero.delivery_delay', '配送时间'],
  ['so', 'hero.delivery_delay', 'Waqtiga gaarsiinta'],
  ['aa', 'hero.delivery_delay', "Ida'amuu yeroo"],
  ['am', 'hero.delivery_delay', 'የማድረሻ ጊዜ'],

  // hero.delivery_delay_desc
  ['en', 'hero.delivery_delay_desc', 'Within 48h after confirmation'],
  ['zh', 'hero.delivery_delay_desc', '确认后48小时内'],
  ['so', 'hero.delivery_delay_desc', 'Gudaha 48 saac kadib xaqiijinta'],
  ['aa', 'hero.delivery_delay_desc', "Mirkanaa'inaa booda sa'aa 48 keessatti"],
  ['am', 'hero.delivery_delay_desc', 'ከማረጋገጫ በኋላ በ48 ሰዓት ውስጥ'],

  // hero.delivery_free
  ['en', 'hero.delivery_free', 'Free delivery'],
  ['zh', 'hero.delivery_free', '免费配送'],
  ['so', 'hero.delivery_free', 'Gaarsiinta bilaash ah'],
  ['aa', 'hero.delivery_free', 'Ida\'amuu bilaashaa'],
  ['am', 'hero.delivery_free', 'ነጻ ማድረሻ'],

  // hero.delivery_free_desc
  ['en', 'hero.delivery_free_desc', 'On all your orders'],
  ['zh', 'hero.delivery_free_desc', '所有订单均免费配送'],
  ['so', 'hero.delivery_free_desc', 'Dhammaan dalabyadaada'],
  ['aa', 'hero.delivery_free_desc', 'Ajaja kee hunda irratti'],
  ['am', 'hero.delivery_free_desc', 'በሁሉም ትዕዛዝዎ ላይ'],

  // hero.payment_title
  ['en', 'hero.payment_title', 'Accepted payment'],
  ['zh', 'hero.payment_title', '接受支付方式'],
  ['so', 'hero.payment_title', 'Lacag bixinta la aqbalo'],
  ['aa', 'hero.payment_title', 'Kafaltii fudhamu'],
  ['am', 'hero.payment_title', 'ተቀባይ ክፍያ'],
];

function upsert(language_code, key, value) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify([{ language_code, key, value }]);
    const req = https.request({
      hostname: SUPABASE_URL,
      path: '/rest/v1/ui_translations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
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
    const res = await upsert(language_code, key, value);
    if (res.status === 201 || res.status === 200) {
      ok++;
    } else {
      console.log(`FAIL [${language_code}] ${key}: ${res.status} ${res.body.slice(0, 100)}`);
      fail++;
    }
  }
  console.log(`Done: ${ok} ok, ${fail} failed`);
}

main().catch(console.error);
