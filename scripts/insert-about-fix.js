const https = require('https');

const SUPABASE_URL = 'sneuexxysxlwpokhkjho.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZXVleHh5c3hsd3Bva2hramhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc1Mzc5OSwiZXhwIjoyMDk0MzI5Nzk5fQ.w9Cq_gPz4OIIjFKOx2mlyLnqERSCe-3p6SYILmb1HJs';

// Lignes manquantes du batch 1 (sans la ligne dupliquée so/about.story_p3)
// + learnMore mis à jour
const rows = [
  ['en','about.tag','Our mission'],
  ['zh','about.tag','我们的使命'],
  ['so','about.tag','Ujeedadayada'],
  ['aa','about.tag','Kaayyoo keenya'],
  ['am','about.tag','ተልዕኳችን'],

  ['en','about.hero_title','Eat better,'],
  ['zh','about.hero_title','吃得更好，'],
  ['so','about.hero_title','Cun si fiican,'],
  ['aa','about.hero_title','Woyitinni miidi,'],
  ['am','about.hero_title','በተሻለ ይመገቡ,'],

  ['en','about.hero_title2','live better'],
  ['zh','about.hero_title2','生活更好'],
  ['so','about.hero_title2','noolow si fiican'],
  ['aa','about.hero_title2','woyitinni jiraa'],
  ['am','about.hero_title2','በተሻለ ይኑሩ'],

  ['en','about.hero_desc','Hornafresh was born from a simple conviction: in Africa, the first medicine is what we eat. We are building a circular economy around living things — for producers, for consumers, for the planet.'],
  ['zh','about.hero_desc','Hornafresh诞生于一个简单的信念：在非洲，第一药物就是我们所吃的东西。我们正在围绕生命构建循环经济。'],
  ['so','about.hero_desc','Hornafresh waxay ka dhashay xukun fudud: Afrika, dawooyinka ugu horreeya waa waxa aanu cunno.'],
  ['aa','about.hero_desc','Hornafresh goroo galataa: Afirikaa keessa, dawaa duraa mee midaanu miidinu.'],
  ['am','about.hero_desc','Hornafresh ከቀላል እምነት ተወለደ፡ በአፍሪካ፣ የመጀመሪያ መድሃኒት የምንበላው ምግብ ነው።'],

  ['en','about.story_tag','Our story'],
  ['zh','about.story_tag','我们的故事'],
  ['so','about.story_tag','Sheekadayada'],
  ['aa','about.story_tag','Seenaa keenya'],
  ['am','about.story_tag','ታሪካችን'],

  ['en','about.story_title','A social and ecological project, first and foremost'],
  ['zh','about.story_title','首先是一个社会和生态项目'],
  ['so','about.story_title','Mashruuc bulsheed iyo deegaan ah, ka horreeya wax kale'],
  ['aa','about.story_title','Pirojektii hawaasaa fi ekoolojiitii, duraa duuba'],
  ['am','about.story_title','ማህበራዊ እና ኢኮሎጂካዊ ፕሮጀክት፣ ከሁሉ በፊት'],

  ['en','about.story_p1','In Djibouti, as in many African countries, the healthcare system remains under pressure. Yet many chronic diseases can be prevented by a healthy and natural diet.'],
  ['zh','about.story_p1','在吉布提，与许多非洲国家一样，医疗系统仍承受压力。然而，很大一部分慢性疾病可以通过健康自然的饮食来预防。'],
  ['so','about.story_p1','Jabuuti, sida dalalka Afrika ee badan, nidaamka caafimaadku weli wuxuu ku jiraa cadaadis.'],
  ['aa','about.story_p1','Jabuutii, Afirikaa biyya baay\'ee keessa fakkaatee, naga\'ee fayyaa pireeshara jala jira.'],
  ['am','about.story_p1','ጅቡቲ፣ እንደ ብዙ አፍሪካ አገሮች፣ የጤና ስርዓቱ ጫና ውስጥ ይቀጥላል።'],

  ['en','about.story_p2','Hornafresh was born from this conviction: access to fresh, local, pesticide-free food is not a luxury. It is a right. And an act of prevention.'],
  ['zh','about.story_p2','Hornafresh诞生于这一信念：获得新鲜、当地且无农药的食物不应该是一种奢侈。这是一种权利。'],
  ['so','about.story_p2','Hornafresh waxay ka dhashay xukunkaan: helitaanka miraha cusub, maxalliga ah oo aan lahayn xasaarooyin xuquuq ayay tahay.'],
  ['aa','about.story_p2','Hornafresh goroo kanaa ka dhalate: inni, qaamee fi xasaaroo malee nyaata argachuun reefaa ta\'uu hin qabu. Mirga dha.'],
  ['am','about.story_p2','Hornafresh ከዚህ እምነት ተወለደ፡ ትኩስ፣ አካባቢያዊ እና ፀረ-ተባይ-ነጻ ምግብ ማግኘት ቅንጦት ሊሆን አይገባም። እሱ መብት ነው።'],

  ['en','about.story_p3','We want to raise awareness about the importance of respecting the land and consuming products with as few pesticides as possible. For future generations and for today.'],
  ['zh','about.story_p3','我们希望提高对尊重土地和消费尽量少农药产品重要性的认识。既为了未来的世代，也为了今天。'],
  ['so','about.story_p3','Waxaan doonaynaa in aan u xasaasiyayno dadka muhiimadda ay leedahay in la xurmadiyo dhulka iyo badeecadaha aan xasaarooyin lahayn.'],
  ['aa','about.story_p3','Lafa kabajuu fi xasaaroo xiqqoo ta\'een omishame qabdu bituu barbaachisummaa saba barsiisuu barbaadna.'],
  ['am','about.story_p3','መሬቱን ስለማክበር እና ፀረ-ተባይ-ነጻ ምርቶችን ስለጠቀሜታ ግንዛቤ ለማስጨበጥ እንፈልጋለን።'],

  // learnMore update
  ['en','learnMore','Who are we?'],
  ['zh','learnMore','我们是谁？'],
  ['so','learnMore','Yaan nahay?'],
  ['aa','learnMore','Eenyu taana?'],
  ['am','learnMore','እኛ ማን ነን?'],
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
  // Insert one by one to avoid batch conflicts
  let ok = 0, fail = 0;
  for (const [language_code, key, value] of rows) {
    const res = await upsert([{ language_code, key, value }]);
    if (res.status === 201 || res.status === 200) {
      ok++;
    } else {
      console.log(`FAIL [${language_code}] ${key}: ${res.status} ${res.body.slice(0,100)}`);
      fail++;
    }
  }
  console.log(`Done: ${ok} ok, ${fail} failed`);
}

main().catch(console.error);
