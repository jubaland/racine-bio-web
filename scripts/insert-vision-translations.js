const https = require('https');

const SUPABASE_URL = 'sneuexxysxlwpokhkjho.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZXVleHh5c3hsd3Bva2hramhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc1Mzc5OSwiZXhwIjoyMDk0MzI5Nzk5fQ.w9Cq_gPz4OIIjFKOx2mlyLnqERSCe-3p6SYILmb1HJs';

// Bloc "Notre vision à long terme" + CTAs + retour accueil — 5 clés × 5 langues
const rows = [
  ['en','about.vision_title','Our long-term vision'],
  ['zh','about.vision_title','我们的长期愿景'],
  ['so','about.vision_title','Aragtidayada dheer'],
  ['aa','about.vision_title','Mul\'ata keenya dheeraa'],
  ['am','about.vision_title','የረጅም ጊዜ ራዕያችን'],

  ['en','about.vision_desc','To make Djibouti a model of circular, biological food economy for the region. That every family has access to healthy products. That every farmer can live with dignity from their work while respecting the land. That prevention through food becomes a cultural reflex.'],
  ['zh','about.vision_desc','使吉布提成为该地区循环生物食品经济的典范。每个家庭都能获得健康产品。每位农民都能在尊重土地的同时有尊严地生活。通过食物预防成为一种文化反射。'],
  ['so','about.vision_desc','In Jabuuti laga dhigo qaabka dhaqaalaha cuntada wareegsan iyo baayoolajiga ee gobolka. In qoys kasta heli karo badeecadaha caafimaadka. In beerale kasta ku noolaan karo si sharaf leh shaqadiisa isaga oo xurmaynaya dhulka. In kahortagga cuntada uu noqdo falcelinta dhaqanka.'],
  ['aa','about.vision_desc','Jabuutii naannoo dhaqaa nyaataa diriiraa fi orgaanikii fakeenyaa taʼuu. Maatiin tokko tokko qabdu fayyaa heluu. Qonnaan bulaan tokko tokko lafa kabajaa hojjetee kabajaan jiraachuu dandaʼuu. Nyaataan hanqaatinni aadaa falcaʼii taʼuu.'],
  ['am','about.vision_desc','ጅቡቲን ለክልሉ ዙርያዊ፣ ባዮሎጂካዊ የምግብ ኢኮኖሚ ሞዴል ማድረግ። እያንዳንዱ ቤተሰብ ጤናማ ምርቶችን እንዲያገኝ። እያንዳንዱ አርሶ አደር መሬቱን እያከበረ ሥራውን በክብር ሊኖር እንዲችል። ምግብ በኩል መከላከል የባህል ምላሽ እንዲሆን።'],

  ['en','about.cta_shop','Discover our products'],
  ['zh','about.cta_shop','探索我们的产品'],
  ['so','about.cta_shop','Baadh badeecadayada'],
  ['aa','about.cta_shop','Meeshaa keenya ilaalii'],
  ['am','about.cta_shop','ምርቶቻችንን ያስሱ'],

  ['en','about.cta_producer','Join the network'],
  ['zh','about.cta_producer','加入网络'],
  ['so','about.cta_producer','Ku biir shabakadda'],
  ['aa','about.cta_producer','Networkii keessatti makamaa'],
  ['am','about.cta_producer','አውታረ መረቡን ይቀላቀሉ'],

  ['en','about.back_home','Back to home'],
  ['zh','about.back_home','返回首页'],
  ['so','about.back_home','Ku noqo bogga hore'],
  ['aa','about.back_home','Fuulaa duraa deebiʼaa'],
  ['am','about.back_home','ወደ መነሻ ተመለስ'],
];

function upsert(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
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
    const res = await upsert([{ language_code, key, value }]);
    if (res.status === 201 || res.status === 200) {
      ok++;
      console.log(`OK  [${language_code}] ${key}`);
    } else {
      console.log(`FAIL [${language_code}] ${key}: ${res.status} ${res.body.slice(0, 100)}`);
      fail++;
    }
  }
  console.log(`\nDone: ${ok} ok, ${fail} failed`);
}

main().catch(console.error);
