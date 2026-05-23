const https = require('https');

const SUPABASE_URL = 'sneuexxysxlwpokhkjho.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZXVleHh5c3hsd3Bva2hramhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc1Mzc5OSwiZXhwIjoyMDk0MzI5Nzk5fQ.w9Cq_gPz4OIIjFKOx2mlyLnqERSCe-3p6SYILmb1HJs';

const rows = [
  // --- about.tag ---
  ['en','about.tag','Our mission'],
  ['zh','about.tag','我们的使命'],
  ['so','about.tag','Ujeedadayada'],
  ['aa','about.tag','Kaayyoo keenya'],
  ['am','about.tag','ተልዕኳችን'],

  // --- about.hero_title ---
  ['en','about.hero_title','Eat better,'],
  ['zh','about.hero_title','吃得更好，'],
  ['so','about.hero_title','Cun si fiican,'],
  ['aa','about.hero_title','Woyitinni miidi,'],
  ['am','about.hero_title','በተሻለ ይመገቡ,'],

  // --- about.hero_title2 ---
  ['en','about.hero_title2','live better'],
  ['zh','about.hero_title2','生活更好'],
  ['so','about.hero_title2','noolow si fiican'],
  ['aa','about.hero_title2','woyitinni jiraa'],
  ['am','about.hero_title2','በተሻለ ይኑሩ'],

  // --- about.hero_desc ---
  ['en','about.hero_desc','Hornafresh was born from a simple conviction: in Africa, the first medicine is what we eat. We are building a circular economy around living things — for producers, for consumers, for the planet.'],
  ['zh','about.hero_desc','Hornafresh诞生于一个简单的信念：在非洲，第一药物就是我们所吃的东西。我们正在围绕生命构建循环经济——为生产者、消费者和地球。'],
  ['so','about.hero_desc','Hornafresh waxay ka dhashay xukun fudud: Afrika, dawooyinka ugu horreeya waa waxa aanu cunno. Waxaan dhisaynaa dhaqaale wareeg ah oo ku wareegsan noolaha — beeralayda, macaamiisha, dunida.'],
  ['aa','about.hero_desc','Hornafresh goroo galataa: Afirikaa keessa, dawaa duraa mee midaanu miidinu. Ekonomii diriiraa noolettii-barraa dhiibna — oomishitoota, bitantoota, addunyaaf.'],
  ['am','about.hero_desc','Hornafresh ከቀላል እምነት ተወለደ፡ በአፍሪካ፣ የመጀመሪያ መድሃኒት የምንበላው ምግብ ነው። ለአምራቾች፣ ለሸማቾች፣ ለፕላኔቷ — ዙርያዊ ኢኮኖሚ እየገነባን ነን።'],

  // --- about.story_tag ---
  ['en','about.story_tag','Our story'],
  ['zh','about.story_tag','我们的故事'],
  ['so','about.story_tag','Sheekadayada'],
  ['aa','about.story_tag','Seenaa keenya'],
  ['am','about.story_tag','ታሪካችን'],

  // --- about.story_title ---
  ['en','about.story_title','A social and ecological project, first and foremost'],
  ['zh','about.story_title','首先是一个社会和生态项目'],
  ['so','about.story_title','Mashruuc bulsheed iyo deegaan ah, ka horreeya wax kale'],
  ['aa','about.story_title','Pirojektii hawaasaa fi ekoolojiitii, duraa duuba'],
  ['am','about.story_title','ማህበራዊ እና ኢኮሎጂካዊ ፕሮጀክት፣ ከሁሉ በፊት'],

  // --- about.story_p1 ---
  ['en','about.story_p1','In Djibouti, as in many African countries, the healthcare system remains under pressure. Yet a large part of chronic diseases — diabetes, hypertension, cardiovascular diseases — can be prevented by a healthy and natural diet.'],
  ['zh','about.story_p1','在吉布提，与许多非洲国家一样，医疗系统仍承受压力。然而，很大一部分慢性疾病——糖尿病、高血压、心血管疾病——可以通过健康自然的饮食来预防。'],
  ['so','about.story_p1','Jabuuti, sida dalalka Afrika ee badan, nidaamka caafimaadku weli wuxuu ku jiraa cadaadis. Hase yeeshee, qayb weyn oo ka mid ah cudurrada joogtada ah — sonkorow, dhiig-karka, cudurrada wadnaaha — waa laga hortagi karaa cunto caafimaad leh oo dabiiciga ah.'],
  ['aa','about.story_p1','Jabuutii, Afirikaa biyya baay\'ee keessa fakkaatee, naga\'ee fayyaa pireeshara jala jira. Garuu, dhibee yeroo dheeraa baay\'oo — shaakara, dhiigni ol ka\'uu, dhibee wadaa — nyaata fayyaa fi dabiicaatiin hanqaachuu danda\'ama.'],
  ['am','about.story_p1','ጅቡቲ፣ እንደ ብዙ አፍሪካ አገሮች፣ የጤና ስርዓቱ ጫና ውስጥ ይቀጥላል። ሆኖም፣ ከሥር የሰደዱ ብዙ ሕመሞች — የስኳር ሕመም፣ ከፍተኛ ደም ግፊት፣ የልብ ሕመሞች — በጤናማ እና ተፈጥሯዊ አመጋገብ ሊከላከሉ ይችላሉ።'],

  // --- about.story_p2 ---
  ['en','about.story_p2','Hornafresh was born from this conviction: having access to fresh, local and pesticide-free fruits, vegetables and dairy products should not be a luxury. It is a right. And an act of prevention.'],
  ['zh','about.story_p2','Hornafresh诞生于这一信念：获得新鲜、当地且无农药的水果、蔬菜和乳制品不应该是一种奢侈。这是一种权利。也是一种预防行为。'],
  ['so','about.story_p2','Hornafresh waxay ka dhashay xukunkaan: helitaanka miraha, khudaarta iyo caanaha cusub, maxalliga ah oo aan lahayn xasaarooyin sharci ahaan lagama maarmaanka ah. Xuquuq ayay tahay. Ficil kahortagid ah.'],
  ['aa','about.story_p2','Hornafresh goroo kanaa ka dhalate: inni, qaamee fi xasaaroo malee muduraa, kuduraa fi aanniichaa argachuun reefaa ta\'uu hin qabu. Mirga dha. Hanqaatinni gocha dhaa.'],
  ['am','about.story_p2','Hornafresh ከዚህ እምነት ተወለደ፡ ትኩስ፣ አካባቢያዊ እና ፀረ-ተባይ-ነጻ ፍራፍሬዎች፣ አትክልቶች እና የወተት ተዋጽኦዎችን ማግኘት ቅንጦት ሊሆን አይገባም። እሱ መብት ነው። እና የመከላከል ተግባር።'],

  // --- about.story_p3 ---
  ['en','about.story_p3','We also want to raise awareness among populations about the importance of respecting the land and consuming products grown with as few chemical inputs as possible. For future generations as much as for today.'],
  ['zh','about.story_p3','我们还希望提高民众对尊重土地和消费尽可能少化学投入物种植产品的重要性的认识。既为了未来的世代，也为了今天。'],
  ['so','about.story_p3','Sidoo kale waxaan doonaynaa in aan u xasaasiyayno dadka muhiimadda ay leedahay in la xurmadiyo dhulka iyo in la isticmaalo badeecadaha lagu beeray ugu yar waxa kimikada ah. Xilligaan iyo jiilalka mustaqbalka.'],
  ['so','about.story_p3','Sidoo kale waxaan doonaynaa in aan u xasaasiyayno dadka muhiimadda ay leedahay in la xurmadiyo dhulka iyo in la isticmaalo badeecadaha lagu beeray ugu yar waxa kimikada ah.'],
  ['aa','about.story_p3','Lafa kabajuu fi xasaaroo xiqqoo ta\'een omishame qabdu bituu barbaachisummaa saba barsiisuu barbaadnas. Har\'a fi dhaloota boruuf wal qixa.'],
  ['am','about.story_p3','ህዝቦቹ መሬቱን ስለማክበር እና በተቻለ መጠን ጥቂት ኬሚካላዊ ግብዓቶች ስለተዘሩ ምርቶች ስለጠቀሜታ ግንዛቤ ለማስጨበጥ እንፈልጋለን። ለዛሬ ትውልድ እና ለወደፊቱ ትውልዶች።'],

  // --- about.value1-4 ---
  ['en','about.value1','Pesticide-free'],
  ['zh','about.value1','无农药'],
  ['so','about.value1','Xasaarooyin la\'aanta'],
  ['aa','about.value1','Xasaaroo malee'],
  ['am','about.value1','ፀረ-ተባይ-ነጻ'],

  ['en','about.value2','Organic farming'],
  ['zh','about.value2','有机农业'],
  ['so','about.value2','Beeraha dabiiciga ah'],
  ['aa','about.value2','Qonnaa orgaanikii'],
  ['am','about.value2','ኦርጋኒክ እርሻ'],

  ['en','about.value3','Preventive health'],
  ['zh','about.value3','预防性健康'],
  ['so','about.value3','Caafimaadka kahortagga'],
  ['aa','about.value3','Fayyaa hanqaatinaa'],
  ['am','about.value3','ፕሪቬንቲቭ ጤና'],

  ['en','about.value4','Fair trade'],
  ['zh','about.value4','公平贸易'],
  ['so','about.value4','Ganacsiga xaqa ah'],
  ['aa','about.value4','Daldala qaxxaamuraa'],
  ['am','about.value4','ፍትሃዊ ንግድ'],

  // --- pillars ---
  ['en','about.pillars_tag','Our commitments'],
  ['zh','about.pillars_tag','我们的承诺'],
  ['so','about.pillars_tag','Ballanqaadyadeenna'],
  ['aa','about.pillars_tag','Waadaa keenna'],
  ['am','about.pillars_tag','ቃላችን'],

  ['en','about.pillars_title','Three pillars, one vision'],
  ['zh','about.pillars_title','三大支柱，一个愿景'],
  ['so','about.pillars_title','Saddex tiir, hal aragtido'],
  ['aa','about.pillars_title','Sadii utubaa, mul\'ata tokko'],
  ['am','about.pillars_title','ሶስት ምሰሶዎች፣ አንድ ራዕይ'],

  ['en','about.pillar1_title','Health through food'],
  ['zh','about.pillar1_title','通过食物促进健康'],
  ['so','about.pillar1_title','Caafimaadka iyada oo loo marayo cuntada'],
  ['aa','about.pillar1_title','Nyaataan fayyaa'],
  ['am','about.pillar1_title','ምግብ በኩል ጤና'],

  ['en','about.pillar1_desc','In Africa, prevention is the best remedy. We deeply believe that eating fresh fruits, vegetables and dairy products, without pesticides, is the first act of public health. Hornafresh is preventive medicine on your plate.'],
  ['zh','about.pillar1_desc','在非洲，预防是最好的治疗。我们深信，食用新鲜水果、蔬菜和乳制品，不含农药，是公共卫生的第一步。Hornafresh是您盘中的预防医学。'],
  ['so','about.pillar1_desc','Afrika, kahortagga ayaa ah dawada ugu wanaagsan. Waxaan si qoto dheer u rumaysanahay in cunista miraha, khudaarta iyo caanaha cusub, oo aan lahayn xasaarooyin, tahay ficilka ugu horeeyey ee caafimaadka dadweynaha. Hornafresh waa dawo kahortagga saxanka aad ku qabtid.'],
  ['aa','about.pillar1_desc','Afirikaa, hanqaatinni dawaa gaarii dha. Xasaaroo malee muduraa, kuduraa fi aanniichaa cusaa nyaachuun caafimaad hawaasaa gochaa duraa ta\'uu cimamanna. Hornafresh mi\'oo kee irratti dawaa hanqaatinaa dha.'],
  ['am','about.pillar1_desc','በአፍሪካ፣ መከላከል ምርጥ መድሃኒት ነው። ፀረ-ተባይ-ነጻ ትኩስ ፍራፍሬዎችን፣ አትክልቶችን እና የወተት ተዋጽኦዎችን መብላት የህዝብ ጤና የመጀመሪያ ተግባር ነው ብለን እናምናለን። Hornafresh በሳህንዎ ላይ ፕሪቬንቲቭ መድሃኒት ነው።'],

  ['en','about.pillar2_title','Ecology as our compass'],
  ['zh','about.pillar2_title','以生态为指南'],
  ['so','about.pillar2_title','Deegaanka sidii qoflan'],
  ['aa','about.pillar2_title','Ekooloojiin qilleensa keenya'],
  ['am','about.pillar2_title','ስነ-ምህዳር እንደ ኮምፓሳችን'],

  ['en','about.pillar2_desc','We promote organic, responsible farming that respects land and nature. Fewer pesticides, more life in the soil. Each partner producer commits to a sustainable agricultural approach, and we support them every step of the way.'],
  ['zh','about.pillar2_desc','我们提倡有机、负责任的农业，尊重土地和自然。更少的农药，土壤中更多的生命。每个合作伙伴生产者都致力于可持续的农业方法，我们在每一步都支持他们。'],
  ['so','about.pillar2_desc','Waxaan dhajinayaa beeraha dabiiciga ah, mas\'uulka ah ee xurmaynaya dhulka iyo dabiiciga. Xasaarooyin yar, nolol badan oo ku jirta ciidda. Beerale kasta oo gacansiyaale ah wuxuu ku xidnaa hab beereed joogto ah, waxaannu ku taagnaa tallaabooyinkiisa kasta.'],
  ['aa','about.pillar2_desc','Lafa fi uumama kabaju qonnaa orgaanikii fi itti gaafatamaa guddifna. Xasaaroo xiqqoo, lafa keessaa jiruu hedduu. Oomishituu walii hirmaataa qonnaa itti fufiinsa qabdu gochaaf waadaa seena, hunda keessatti isaan gargaarra.'],
  ['am','about.pillar2_desc','መሬቱን እና ተፈጥሮን የሚያከብር ኦርጋኒክ፣ ኃላፊነት የሚሰማው እርሻን እናበረታታለን። ያነሰ ፀረ-ተባይ፣ በአፈሩ ውስጥ ያለ ሕይወት። እያንዳንዱ አጋር አምራች ዘላቂ የግብርና አካሄድ ለመከተል ቃል ይገባል፣ እና እኛ በእያንዳንዱ ደረጃ እናግዛለን።'],

  ['en','about.pillar3_title','A circular economy'],
  ['zh','about.pillar3_title','循环经济'],
  ['so','about.pillar3_title','Dhaqaale wareeg ah'],
  ['aa','about.pillar3_title','Ekonomii diriiraa'],
  ['am','about.pillar3_title','ዙርያዊ ኢኮኖሚ'],

  ['en','about.pillar3_desc','The producer sells us their products. We provide them with organic fertilizers, agronomic advice and access to a direct market. Unsold fruits and vegetables are transformed — jams, yogurts, preserves — for zero waste. The money stays in the local community.'],
  ['zh','about.pillar3_desc','生产者向我们出售产品。我们为他们提供有机肥料、农学建议和直接市场准入。未售出的水果和蔬菜被转化——果酱、酸奶、罐头——实现零浪费。钱留在当地社区。'],
  ['so','about.pillar3_desc','Beeralayda ayaa naga iibinaya badeecadooda. Waxaan siinaa bacriminta dabiiciga ah, talooyin beereed iyo helitaanka suuq toos ah. Miraha iyo khudaarta aan la iibin waa la beddeshaa — marmaleys, yogurt, keymo — eber nacasnaan la\'aan. Lacagtu waxay ku jirtaa bulshada maxalliga ah.'],
  ['aa','about.pillar3_desc','Oomishitoonni biyya isaaniitii nuu gurgurtu. Mancaa orgaanikii, gorsa qonnaa fi suuqa tooskii heluu kennaaf. Gurguramaan muduraa fi kuduraan jijjiirama — jaami, yogurt, konfarves — qisaasa malee. Maallaqa biyya hawaasa keessaa jira.'],
  ['am','about.pillar3_desc','አምራቹ ምርቶቻቸውን ይሸጡልናል። እኛ ኦርጋኒክ ማዳበሪያዎችን፣ የግብርና ምክሮችን እና ቀጥተኛ ገበያ ያቀርባለን። ያልተሸጡ ፍራፍሬዎች እና አትክልቶች ይቀየራሉ — ማርማሌዶች፣ እርጎ፣ ጠርሙዞች — ምንም ብክነት የለም። ገንዘቡ በአካባቢው ማህበረሰብ ውስጥ ይቆያል።'],

  // --- cycle ---
  ['en','about.cycle_tag','The Hornafresh model'],
  ['zh','about.cycle_tag','Hornafresh模式'],
  ['so','about.cycle_tag','Qaabka Hornafresh'],
  ['aa','about.cycle_tag','Moodeela Hornafresh'],
  ['am','about.cycle_tag','የ Hornafresh ሞዴል'],

  ['en','about.cycle_title','An economy that loops'],
  ['zh','about.cycle_title','循环运转的经济'],
  ['so','about.cycle_title','Dhaqaale wareegsan'],
  ['aa','about.cycle_title','Ekonomii naannoo naannoo deemtu'],
  ['am','about.cycle_title','የሚዞር ኢኮኖሚ'],

  ['en','about.cycle_sub','Every purchase strengthens the cycle — producers, consumers and nature all benefit.'],
  ['zh','about.cycle_sub','每次购买都加强了这个循环——生产者、消费者和自然都从中受益。'],
  ['so','about.cycle_sub','Iibsi kasta wuxuu xoojiyaa wareegga — beeralayda, macaamiisha iyo dabiicigu dhammaantood waxay ka faa\'iidaystaan.'],
  ['aa','about.cycle_sub','Bitaa tokko tokko naannoo ni jabeessa — oomishitoota, bitantoota fi uumamni hundi ni fayyadamu.'],
  ['am','about.cycle_sub','እያንዳንዱ ግዢ ዑደቱን ያጠናክራል — አምራቾች፣ ሸማቾች እና ተፈጥሮ ሁሉም ይጠቀማሉ።'],

  ['en','about.cycle1','The producer grows'],
  ['zh','about.cycle1','生产者种植'],
  ['so','about.cycle1','Beeralayda ayaa beereysa'],
  ['aa','about.cycle1','Oomishitoonni ni omishu'],
  ['am','about.cycle1','አምራቹ ያመርታል'],

  ['en','about.cycle1_desc','Organic, pesticide-free farming'],
  ['zh','about.cycle1_desc','有机无农药农业'],
  ['so','about.cycle1_desc','Beeraha dabiiciga ah, xasaarooyin la\'aanta'],
  ['aa','about.cycle1_desc','Qonnaa orgaanikii, xasaaroo malee'],
  ['am','about.cycle1_desc','ኦርጋኒክ፣ ፀረ-ተባይ-ነጻ እርሻ'],

  ['en','about.cycle2','Hornafresh buys'],
  ['zh','about.cycle2','Hornafresh购买'],
  ['so','about.cycle2','Hornafresh ayaa iibsanaysa'],
  ['aa','about.cycle2','Hornafresh ni bite'],
  ['am','about.cycle2','Hornafresh ይገዛል'],

  ['en','about.cycle2_desc','Fair price, fast payment'],
  ['zh','about.cycle2_desc','公平价格，快速支付'],
  ['so','about.cycle2_desc','Qiime xaq ah, lacag degdeg ah'],
  ['aa','about.cycle2_desc','Gatii qaxxaamuraa, kafaltii ariifataa'],
  ['am','about.cycle2_desc','ፍትሃዊ ዋጋ፣ ፈጣን ክፍያ'],

  ['en','about.cycle3','You receive'],
  ['zh','about.cycle3','您收到'],
  ['so','about.cycle3','Adiga ayaad helaysaa'],
  ['aa','about.cycle3','Ati ni fuudda'],
  ['am','about.cycle3','እርስዎ ይቀበላሉ'],

  ['en','about.cycle3_desc','Fresh, local, in 48h'],
  ['zh','about.cycle3_desc','新鲜、当地，48小时内'],
  ['so','about.cycle3_desc','Cusub, maxallig ah, 48 saac gudahood'],
  ['aa','about.cycle3_desc','Cusaa, naannoo, saʼaatii 48 keessatti'],
  ['am','about.cycle3_desc','ትኩስ፣ አካባቢያዊ፣ በ48 ሰዓት'],

  ['en','about.cycle4','We reinvest'],
  ['zh','about.cycle4','我们再投资'],
  ['so','about.cycle4','Waxaan dib u maalgalinayaa'],
  ['aa','about.cycle4','Deebisanii invastii goona'],
  ['am','about.cycle4','እኛ እንደገና እናውቃቀምዛለን'],

  ['en','about.cycle4_desc','Organic fertilizers, advice, training'],
  ['zh','about.cycle4_desc','有机肥料、建议、培训'],
  ['so','about.cycle4_desc','Bacriminta dabiiciga ah, talosyo, tababar'],
  ['aa','about.cycle4_desc','Mancaa orgaanikii, gorsa, leenjii'],
  ['am','about.cycle4_desc','ኦርጋኒክ ማዳበሪያ፣ ምክር፣ ስልጠና'],

  // --- anti-gaspi ---
  ['en','about.antigaspi_title','Zero waste'],
  ['zh','about.antigaspi_title','零浪费'],
  ['so','about.antigaspi_title','Eber nacasnaan'],
  ['aa','about.antigaspi_title','Qisaasa dhibbaa'],
  ['am','about.antigaspi_title','ዜሮ ብክነት'],

  ['en','about.antigaspi_desc','Unsold fruits and vegetables do not go to waste. We transform them into jams, yogurts, preserves and other value-added products — reducing losses and creating new income for producers.'],
  ['zh','about.antigaspi_desc','未售出的水果和蔬菜不会浪费。我们将其转化为果酱、酸奶、罐头和其他增值产品——减少损失并为生产者创造新收入。'],
  ['so','about.antigaspi_desc','Miraha iyo khudaarta aan la iibin kuma baabbi\'aan. Waxaan u beddelnaa marmaleys, yogurt, keymo iyo waxyaabo kale oo qiima leh — hoos u dhigida khasaaraha iyo abuuritaanka dakhli cusub oo loogu talagalay beeralayda.'],
  ['aa','about.antigaspi_desc','Gurguramaan muduraa fi kuduraan baduuf hin deemtu. Jaami, yogurt, konfarves fi midhaa gatii dabalamaatiin birootii gara jijjiirra — kasaara hir\'isuuf fi oomishitoota galii haaraa uumuuf.'],
  ['am','about.antigaspi_desc','ያልተሸጡ ፍራፍሬዎች እና አትክልቶች ወደ ቆሻሻ አይሄዱም። ወደ ማርማሌዶች፣ እርጎ፣ ጠርሙዞች እና ሌሎች እሴት-ተጨማሪ ምርቶች ይቀይሯቸዋለን — ኪሳራዎችን በመቀነስ እና ለአምራቾች አዲስ ገቢ በመፍጠር።'],

  // --- vision ---
  ['en','about.vision_title','Our long-term vision'],
  ['zh','about.vision_title','我们的长期愿景'],
  ['so','about.vision_title','Aragtidayada dheer'],
  ['aa','about.vision_title','Mul\'ata keenya dheeraa'],
  ['am','about.vision_title','የረጅም ጊዜ ራዕያችን'],

  ['en','about.vision_desc','To make Djibouti a model of circular, biological food economy for the region. That every family has access to healthy products. That every farmer can live with dignity from their work while respecting the land. That prevention through food becomes a cultural reflex.'],
  ['zh','about.vision_desc','使吉布提成为该地区循环生物食品经济的典范。每个家庭都能获得健康产品。每位农民都能在尊重土地的同时有尊严地生活。通过食物预防成为一种文化反射。'],
  ['so','about.vision_desc','In Jabuuti laga dhigo qaabka dhaqaalaha cuntada wareegsan iyo baayoolajiga ee gobolka. In qoys kasta heli karo badeecadaha caafimaadka. In beerale kasta ku noolaan karo si sharaf leh shaqadiisa isaga oo xurmaynaya dhulka. In kahortagga cuntada uu noqdo falcelinta dhaqanka.'],
  ['aa','about.vision_desc','Jabuutii naannoo dhaqaa nyaataa diriiraa fi orgaanikii fakeenyaa taʼuu. Maatiin tokko tokko qabdu fayyaa heluu. Qonnaan bulaan tokko tokko lafa kabajaa hojjetee kabajaan jiraachuu danda\'uu. Nyaataan hanqaatinni aadaa falcaʼii taʼuu.'],
  ['am','about.vision_desc','ጅቡቲን ለክልሉ ዙርያዊ፣ ባዮሎጂካዊ የምግብ ኢኮኖሚ ሞዴል ማድረግ። እያንዳንዱ ቤተሰብ ጤናማ ምርቶችን እንዲያገኝ። እያንዳንዱ አርሶ አደር መሬቱን እያከበረ ሥራውን በክብር ሊኖር እንዲችል። ምግብ በኩል መከላከል የባህል ምላሽ እንዲሆን።'],

  // --- CTAs ---
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
  ['aa','about.back_home','Fuulaa duraa deebi\'aa'],
  ['am','about.back_home','ወደ መነሻ ተመለስ'],

  // --- learnMore (hero button) ---
  ['en','learnMore','Who are we?'],
  ['zh','learnMore','我们是谁？'],
  ['so','learnMore','Yaan nahay?'],
  ['aa','learnMore','Eenyu taana?'],
  ['am','learnMore','እኛ ማን ነን?'],
];

function post(body) {
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
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const payload = rows.map(([language_code, key, value]) => ({ language_code, key, value }));
  // Insert in batches of 50
  for (let i = 0; i < payload.length; i += 50) {
    const batch = payload.slice(i, i + 50);
    const res = await post(batch);
    console.log(`Batch ${Math.floor(i/50)+1}: ${res.status} — ${res.body.slice(0,80)}`);
  }
  console.log('Done!');
}

main().catch(console.error);
