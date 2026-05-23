-- =============================================================
-- Racine Bio — Traductions UI complètes
-- Colonne correcte : language_code (pas lang)
-- Langues : en, zh, so, aa, am  (fr = fallbacks codés dans le code)
-- Exécuter dans Supabase Dashboard → SQL Editor
-- Sûr à rejouer : ON CONFLICT DO NOTHING
-- =============================================================

INSERT INTO ui_translations (language_code, key, value) VALUES

-- ============================================================
-- HEADER / NAV
-- ============================================================
('en','footer','The organic market of Djibouti'),
('zh','footer','吉布提有机市场'),
('so','footer','Suuqa dabiiciga ah ee Jabuuti'),
('aa','footer','Gabuutih naaturraalaa giyyo'),
('am','footer','የጂቡቲ ኦርጋኒክ ገበያ'),

('en','products','Products'),
('zh','products','产品'),
('so','products','Badeecadaha'),
('aa','products','Oomishoota'),
('am','products','ምርቶች'),

('en','producers','Producers'),
('zh','producers','生产者'),
('so','producers','Beeraleyda'),
('aa','producers','Oomishittoota'),
('am','producers','አምራቾች'),

('en','promos','Promotions'),
('zh','promos','促销'),
('so','promos','Deeqaha'),
('aa','promos','Deeqaha'),
('am','promos','ማስተዋወቂያዎች'),

('en','login','Sign in'),
('zh','login','登录'),
('so','login','Gal'),
('aa','login','Gali'),
('am','login','ግባ'),

('en','register','Sign up'),
('zh','register','注册'),
('so','register','Is diiwaangeli'),
('aa','register','Gartisi'),
('am','register','ተመዝገቡ'),

('en','favorites','My favorites'),
('zh','favorites','我的收藏'),
('so','favorites','Jecelaanshahayga'),
('aa','favorites','Jaalatamantoo koo'),
('am','favorites','የእኔ ተወዳጆች'),

('en','rights','All rights reserved'),
('zh','rights','版权所有'),
('so','rights','Xuquuqda oo dhan way dhawrsanyihiin'),
('aa','rights','Mirgoota hunda qabame'),
('am','rights','መብቶቹ ሁሉ የተጠበቁ ናቸው'),

-- ============================================================
-- HERO SECTION
-- ============================================================
('en','heroTag','Fresh products from Djibouti and the region'),
('zh','heroTag','来自吉布提及周边地区的新鲜产品'),
('so','heroTag','Badeecadaha cusub ee Jabuuti iyo gobolka'),
('aa','heroTag','Gabuutih xagge naannoo miiltu oomishoota horoo'),
('am','heroTag','ከጂቡቲ እና አካባቢ ትኩስ ምርቶች'),

('en','tagline','Find your'),
('zh','tagline','找到您的'),
('so','tagline','Hel'),
('aa','tagline','Argadhu'),
('am','tagline','ያግኙ'),

('en','tagline2','vegetables'),
('zh','tagline2','蔬菜'),
('so','tagline2','khudradda'),
('aa','tagline2','kuduraa'),
('am','tagline2','አትክልቶች'),

('en','tagline3','and fruits of the day'),
('zh','tagline3','和当日水果'),
('so','tagline3','iyo miraha maalinta'),
('aa','tagline3','xagge guyyaa midhaa'),
('am','tagline3','እና የቀኑ ፍራፍሬዎች'),

('en','heroSub','Organic, conventional, local — all fresh products delivered directly from Djiboutian farms.'),
('zh','heroSub','有机、传统、本地 — 所有新鲜产品直接从吉布提农场配送。'),
('so','heroSub','Dabiici, caadi, maxaliga — dhammaan badeecadaha cusub waxaa laga keenaa beer-beerta Jabuuriyiinta.'),
('aa','heroSub','Naaturraalaa, aadaa, naannoo — oomishoota horoo hundi Gabuutih beeralee karraa geessame.'),
('am','heroSub','ኦርጋኒክ፣ ተለምዷዊ፣ ሀገር-ውስጥ — ሁሉም ትኩስ ምርቶች ከጂቡቲ እርሻዎች ቀጥታ ይቀርባሉ።'),

('en','orderNow','Order now'),
('zh','orderNow','立即订购'),
('so','orderNow','Dalabo hadda'),
('aa','orderNow','Amma ajandi'),
('am','orderNow','አሁን ያዝዙ'),

('en','learnMore','Learn more'),
('zh','learnMore','了解更多'),
('so','learnMore','Wax dheeraad ah ogow'),
('aa','learnMore','Caalu beeki'),
('am','learnMore','ተጨማሪ ይወቁ'),

-- ============================================================
-- STATS BAR
-- ============================================================
('en','freshProducts','Fresh products'),
('zh','freshProducts','新鲜产品'),
('so','freshProducts','Badeecadaha cusub'),
('aa','freshProducts','Oomishoota horoo'),
('am','freshProducts','ትኩስ ምርቶች'),

('en','localProductsCount','Local products'),
('zh','localProductsCount','本地产品'),
('so','localProductsCount','Badeecadaha maxaliga'),
('aa','localProductsCount','Naannoo oomishoota'),
('am','localProductsCount','የአካባቢ ምርቶች'),

('en','fastDelivery','Fast delivery'),
('zh','fastDelivery','快速配送'),
('so','fastDelivery','Geyn degdeg ah'),
('aa','fastDelivery','Sigetti geeshi'),
('am','fastDelivery','ፈጣን ዴሊቨሪ'),

-- ============================================================
-- PRODUCTS SECTION / FILTERS
-- ============================================================
('en','allProducts','All products'),
('zh','allProducts','所有产品'),
('so','allProducts','Dhammaan badeecadaha'),
('aa','allProducts','Oomishoota hundi'),
('am','allProducts','ሁሉም ምርቶች'),

('en','localProducts','Products from Djibouti'),
('zh','localProducts','吉布提产品'),
('so','localProducts','Badeecadaha Jabuuti'),
('aa','localProducts','Gabuutih oomishoota'),
('am','localProducts','ከጂቡቲ ምርቶች'),

('en','seeAll','See all'),
('zh','seeAll','查看全部'),
('so','seeAll','Dhammaantood arag'),
('aa','seeAll','Hundi ilaali'),
('am','seeAll','ሁሉንም ይዩ'),

('en','ourProducers','Our producers'),
('zh','ourProducers','我们的生产者'),
('so','ourProducers','Beeraleyda'),
('aa','ourProducers','Oomishittootankoo'),
('am','ourProducers','አምራቾቻችን'),

('en','search','Search...'),
('zh','search','搜索...'),
('so','search','Raadi...'),
('aa','search','Kaiyi...'),
('am','search','ፈልግ...'),

('en','allCountries','All countries'),
('zh','allCountries','所有国家'),
('so','allCountries','Dhammaan wadamada'),
('aa','allCountries','Biyyoota hundi'),
('am','allCountries','ሁሉም አገሮች'),

('en','filter.all','All'),
('zh','filter.all','全部'),
('so','filter.all','Dhammaan'),
('aa','filter.all','Hunda'),
('am','filter.all','ሁሉ'),

('en','filter.bio','Organic'),
('zh','filter.bio','有机'),
('so','filter.bio','Dabiici'),
('aa','filter.bio','Naaturraalaa'),
('am','filter.bio','ኦርጋኒክ'),

('en','filter.conv','Conventional'),
('zh','filter.conv','传统'),
('so','filter.conv','Caadi'),
('aa','filter.conv','Aadaa'),
('am','filter.conv','ተለምዷዊ'),

('en','filter.all_categories','All categories'),
('zh','filter.all_categories','所有分类'),
('so','filter.all_categories','Dhammaan qeybaha'),
('aa','filter.all_categories','Qeebbitoota hundi'),
('am','filter.all_categories','ሁሉም ምድቦች'),

('en','home.no_products','No products found'),
('zh','home.no_products','未找到产品'),
('so','home.no_products','Lama helin badeecad'),
('aa','home.no_products','Oomishshi argame hixinne'),
('am','home.no_products','ምርት አልተገኘም'),

('en','home.reset_filters','Reset'),
('zh','home.reset_filters','重置'),
('so','home.reset_filters','Dib u dejii'),
('aa','home.reset_filters','Deebisi'),
('am','home.reset_filters','ዳግም አስጀምር'),

-- ============================================================
-- ORIGIN / COUNTRY NAMES
-- ============================================================
('en','origin.DJ','Djibouti'),
('zh','origin.DJ','吉布提'),
('so','origin.DJ','Jabuuti'),
('aa','origin.DJ','Gabuutih'),
('am','origin.DJ','ጂቡቲ'),

('en','origin.ET','Ethiopia'),
('zh','origin.ET','埃塞俄比亚'),
('so','origin.ET','Itoobiya'),
('aa','origin.ET','Itoophiyaa'),
('am','origin.ET','ኢትዮጵያ'),

('en','origin.SO','Somalia'),
('zh','origin.SO','索马里'),
('so','origin.SO','Soomaaliya'),
('aa','origin.SO','Somaaliyaa'),
('am','origin.SO','ሶማሊያ'),

('en','origin.YE','Yemen'),
('zh','origin.YE','也门'),
('so','origin.YE','Yaman'),
('aa','origin.YE','Yamaniin'),
('am','origin.YE','የመን'),

('en','origin.FR','France'),
('zh','origin.FR','法国'),
('so','origin.FR','Faransiiska'),
('aa','origin.FR','Faransaayii'),
('am','origin.FR','ፈረንሳይ'),

-- ============================================================
-- FOOTER / DOWNLOAD
-- ============================================================
('en','downloadApp','Download the app'),
('zh','downloadApp','下载应用'),
('so','downloadApp','Soo deji app-ka'),
('aa','downloadApp','App-icha buuxi'),
('am','downloadApp','መተግበሪያ ያውርዱ'),

('en','downloadSub','Shop anytime, anywhere'),
('zh','downloadSub','随时随地购物'),
('so','downloadSub','Iibso goor kasta, meel kasta'),
('aa','downloadSub','Yeroo kamiyyuu, bakka kamiyyuu gatisi'),
('am','downloadSub','በማንኛውም ጊዜ፣ ከማንኛውም ቦታ ይሸምቱ'),

('en','downloadPlayStore','Get on Google Play'),
('zh','downloadPlayStore','在 Google Play 下载'),
('so','downloadPlayStore','Ka hel Google Play'),
('aa','downloadPlayStore','Google Play irraa argadhu'),
('am','downloadPlayStore','ከGoogle Play ያግኙ'),

-- ============================================================
-- CART
-- ============================================================
('en','cart','My cart'),
('zh','cart','我的购物车'),
('so','cart','Basket-kayga'),
('aa','cart','Kaaritaakoo'),
('am','cart','ቅርጫቴ'),

('en','cart.empty','Your cart is empty'),
('zh','cart.empty','您的购物车是空的'),
('so','cart.empty','Basket-kaagu waa madhan yahay'),
('aa','cart.empty','Kaaritaaki dooqu'),
('am','cart.empty','ቅርጫትዎ ባዶ ነው'),

('en','cart.continue','Continue shopping'),
('zh','cart.continue','继续购物'),
('so','cart.continue','Sii wad iibsashada'),
('aa','cart.continue','Gatissate itti fufi'),
('am','cart.continue','መሸቀጥ ቀጥል'),

('en','cart.total','Total'),
('zh','cart.total','总计'),
('so','cart.total','Wadarta'),
('aa','cart.total','Waxxi'),
('am','cart.total','ጠቅላላ'),

('en','cart.checkout','Checkout'),
('zh','cart.checkout','结账'),
('so','cart.checkout','Dalabso'),
('aa','cart.checkout','Ajandessi'),
('am','cart.checkout','ክፍያ'),

('en','cart.clear','Clear cart'),
('zh','cart.clear','清空购物车'),
('so','cart.clear','Madheey basket-ka'),
('aa','cart.clear','Kaaritaa teessi'),
('am','cart.clear','ቅርጫቱን አጽዳ'),

-- ============================================================
-- PRODUCT DETAIL
-- ============================================================
('en','product.breadcrumb_home','Home'),
('zh','product.breadcrumb_home','首页'),
('so','product.breadcrumb_home','Bogga hore'),
('aa','product.breadcrumb_home','Mana'),
('am','product.breadcrumb_home','ዋና ገፅ'),

('en','product.type_bio','Organic'),
('zh','product.type_bio','有机'),
('so','product.type_bio','Dabiici'),
('aa','product.type_bio','Naaturraalaa'),
('am','product.type_bio','ኦርጋኒክ'),

('en','product.type_conv','Conventional'),
('zh','product.type_conv','传统'),
('so','product.type_conv','Caadi'),
('aa','product.type_conv','Aadaa'),
('am','product.type_conv','ተለምዷዊ'),

('en','product.quantity','Quantity:'),
('zh','product.quantity','数量：'),
('so','product.quantity','Tirada:'),
('aa','product.quantity','Lakkoofsa:'),
('am','product.quantity','ብዛት:'),

('en','product.total','Total'),
('zh','product.total','总计'),
('so','product.total','Wadarta'),
('aa','product.total','Waxxi'),
('am','product.total','ጠቅላላ'),

('en','product.add_to_cart','Add to cart'),
('zh','product.add_to_cart','加入购物车'),
('so','product.add_to_cart','Ku dar basket-ka'),
('aa','product.add_to_cart','Kaaritaatti ida''i'),
('am','product.add_to_cart','ወደ ቅርጫት ጨምር'),

('en','product.local_badge','Local product'),
('zh','product.local_badge','本地产品'),
('so','product.local_badge','Badeecadda maxaliga ah'),
('aa','product.local_badge','Naannoo oomishsha'),
('am','product.local_badge','የአካባቢ ምርት'),

('en','product.bio_badge','Certified Organic'),
('zh','product.bio_badge','有机认证'),
('so','product.bio_badge','Dabiici ah oo la xaqiijiyey'),
('aa','product.bio_badge','Naaturraalaa mirkana''e'),
('am','product.bio_badge','የተረጋገጠ ኦርጋኒክ'),

('en','product.delivery_badge','48h Delivery'),
('zh','product.delivery_badge','48小时配送'),
('so','product.delivery_badge','Geyn 48 saac'),
('aa','product.delivery_badge','Saata 48 geeshi'),
('am','product.delivery_badge','48 ሰዓት ዴሊቨሪ'),

('en','product.similar','Similar products'),
('zh','product.similar','相似产品'),
('so','product.similar','Badeecadaha la mid ah'),
('aa','product.similar','Oomishsha walfakkaatan'),
('am','product.similar','ተመሳሳይ ምርቶች'),

-- ============================================================
-- LOGIN
-- ============================================================
('en','login.register_success','Account created! Check your email to confirm.'),
('zh','login.register_success','账户已创建！请检查您的电子邮件以确认。'),
('so','login.register_success','Xisaabta waa la sameeyey! Hubi email-kaaga si aad u xaqiijiso.'),
('aa','login.register_success','Akkaawuntichi tolame! Email keeti ilaali.'),
('am','login.register_success','መለያ ተፈጠረ! ለማረጋገጥ ኢሜልዎን ያረጋግጡ።'),

('en','login.create_account','✨ Create an account'),
('zh','login.create_account','✨ 创建账户'),
('so','login.create_account','✨ Samee akoon'),
('aa','login.create_account','✨ Akkaawunti toli'),
('am','login.create_account','✨ መለያ ፍጠር'),

('en','login.signin','👋 Login'),
('zh','login.signin','👋 登录'),
('so','login.signin','👋 Gal'),
('aa','login.signin','👋 Gali'),
('am','login.signin','👋 ግባ'),

('en','login.email','Email'),
('zh','login.email','邮箱'),
('so','login.email','Email'),
('aa','login.email','Email'),
('am','login.email','ኢሜይል'),

('en','login.email_placeholder','your@email.com'),
('zh','login.email_placeholder','your@email.com'),
('so','login.email_placeholder','email@kaaga.com'),
('aa','login.email_placeholder','email@keeti.com'),
('am','login.email_placeholder','your@email.com'),

('en','login.password','Password'),
('zh','login.password','密码'),
('so','login.password','Furaha sirta'),
('aa','login.password','Iccitii'),
('am','login.password','የሚስጥር ቁጥር'),

('en','login.loading','⏳ Loading...'),
('zh','login.loading','⏳ 加载中...'),
('so','login.loading','⏳ Rarida...'),
('aa','login.loading','⏳ Naqna...'),
('am','login.loading','⏳ በመጫን ላይ...'),

('en','login.create_btn','✅ Create my account'),
('zh','login.create_btn','✅ 创建我的账户'),
('so','login.create_btn','✅ Samee akoonkayga'),
('aa','login.create_btn','✅ Akkaawuntikoo toli'),
('am','login.create_btn','✅ መለያዬን ፍጠር'),

('en','login.signin_btn','🔑 Sign in'),
('zh','login.signin_btn','🔑 登录'),
('so','login.signin_btn','🔑 Gal'),
('aa','login.signin_btn','🔑 Gali'),
('am','login.signin_btn','🔑 ግባ'),

('en','login.already_account','Already have an account? Sign in'),
('zh','login.already_account','已有账户？登录'),
('so','login.already_account','Akoon ma haysaa? Gal'),
('aa','login.already_account','Akkaawunti qabdaa? Gali'),
('am','login.already_account','መለያ አለዎ? ግባ'),

('en','login.no_account','No account? Sign up'),
('zh','login.no_account','没有账户？注册'),
('so','login.no_account','Akoon ma lihid? Is diiwaangeli'),
('aa','login.no_account','Akkaawunti hixinootto? Gartisi'),
('am','login.no_account','መለያ የለዎtm? ተመዝገቡ'),

('en','login.back_home','← Back to home'),
('zh','login.back_home','← 返回首页'),
('so','login.back_home','← Ku laabo bogga hore'),
('aa','login.back_home','← Manna galti'),
('am','login.back_home','← ወደ ዋናው ገፅ ተመለስ'),

-- ============================================================
-- PROFILE
-- ============================================================
('en','profile.loading','Loading...'),
('zh','profile.loading','加载中...'),
('so','profile.loading','Rarida...'),
('aa','profile.loading','Naqna...'),
('am','profile.loading','በመጫን ላይ...'),

('en','profile.back','← Back'),
('zh','profile.back','← 返回'),
('so','profile.back','← Laabo'),
('aa','profile.back','← Galti'),
('am','profile.back','← ተመለስ'),

('en','profile.user_default','User'),
('zh','profile.user_default','用户'),
('so','profile.user_default','Isticmaale'),
('aa','profile.user_default','Macaangali'),
('am','profile.user_default','ተጠቃሚ'),

('en','profile.verified','✅ Verified account'),
('zh','profile.verified','✅ 已验证账户'),
('so','profile.verified','✅ Akoon la xaqiijiyey'),
('aa','profile.verified','✅ Akkaawunti xaqiiqame'),
('am','profile.verified','✅ የተረጋገጠ መለያ'),

('en','profile.stat_orders','Orders'),
('zh','profile.stat_orders','订单'),
('so','profile.stat_orders','Dalabyo'),
('aa','profile.stat_orders','Ajandooyye'),
('am','profile.stat_orders','ትዕዛዞች'),

('en','profile.stat_favorites','Favorites'),
('zh','profile.stat_favorites','收藏'),
('so','profile.stat_favorites','Jecelyada'),
('aa','profile.stat_favorites','Jaalatamanta'),
('am','profile.stat_favorites','ተወዳጆች'),

('en','profile.stat_reviews','Reviews'),
('zh','profile.stat_reviews','评价'),
('so','profile.stat_reviews','Dooodooyinka'),
('aa','profile.stat_reviews','Mablooyyee'),
('am','profile.stat_reviews','ግምገማዎች'),

('en','profile.my_favorites','My favorites'),
('zh','profile.my_favorites','我的收藏'),
('so','profile.my_favorites','Jecelaanshahayga'),
('aa','profile.my_favorites','Jaalatamantoo koo'),
('am','profile.my_favorites','የእኔ ተወዳጆች'),

('en','profile.see_all','See all'),
('zh','profile.see_all','查看全部'),
('so','profile.see_all','Dhammaantood arag'),
('aa','profile.see_all','Hundi ilaali'),
('am','profile.see_all','ሁሉንም ይዩ'),

('en','profile.no_favorites','No favorites yet'),
('zh','profile.no_favorites','暂无收藏'),
('so','profile.no_favorites','Jeclaysi ma jiraan weli'),
('aa','profile.no_favorites','Jaalatamanta hixinootto'),
('am','profile.no_favorites','እስካሁን ምንም ተወዳጅ የለም'),

('en','profile.browse_products','Browse products'),
('zh','profile.browse_products','浏览产品'),
('so','profile.browse_products','Badeecadaha eeg'),
('aa','profile.browse_products','Oomishoota ilaali'),
('am','profile.browse_products','ምርቶችን ያስሱ'),

('en','profile.favorites_count','favorite products'),
('zh','profile.favorites_count','个收藏产品'),
('so','profile.favorites_count','badeecadood oo la jeclaaday'),
('aa','profile.favorites_count','oomishoota jaalatame'),
('am','profile.favorites_count','ተወዳጅ ምርቶች'),

('en','profile.favorites_desc','Find all your saved products'),
('zh','profile.favorites_desc','查看所有已保存的产品'),
('so','profile.favorites_desc','Dhammaan badeecadahaaga la keydsaday arag'),
('aa','profile.favorites_desc','Oomishoota kuufatte hundi argadhu'),
('am','profile.favorites_desc','ሁሉንም የተቀመጡ ምርቶቻችሁን ያግኙ'),

('en','profile.my_orders','My orders'),
('zh','profile.my_orders','我的订单'),
('so','profile.my_orders','Dalabyadayda'),
('aa','profile.my_orders','Ajandooyye koo'),
('am','profile.my_orders','የእኔ ትዕዛዞች'),

('en','profile.no_orders','No orders yet'),
('zh','profile.no_orders','暂无订单'),
('so','profile.no_orders','Dalabyo ma jiraan weli'),
('aa','profile.no_orders','Ajandooyye hixinootto'),
('am','profile.no_orders','እስካሁን ምንም ትዕዛዝ የለም'),

('en','profile.start_shopping','Start shopping'),
('zh','profile.start_shopping','开始购物'),
('so','profile.start_shopping','Bilow iibsashada'),
('aa','profile.start_shopping','Gatissate jalqabi'),
('am','profile.start_shopping','መሸቀጥ ጀምር'),

('en','profile.order_label','Order'),
('zh','profile.order_label','订单'),
('so','profile.order_label','Dalab'),
('aa','profile.order_label','Ajando'),
('am','profile.order_label','ትዕዛዝ'),

('en','profile.producer_space','Producer space'),
('zh','profile.producer_space','生产者空间'),
('so','profile.producer_space','Goobta Beeraleyda'),
('aa','profile.producer_space','Oomishitoota bakka'),
('am','profile.producer_space','የአምራቾች ቦታ'),

('en','profile.producer_space_desc','Manage your products and orders'),
('zh','profile.producer_space_desc','管理您的产品和订单'),
('so','profile.producer_space_desc','Maamul badeecadahaaga iyo dalabyadaada'),
('aa','profile.producer_space_desc','Oomishoota ajandootta koo qindeessi'),
('am','profile.producer_space_desc','ምርቶቻችሁን እና ትዕዛዞቻችሁን ያስተዳድሩ'),

('en','profile.go_producer','Access'),
('zh','profile.go_producer','进入'),
('so','profile.go_producer','Geli'),
('aa','profile.go_producer','Seenu'),
('am','profile.go_producer','ይግቡ'),

('en','profile.not_producer','Not a producer yet?'),
('zh','profile.not_producer','还不是生产者？'),
('so','profile.not_producer','Wali ma ahayn beerale?'),
('aa','profile.not_producer','Ammas oomishitoota miti?'),
('am','profile.not_producer','እስካሁን አምራች አይደሉም?'),

('en','profile.become_producer_link','Submit a request'),
('zh','profile.become_producer_link','提交申请'),
('so','profile.become_producer_link','Codsi gudbi'),
('aa','profile.become_producer_link','Gaaffii ergi'),
('am','profile.become_producer_link','ጥያቄ ያስገቡ'),

('en','profile.settings','Settings'),
('zh','profile.settings','设置'),
('so','profile.settings','Dejinta'),
('aa','profile.settings','Qindeessa'),
('am','profile.settings','ቅንብሮች'),

('en','profile.notifications','Notifications'),
('zh','profile.notifications','通知'),
('so','profile.notifications','Ogeysiisyo'),
('aa','profile.notifications','Beeksisa'),
('am','profile.notifications','ማሳወቂያዎች'),

('en','profile.security','Security'),
('zh','profile.security','安全'),
('so','profile.security','Amniga'),
('aa','profile.security','Nageenyaa'),
('am','profile.security','ደህንነት'),

('en','profile.signout','Sign out'),
('zh','profile.signout','退出登录'),
('so','profile.signout','Ka bax'),
('aa','profile.signout','Gadi'),
('am','profile.signout','ውጣ'),

-- ============================================================
-- FAVORITES PAGE
-- ============================================================
('en','favorites.empty','No favorites yet. Add products by clicking the ❤️'),
('zh','favorites.empty','暂无收藏。点击 ❤️ 添加产品'),
('so','favorites.empty','Jeclaysi ma jiraan. Ku dar badeecadaha adigoo gujinaya ❤️'),
('aa','favorites.empty','Jaalatamanta hixinootto. Oomishoota ❤️ tuqatee ida''i'),
('am','favorites.empty','ተወዳጆች የሉም። ❤️ ጠቅ በማድረግ ምርቶች ይጨምሩ'),

('en','favorites.browse','Browse products'),
('zh','favorites.browse','浏览产品'),
('so','favorites.browse','Badeecadaha eeg'),
('aa','favorites.browse','Oomishoota ilaali'),
('am','favorites.browse','ምርቶችን ያስሱ'),

-- ============================================================
-- CHECKOUT
-- ============================================================
('en','checkout.empty_cart','Your cart is empty'),
('zh','checkout.empty_cart','您的购物车是空的'),
('so','checkout.empty_cart','Basket-kaagu waa madhan yahay'),
('aa','checkout.empty_cart','Kaaritaaki dooqu'),
('am','checkout.empty_cart','ቅርጫትዎ ባዶ ነው'),

('en','checkout.back_home','← Back to home'),
('zh','checkout.back_home','← 返回首页'),
('so','checkout.back_home','← Ku laabo bogga hore'),
('aa','checkout.back_home','← Manna galti'),
('am','checkout.back_home','← ወደ ዋናው ገፅ ተመለስ'),

('en','checkout.confirmed','Order confirmed!'),
('zh','checkout.confirmed','订单已确认！'),
('so','checkout.confirmed','Dalabku waa la xaqiijiyey!'),
('aa','checkout.confirmed','Ajando xaqiiqame!'),
('am','checkout.confirmed','ትዕዛዝ ተረጋግጧል!'),

('en','checkout.order_label','Order #'),
('zh','checkout.order_label','订单 #'),
('so','checkout.order_label','Dalabka #'),
('aa','checkout.order_label','Ajando #'),
('am','checkout.order_label','ትዕዛዝ #'),

('en','checkout.thanks','Thank you for your order. You will be contacted for delivery.'),
('zh','checkout.thanks','感谢您的订单。我们将联系您安排配送。'),
('so','checkout.thanks','Mahadsanid dalabashadaada. Lagula xiriiri doonaa si loo geeyo.'),
('aa','checkout.thanks','Ajandooki hammanna. Geeshi afaatinno.'),
('am','checkout.thanks','ለትዕዛዝዎ እናመሰግናለን። ለዴሊቨሪ ያገኙዎታል።'),

('en','checkout.title','Complete your order'),
('zh','checkout.title','完成您的订单'),
('so','checkout.title','Dhammee dalabkaaga'),
('aa','checkout.title','Ajandooki xuruuri'),
('am','checkout.title','ትዕዛዝዎን ያጠናቅቁ'),

('en','checkout.step_recap','Summary'),
('zh','checkout.step_recap','摘要'),
('so','checkout.step_recap','Koobis'),
('aa','checkout.step_recap','Cuqul'),
('am','checkout.step_recap','ማጠቃለያ'),

('en','checkout.step_delivery','Delivery'),
('zh','checkout.step_delivery','配送'),
('so','checkout.step_delivery','Geynta'),
('aa','checkout.step_delivery','Geeshi'),
('am','checkout.step_delivery','ዴሊቨሪ'),

('en','checkout.step_payment','Payment'),
('zh','checkout.step_payment','付款'),
('so','checkout.step_payment','Lacag bixinta'),
('aa','checkout.step_payment','Kaffaltii'),
('am','checkout.step_payment','ክፍያ'),

('en','checkout.your_order','Your order'),
('zh','checkout.your_order','您的订单'),
('so','checkout.your_order','Dalabkaaga'),
('aa','checkout.your_order','Ajandooki'),
('am','checkout.your_order','ትዕዛዝዎ'),

('en','checkout.total','Total'),
('zh','checkout.total','总计'),
('so','checkout.total','Wadarta'),
('aa','checkout.total','Waxxi'),
('am','checkout.total','ጠቅላላ'),

('en','checkout.continue_delivery','Continue → Delivery'),
('zh','checkout.continue_delivery','继续 → 配送'),
('so','checkout.continue_delivery','Sii wad → Geynta'),
('aa','checkout.continue_delivery','Itti fufi → Geeshi'),
('am','checkout.continue_delivery','ቀጥል → ዴሊቨሪ'),

('en','checkout.delivery_info','Delivery information'),
('zh','checkout.delivery_info','配送信息'),
('so','checkout.delivery_info','Macluumaadka geynta'),
('aa','checkout.delivery_info','Geeshi odeeffannoo'),
('am','checkout.delivery_info','የዴሊቨሪ መረጃ'),

('en','checkout.full_name','Full name *'),
('zh','checkout.full_name','全名 *'),
('so','checkout.full_name','Magaca oo dhan *'),
('aa','checkout.full_name','Maqishsho gurraacho *'),
('am','checkout.full_name','ሙሉ ስም *'),

('en','checkout.phone','Phone *'),
('zh','checkout.phone','电话 *'),
('so','checkout.phone','Telefoon *'),
('aa','checkout.phone','Bilbili *'),
('am','checkout.phone','ስልክ *'),

('en','checkout.delivery_address','Delivery address *'),
('zh','checkout.delivery_address','配送地址 *'),
('so','checkout.delivery_address','Cinwaanka geynta *'),
('aa','checkout.delivery_address','Geeshi cinaancho *'),
('am','checkout.delivery_address','የዴሊቨሪ አድራሻ *'),

('en','checkout.back','← Back'),
('zh','checkout.back','← 返回'),
('so','checkout.back','← Laabo'),
('aa','checkout.back','← Galti'),
('am','checkout.back','← ተመለስ'),

('en','checkout.continue_payment','Continue → Payment'),
('zh','checkout.continue_payment','继续 → 付款'),
('so','checkout.continue_payment','Sii wad → Lacag bixinta'),
('aa','checkout.continue_payment','Itti fufi → Kaffaltii'),
('am','checkout.continue_payment','ቀጥል → ክፍያ'),

('en','checkout.payment_title','Payment method'),
('zh','checkout.payment_title','支付方式'),
('so','checkout.payment_title','Qaabka lacag bixinta'),
('aa','checkout.payment_title','Kaffaltii gede'),
('am','checkout.payment_title','የክፍያ ዘዴ'),

('en','checkout.subtotal','Subtotal'),
('zh','checkout.subtotal','小计'),
('so','checkout.subtotal','Wadarta hoose'),
('aa','checkout.subtotal','Summa xiqqaa'),
('am','checkout.subtotal','ንዑስ ድምር'),

('en','checkout.delivery_label','Delivery'),
('zh','checkout.delivery_label','配送'),
('so','checkout.delivery_label','Geynta'),
('aa','checkout.delivery_label','Geeshi'),
('am','checkout.delivery_label','ዴሊቨሪ'),

('en','checkout.free','Free'),
('zh','checkout.free','免费'),
('so','checkout.free','Bilaash'),
('aa','checkout.free','Bilaa kanfaltii'),
('am','checkout.free','ነፃ'),

('en','checkout.processing','⏳ Processing...'),
('zh','checkout.processing','⏳ 处理中...'),
('so','checkout.processing','⏳ Diyaarinta...'),
('aa','checkout.processing','⏳ Hojjetamaa...'),
('am','checkout.processing','⏳ በሂደት ላይ...'),

('en','checkout.confirm','✅ Confirm order'),
('zh','checkout.confirm','✅ 确认订单'),
('so','checkout.confirm','✅ Xaqiiji dalabka'),
('aa','checkout.confirm','✅ Ajando xaqiiqi'),
('am','checkout.confirm','✅ ትዕዛዝ አረጋግጥ'),

('en','checkout.mobile_number','Number'),
('zh','checkout.mobile_number','号码'),
('so','checkout.mobile_number','Lambarka'),
('aa','checkout.mobile_number','Lakkoofsa'),
('am','checkout.mobile_number','ቁጥር'),

('en','checkout.payment_method_label','Payment method'),
('zh','checkout.payment_method_label','支付方式'),
('so','checkout.payment_method_label','Qaabka lacag bixinta'),
('aa','checkout.payment_method_label','Kaffaltii gede'),
('am','checkout.payment_method_label','የክፍያ ዘዴ'),

('en','checkout.waafi_label','Waafi'),('zh','checkout.waafi_label','Waafi'),('so','checkout.waafi_label','Waafi'),('aa','checkout.waafi_label','Waafi'),('am','checkout.waafi_label','Waafi'),
('en','checkout.waafi_desc','Waafi mobile payment'),('zh','checkout.waafi_desc','Waafi手机支付'),('so','checkout.waafi_desc','Lacag bixin Waafi'),('aa','checkout.waafi_desc','Waafi bilbila kanfaltii'),('am','checkout.waafi_desc','ዋፊ ሞባይል ክፍያ'),
('en','checkout.dmoney_label','D-Money'),('zh','checkout.dmoney_label','D-Money'),('so','checkout.dmoney_label','D-Money'),('aa','checkout.dmoney_label','D-Money'),('am','checkout.dmoney_label','D-Money'),
('en','checkout.dmoney_desc','D-Money mobile payment'),('zh','checkout.dmoney_desc','D-Money手机支付'),('so','checkout.dmoney_desc','Lacag bixin D-Money'),('aa','checkout.dmoney_desc','D-Money bilbila kanfaltii'),('am','checkout.dmoney_desc','ዲ-ሙኒ ሞባይል ክፍያ'),
('en','checkout.cash_label','Cash'),('zh','checkout.cash_label','现金'),('so','checkout.cash_label','Lacagta'),('aa','checkout.cash_label','Maallaqa'),('am','checkout.cash_label','ጥሬ ገንዘብ'),
('en','checkout.cash_desc','Cash on delivery'),('zh','checkout.cash_desc','货到付款'),('so','checkout.cash_desc','Lacag bixin markaad hesho'),('aa','checkout.cash_desc','Geessitii kaffaltii'),('am','checkout.cash_desc','በዴሊቨሪ ጊዜ ክፍያ'),
('en','checkout.back_home_btn','🏠 Back to home'),('zh','checkout.back_home_btn','🏠 返回首页'),('so','checkout.back_home_btn','🏠 Ku laabo bogga hore'),('aa','checkout.back_home_btn','🏠 Manna galti'),('am','checkout.back_home_btn','🏠 ወደ ዋናው ገፅ ተመለስ'),
('en','checkout.name_placeholder','Ex: Ahmed Hassan'),('zh','checkout.name_placeholder','例：Ahmed Hassan'),('so','checkout.name_placeholder','Tusaale: Ahmed Hassan'),('aa','checkout.name_placeholder','Fakke: Ahmed Hassan'),('am','checkout.name_placeholder','ምሳሌ: Ahmed Hassan'),
('en','checkout.phone_placeholder','Ex: 77 XX XX XX'),('zh','checkout.phone_placeholder','例：77 XX XX XX'),('so','checkout.phone_placeholder','Tusaale: 77 XX XX XX'),('aa','checkout.phone_placeholder','Fakke: 77 XX XX XX'),('am','checkout.phone_placeholder','ምሳሌ: 77 XX XX XX'),
('en','checkout.address_placeholder','Ex: Quarter 4, Peace Street, Djibouti City'),('zh','checkout.address_placeholder','例：第4区，和平街，吉布提市'),('so','checkout.address_placeholder','Tusaale: Xaafadda 4, Jidka Nabadda, Magaalada Jabuuti'),('aa','checkout.address_placeholder','Fakke: Gobba 4, Gammachuu Karaa, Jibuuti Magaalaa'),('am','checkout.address_placeholder','ምሳሌ: ሰፈር 4, የሰላም መንገድ, ጂቡቲ ከተማ'),

-- ============================================================
-- ADMIN STATUS (partagé admin + profil + producteur)
-- ============================================================
('en','admin.status_pending','⏳ Pending'),
('zh','admin.status_pending','⏳ 待处理'),
('so','admin.status_pending','⏳ Sugida'),
('aa','admin.status_pending','⏳ Eegama'),
('am','admin.status_pending','⏳ በመጠባበቅ'),

('en','admin.status_processing','🚚 Processing'),
('zh','admin.status_processing','🚚 处理中'),
('so','admin.status_processing','🚚 Diyaarinta'),
('aa','admin.status_processing','🚚 Hojjetamaa'),
('am','admin.status_processing','🚚 በሂደት'),

('en','admin.status_delivered','✅ Delivered'),
('zh','admin.status_delivered','✅ 已送达'),
('so','admin.status_delivered','✅ La geeyey'),
('aa','admin.status_delivered','✅ Geeffame'),
('am','admin.status_delivered','✅ ተቀብሏል'),

('en','admin.status_cancelled','❌ Cancelled'),
('zh','admin.status_cancelled','❌ 已取消'),
('so','admin.status_cancelled','❌ La baajiyey'),
('aa','admin.status_cancelled','❌ Haqame'),
('am','admin.status_cancelled','❌ ተሰርዟል'),

('en','admin.all','All'),
('zh','admin.all','全部'),
('so','admin.all','Dhammaan'),
('aa','admin.all','Hunda'),
('am','admin.all','ሁሉ'),

('en','admin.total','Total'),
('zh','admin.total','总计'),
('so','admin.total','Wadarta'),
('aa','admin.total','Waxxi'),
('am','admin.total','ጠቅላላ'),

-- ============================================================
-- ADMIN NAVIGATION
-- ============================================================
('en','admin.administration','Administration'),
('zh','admin.administration','管理'),
('so','admin.administration','Maamulka'),
('aa','admin.administration','Bulchiinsa'),
('am','admin.administration','አስተዳደር'),

('en','admin.nav_dashboard','Dashboard'),
('zh','admin.nav_dashboard','仪表板'),
('so','admin.nav_dashboard','Xogta'),
('aa','admin.nav_dashboard','Gabaasa'),
('am','admin.nav_dashboard','ዳሽቦርድ'),

('en','admin.nav_products','Products'),
('zh','admin.nav_products','产品'),
('so','admin.nav_products','Badeecadaha'),
('aa','admin.nav_products','Oomishoota'),
('am','admin.nav_products','ምርቶች'),

('en','admin.nav_categories','Categories'),
('zh','admin.nav_categories','分类'),
('so','admin.nav_categories','Qeybaha'),
('aa','admin.nav_categories','Qeebbitoota'),
('am','admin.nav_categories','ምድቦች'),

('en','admin.nav_promos','Promotions'),
('zh','admin.nav_promos','促销'),
('so','admin.nav_promos','Deeqaha'),
('aa','admin.nav_promos','Deeqaha'),
('am','admin.nav_promos','ማስተዋወቂያዎች'),

('en','admin.nav_producers','Producers'),
('zh','admin.nav_producers','生产者'),
('so','admin.nav_producers','Beeraleyda'),
('aa','admin.nav_producers','Oomishittoota'),
('am','admin.nav_producers','አምራቾች'),

('en','admin.nav_orders','Orders'),
('zh','admin.nav_orders','订单'),
('so','admin.nav_orders','Dalabyo'),
('aa','admin.nav_orders','Ajandooyye'),
('am','admin.nav_orders','ትዕዛዞች'),

('en','admin.nav_requests','Requests'),
('zh','admin.nav_requests','申请'),
('so','admin.nav_requests','Codsiyada'),
('aa','admin.nav_requests','Gaaffiiwwan'),
('am','admin.nav_requests','ጥያቄዎች'),

('en','admin.nav_users','Users'),
('zh','admin.nav_users','用户'),
('so','admin.nav_users','Isticmaalayaasha'),
('aa','admin.nav_users','Macaangaliwwan'),
('am','admin.nav_users','ተጠቃሚዎች'),

('en','admin.verifying','Verifying access...'),
('zh','admin.verifying','验证访问权限...'),
('so','admin.verifying','Xaqiijinaya gelitaanka...'),
('aa','admin.verifying','Seentumma mirkaneessaa...'),
('am','admin.verifying','መዳረሻ በማረጋገጥ ላይ...'),

('en','admin.access_denied','Access denied'),
('zh','admin.access_denied','访问被拒绝'),
('so','admin.access_denied','Gelitaanka waa la diidey'),
('aa','admin.access_denied','Seentummi dide'),
('am','admin.access_denied','መዳረሻ ተከልክሏል'),

('en','admin.access_denied_msg','This page is reserved for Racine Bio administrators.'),
('zh','admin.access_denied_msg','此页面仅供 Racine Bio 管理员访问。'),
('so','admin.access_denied_msg','Boggan waxaa loogu talagalay maamulayaasha Racine Bio.'),
('aa','admin.access_denied_msg','Fuulichi Racine Bio hooggantootaf qofa.'),
('am','admin.access_denied_msg','ይህ ገፅ ለ Racine Bio አስተዳዳሪዎች ብቻ ነው።'),

('en','admin.back_to_site','← Back to site'),
('zh','admin.back_to_site','← 返回网站'),
('so','admin.back_to_site','← Ku laabo bogga'),
('aa','admin.back_to_site','← Gooticha galti'),
('am','admin.back_to_site','← ወደ ጣቢያ ተመለስ'),

('en','admin.logout','Log out'),
('zh','admin.logout','退出'),
('so','admin.logout','Ka bax'),
('aa','admin.logout','Gadi'),
('am','admin.logout','ውጣ'),

-- ============================================================
-- ADMIN COMMON ACTIONS
-- ============================================================
('en','admin.loading','Loading...'),
('zh','admin.loading','加载中...'),
('so','admin.loading','Rarida...'),
('aa','admin.loading','Naqna...'),
('am','admin.loading','በመጫን ላይ...'),

('en','admin.add','+ Add'),
('zh','admin.add','+ 添加'),
('so','admin.add','+ Kudar'),
('aa','admin.add','+ Ida''i'),
('am','admin.add','+ ጨምር'),

('en','admin.edit','Edit'),
('zh','admin.edit','编辑'),
('so','admin.edit','Wax ka beddel'),
('aa','admin.edit','Gulaali'),
('am','admin.edit','አርትዕ'),

('en','admin.delete','Delete'),
('zh','admin.delete','删除'),
('so','admin.delete','Tirtir'),
('aa','admin.delete','Haqii'),
('am','admin.delete','ሰርዝ'),

('en','admin.cancel','Cancel'),
('zh','admin.cancel','取消'),
('so','admin.cancel','Jooji'),
('aa','admin.cancel','Dhiisi'),
('am','admin.cancel','ሰርዝ'),

('en','admin.saving','Saving...'),
('zh','admin.saving','保存中...'),
('so','admin.saving','Keydinaya...'),
('aa','admin.saving','Kuufamaa...'),
('am','admin.saving','በማስቀመጥ ላይ...'),

-- ============================================================
-- ADMIN STATS (dashboard)
-- ============================================================
('en','admin.stat_products','Products'),
('zh','admin.stat_products','产品'),
('so','admin.stat_products','Badeecadaha'),
('aa','admin.stat_products','Oomishoota'),
('am','admin.stat_products','ምርቶች'),

('en','admin.stat_categories','Categories'),
('zh','admin.stat_categories','分类'),
('so','admin.stat_categories','Qeybaha'),
('aa','admin.stat_categories','Qeebbitoota'),
('am','admin.stat_categories','ምድቦች'),

('en','admin.stat_promos','Promotions'),
('zh','admin.stat_promos','促销'),
('so','admin.stat_promos','Deeqaha'),
('aa','admin.stat_promos','Deeqaha'),
('am','admin.stat_promos','ማስተዋወቂያዎች'),

('en','admin.stat_producers','Producers'),
('zh','admin.stat_producers','生产者'),
('so','admin.stat_producers','Beeraleyda'),
('aa','admin.stat_producers','Oomishittoota'),
('am','admin.stat_producers','አምራቾች'),

('en','admin.stat_orders','Orders'),
('zh','admin.stat_orders','订单'),
('so','admin.stat_orders','Dalabyo'),
('aa','admin.stat_orders','Ajandooyye'),
('am','admin.stat_orders','ትዕዛዞች'),

('en','admin.stat_users','Users'),
('zh','admin.stat_users','用户'),
('so','admin.stat_users','Isticmaalayaasha'),
('aa','admin.stat_users','Macaangaliwwan'),
('am','admin.stat_users','ተጠቃሚዎች'),

('en','admin.stat_requests','Requests'),
('zh','admin.stat_requests','申请'),
('so','admin.stat_requests','Codsiyada'),
('aa','admin.stat_requests','Gaaffiiwwan'),
('am','admin.stat_requests','ጥያቄዎች'),

-- ============================================================
-- ADMIN PRODUCTS
-- ============================================================
('en','admin.products_search','Search...'),
('zh','admin.products_search','搜索...'),
('so','admin.products_search','Raadi...'),
('aa','admin.products_search','Kaiyi...'),
('am','admin.products_search','ፈልግ...'),

('en','admin.products_all_cats','All categories'),
('zh','admin.products_all_cats','所有分类'),
('so','admin.products_all_cats','Dhammaan qeybaha'),
('aa','admin.products_all_cats','Qeebbitoota hundi'),
('am','admin.products_all_cats','ሁሉም ምድቦች'),

('en','admin.products_no_results','No products found'),
('zh','admin.products_no_results','未找到产品'),
('so','admin.products_no_results','Lama helin badeecad'),
('aa','admin.products_no_results','Oomishshi argame hixinne'),
('am','admin.products_no_results','ምርት አልተገኘም'),

('en','admin.products_add_title','Add product'),
('zh','admin.products_add_title','添加产品'),
('so','admin.products_add_title','Kudar badeecad'),
('aa','admin.products_add_title','Oomishsha ida''i'),
('am','admin.products_add_title','ምርት ጨምር'),

('en','admin.products_edit_title','Edit product'),
('zh','admin.products_edit_title','编辑产品'),
('so','admin.products_edit_title','Wax ka beddel badeecadda'),
('aa','admin.products_edit_title','Oomishsha gulaali'),
('am','admin.products_edit_title','ምርት አርትዕ'),

('en','admin.error_products','Name, price, unit and farm are required.'),
('zh','admin.error_products','名称、价格、单位和农场为必填项。'),
('so','admin.error_products','Magaca, qiimaha, cutubka iyo beerta waa loo baahan yahay.'),
('aa','admin.error_products','Maqisha, gatii, cuquli xagge beerri barbaachisu.'),
('am','admin.error_products','ስም፣ ዋጋ፣ ክፍል እና እርሻ ያስፈልጋሉ።'),

('en','admin.no_category','— No category —'),
('zh','admin.no_category','— 无分类 —'),
('so','admin.no_category','— La''aanta qeybta —'),
('aa','admin.no_category','— Qeebba hixinne —'),
('am','admin.no_category','— ምድብ የለም —'),

('en','admin.type_bio','Organic'),
('zh','admin.type_bio','有机'),
('so','admin.type_bio','Dabiici'),
('aa','admin.type_bio','Naaturraalaa'),
('am','admin.type_bio','ኦርጋኒክ'),

('en','admin.type_conv','Conventional'),
('zh','admin.type_conv','传统'),
('so','admin.type_conv','Caadi'),
('aa','admin.type_conv','Aadaa'),
('am','admin.type_conv','ተለምዷዊ'),

-- ============================================================
-- ADMIN FIELDS (shared)
-- ============================================================
('en','admin.col_product','Product'),
('zh','admin.col_product','产品'),
('so','admin.col_product','Badeecadda'),
('aa','admin.col_product','Oomishsha'),
('am','admin.col_product','ምርት'),

('en','admin.col_price','Price'),
('zh','admin.col_price','价格'),
('so','admin.col_price','Qiimaha'),
('aa','admin.col_price','Gatii'),
('am','admin.col_price','ዋጋ'),

('en','admin.col_farm','Farm'),
('zh','admin.col_farm','农场'),
('so','admin.col_farm','Beerta'),
('aa','admin.col_farm','Beerri'),
('am','admin.col_farm','እርሻ'),

('en','admin.col_category','Category'),
('zh','admin.col_category','分类'),
('so','admin.col_category','Qeybta'),
('aa','admin.col_category','Qeebba'),
('am','admin.col_category','ምድብ'),

('en','admin.col_type','Type'),
('zh','admin.col_type','类型'),
('so','admin.col_type','Nooca'),
('aa','admin.col_type','Gosa'),
('am','admin.col_type','አይነት'),

('en','admin.col_emoji','Emoji'),
('zh','admin.col_emoji','表情'),
('so','admin.col_emoji','Sumad'),
('aa','admin.col_emoji','Sumaa'),
('am','admin.col_emoji','ምልክት'),

('en','admin.col_label','Label'),
('zh','admin.col_label','标签'),
('so','admin.col_label','Astaan'),
('aa','admin.col_label','Maqisha'),
('am','admin.col_label','መለያ'),

('en','admin.col_slug','Slug'),
('zh','admin.col_slug','Slug'),
('so','admin.col_slug','Sumad URL'),
('aa','admin.col_slug','URL sumaa'),
('am','admin.col_slug','ስሉግ'),

('en','admin.col_region','Region'),
('zh','admin.col_region','地区'),
('so','admin.col_region','Gobolka'),
('aa','admin.col_region','Naannoo'),
('am','admin.col_region','ክልል'),

('en','admin.col_producer','Producer'),
('zh','admin.col_producer','生产者'),
('so','admin.col_producer','Beeralayha'),
('aa','admin.col_producer','Oomishitoota'),
('am','admin.col_producer','አምራቾች'),

('en','admin.col_rating','Rating'),
('zh','admin.col_rating','评分'),
('so','admin.col_rating','Dhibcaha'),
('aa','admin.col_rating','Madaallii'),
('am','admin.col_rating','ደረጃ'),

('en','admin.actions','Actions'),
('zh','admin.actions','操作'),
('so','admin.actions','Ficilada'),
('aa','admin.actions','Tarkaanfii'),
('am','admin.actions','ድርጊቶች'),

('en','admin.field_product_name','Product name *'),
('zh','admin.field_product_name','产品名称 *'),
('so','admin.field_product_name','Magaca badeecadda *'),
('aa','admin.field_product_name','Oomishsha maqishsho *'),
('am','admin.field_product_name','የምርት ስም *'),

('en','admin.field_price','Price (Fdj) *'),
('zh','admin.field_price','价格 (Fdj) *'),
('so','admin.field_price','Qiimaha (Fdj) *'),
('aa','admin.field_price','Gatii (Fdj) *'),
('am','admin.field_price','ዋጋ (Fdj) *'),

('en','admin.field_old_price','Old price (crossed out)'),
('zh','admin.field_old_price','原价（划掉）'),
('so','admin.field_old_price','Qiimihii hore (la xariijiyey)'),
('aa','admin.field_old_price','Gatii durii (darbame)'),
('am','admin.field_old_price','የድሮ ዋጋ (የተሰረዘ)'),

('en','admin.field_unit','Unit *'),
('zh','admin.field_unit','单位 *'),
('so','admin.field_unit','Cutubka *'),
('aa','admin.field_unit','Cuquli *'),
('am','admin.field_unit','ክፍል *'),

('en','admin.field_farm','Farm *'),
('zh','admin.field_farm','农场 *'),
('so','admin.field_farm','Beerta *'),
('aa','admin.field_farm','Beerri *'),
('am','admin.field_farm','እርሻ *'),

('en','admin.field_origin','Country of origin'),
('zh','admin.field_origin','原产国'),
('so','admin.field_origin','Wadanka asal ahaan ka yimid'),
('aa','admin.field_origin','Biyya madda'),
('am','admin.field_origin','የመነሻ አገር'),

('en','admin.field_image','Image'),
('zh','admin.field_image','图片'),
('so','admin.field_image','Sawirka'),
('aa','admin.field_image','Fottoo'),
('am','admin.field_image','ምስል'),

('en','admin.field_image_url','or paste a URL https://...'),
('zh','admin.field_image_url','或粘贴 URL https://...'),
('so','admin.field_image_url','ama ku dheji URL https://...'),
('aa','admin.field_image_url','yookaan URL https://... maxxansi'),
('am','admin.field_image_url','ወይም URL https://... ይለጥፉ'),

('en','admin.upload_image','Choose an image from my computer'),
('zh','admin.upload_image','从我的电脑选择图片'),
('so','admin.upload_image','Sawir ka dooro kombiyuutarkayga'),
('aa','admin.upload_image','Kompiyuutarakoo irraa fottoo filadhu'),
('am','admin.upload_image','ከኮምፒዩተሬ ምስል ይምረጡ'),

('en','admin.uploading','Uploading...'),
('zh','admin.uploading','上传中...'),
('so','admin.uploading','Raraya...'),
('aa','admin.uploading','Fe''amaa...'),
('am','admin.uploading','በመጫን ላይ...'),

('en','admin.field_description','Description'),
('zh','admin.field_description','描述'),
('so','admin.field_description','Sharaxaadda'),
('aa','admin.field_description','Ibsituu'),
('am','admin.field_description','መግለጫ'),

('en','admin.field_is_local','Local product (Djibouti)'),
('zh','admin.field_is_local','本地产品（吉布提）'),
('so','admin.field_is_local','Badeecadda maxaliga ah (Jabuuti)'),
('aa','admin.field_is_local','Naannoo oomishsha (Gabuutih)'),
('am','admin.field_is_local','የአካባቢ ምርት (ጂቡቲ)'),

('en','admin.field_title','Title *'),
('zh','admin.field_title','标题 *'),
('so','admin.field_title','Cinwaanka *'),
('aa','admin.field_title','Mata duree *'),
('am','admin.field_title','ርዕስ *'),

('en','admin.field_badge','Badge (e.g. SALE, -20%) *'),
('zh','admin.field_badge','徽标（如：SALE, -20%）*'),
('so','admin.field_badge','Calaamad (tusaale: HOOS, -20%) *'),
('aa','admin.field_badge','Sumaa (fakke: GATII, -20%) *'),
('am','admin.field_badge','ባጅ (ምሳሌ: SALE, -20%) *'),

('en','admin.field_subtitle','Subtitle'),
('zh','admin.field_subtitle','副标题'),
('so','admin.field_subtitle','Cinwaan kooban'),
('aa','admin.field_subtitle','Cinwaan xiqqaa'),
('am','admin.field_subtitle','ንዑስ ርዕስ'),

('en','admin.field_color','Main color'),
('zh','admin.field_color','主色'),
('so','admin.field_color','Midabka'),
('aa','admin.field_color','Halluu'),
('am','admin.field_color','ዋና ቀለም'),

('en','admin.field_category','Linked category (filter on click)'),
('zh','admin.field_category','关联分类（点击过滤）'),
('so','admin.field_category','Qeybta xidnaanta (shaandhayn markaad gujtid)'),
('aa','admin.field_category','Qeebba hiddate (tuqatee caancalti)'),
('am','admin.field_category','የተያያዘ ምድብ (ጠቅ ሲደረግ ማጣሪያ)'),

('en','admin.no_category_filter','— No filter —'),
('zh','admin.no_category_filter','— 无筛选 —'),
('so','admin.no_category_filter','— La''aanta shaandhada —'),
('aa','admin.no_category_filter','— Caancalti hixinne —'),
('am','admin.no_category_filter','— ምንም ማጣሪያ —'),

('en','admin.field_promo_visible','Active promotion (visible on site)'),
('zh','admin.field_promo_visible','激活促销（在网站上显示）'),
('so','admin.field_promo_visible','Deeqda firfircoon (muuqata goobta)'),
('aa','admin.field_promo_visible','Deeqicha sosso''ee (gooticha muuxxanno)'),
('am','admin.field_promo_visible','ንቁ ማስተዋወቂያ (በጣቢያ ላይ ይታያል)'),

('en','admin.field_label','Label *'),
('zh','admin.field_label','标签 *'),
('so','admin.field_label','Astaan *'),
('aa','admin.field_label','Maqisha *'),
('am','admin.field_label','መለያ *'),

('en','admin.field_slug','Slug *'),
('zh','admin.field_slug','Slug *'),
('so','admin.field_slug','Sumad URL *'),
('aa','admin.field_slug','URL sumaa *'),
('am','admin.field_slug','ስሉግ *'),

('en','admin.field_emoji','Emoji'),
('zh','admin.field_emoji','表情'),
('so','admin.field_emoji','Sumad'),
('aa','admin.field_emoji','Sumaa'),
('am','admin.field_emoji','ምልክት'),

('en','admin.slug_hint','Used in URLs, lowercase, no spaces (ex: fruits)'),
('zh','admin.slug_hint','用于URL，小写，无空格（例：fruits）'),
('so','admin.slug_hint','Waxa loo isticmaalo URLs, xarfaha yar, meelo ma jiraan (ex: fruits)'),
('aa','admin.slug_hint','URL keessatti fayyadame, qubee xiqqa, bakka hixinne (fakke: fruits)'),
('am','admin.slug_hint','በURL ውስጥ ይጠቅማል፣ ትንሽ ፊደሎች፣ ቦታ የለም (ምሳሌ: fruits)'),

-- ============================================================
-- ADMIN ERRORS & MISC
-- ============================================================
('en','admin.error_promos','Badge and title are required.'),
('zh','admin.error_promos','徽标和标题为必填项。'),
('so','admin.error_promos','Calaamadda iyo cinwaanka waa loo baahan yahay.'),
('aa','admin.error_promos','Sumaa mata dureewwan barbaachisu.'),
('am','admin.error_promos','ባጅ እና ርዕስ ያስፈልጋሉ።'),

('en','admin.error_categories','Label and emoji are required.'),
('zh','admin.error_categories','标签和表情为必填项。'),
('so','admin.error_categories','Astaan iyo sumad waa loo baahan yahay.'),
('aa','admin.error_categories','Maqisha sumaa barbaachisu.'),
('am','admin.error_categories','መለያ እና ምልክት ያስፈልጋሉ።'),

('en','admin.error_producers','Name and region are required.'),
('zh','admin.error_producers','名称和地区为必填项。'),
('so','admin.error_producers','Magaca iyo gobolka waa loo baahan yahay.'),
('aa','admin.error_producers','Maqisha naannoo barbaachisu.'),
('am','admin.error_producers','ስም እና ክልል ያስፈልጋሉ።'),

('en','admin.no_promos','No promotions'),
('zh','admin.no_promos','暂无促销'),
('so','admin.no_promos','Deeqo ma jiraan'),
('aa','admin.no_promos','Deeqha hixinootto'),
('am','admin.no_promos','ምንም ማስተዋወቂያ የለም'),

('en','admin.no_categories','No categories'),
('zh','admin.no_categories','暂无分类'),
('so','admin.no_categories','Qeybaha ma jiraan'),
('aa','admin.no_categories','Qeebbitooti hixinootto'),
('am','admin.no_categories','ምንም ምድቦች የለም'),

('en','admin.no_producers','No producers'),
('zh','admin.no_producers','暂无生产者'),
('so','admin.no_producers','Beeraleyda ma jiraan'),
('aa','admin.no_producers','Oomishittooti hixinootto'),
('am','admin.no_producers','ምንም አምራቾች የለም'),

('en','admin.promo_active','✓ Active'),
('zh','admin.promo_active','✓ 激活'),
('so','admin.promo_active','✓ Firfircoon'),
('aa','admin.promo_active','✓ Sosso''aa'),
('am','admin.promo_active','✓ ንቁ'),

('en','admin.promo_inactive','○ Inactive'),
('zh','admin.promo_inactive','○ 未激活'),
('so','admin.promo_inactive','○ Aan firfircoonayn'),
('aa','admin.promo_inactive','○ Sossoo''ineenna'),
('am','admin.promo_inactive','○ ቦዝኗል'),

('en','admin.promos_add_title','Add promotion'),
('zh','admin.promos_add_title','添加促销'),
('so','admin.promos_add_title','Kudar deeq'),
('aa','admin.promos_add_title','Deeqicha ida''i'),
('am','admin.promos_add_title','ማስተዋወቂያ ጨምር'),

('en','admin.promos_edit_title','Edit promotion'),
('zh','admin.promos_edit_title','编辑促销'),
('so','admin.promos_edit_title','Wax ka beddel deeqda'),
('aa','admin.promos_edit_title','Deeqicha gulaali'),
('am','admin.promos_edit_title','ማስተዋወቂያ አርትዕ'),

('en','admin.categories_add_title','Add category'),
('zh','admin.categories_add_title','添加分类'),
('so','admin.categories_add_title','Kudar qeybta'),
('aa','admin.categories_add_title','Qeebba ida''i'),
('am','admin.categories_add_title','ምድብ ጨምር'),

('en','admin.categories_edit_title','Edit category'),
('zh','admin.categories_edit_title','编辑分类'),
('so','admin.categories_edit_title','Wax ka beddel qeybta'),
('aa','admin.categories_edit_title','Qeebba gulaali'),
('am','admin.categories_edit_title','ምድብ አርትዕ'),

('en','admin.producers_add_title','Add producer'),
('zh','admin.producers_add_title','添加生产者'),
('so','admin.producers_add_title','Kudar beerale'),
('aa','admin.producers_add_title','Oomishitoota ida''i'),
('am','admin.producers_add_title','አምራቾች ጨምር'),

('en','admin.producers_edit_title','Edit producer'),
('zh','admin.producers_edit_title','编辑生产者'),
('so','admin.producers_edit_title','Wax ka beddel beeralaha'),
('aa','admin.producers_edit_title','Oomishitoota gulaali'),
('am','admin.producers_edit_title','አምራቾች አርትዕ'),

('en','admin.field_producer_name','Producer name *'),
('zh','admin.field_producer_name','生产者名称 *'),
('so','admin.field_producer_name','Magaca beeralaha *'),
('aa','admin.field_producer_name','Oomishitoota maqishsho *'),
('am','admin.field_producer_name','የአምራቾች ስም *'),

('en','admin.field_rating','Rating (0-5)'),
('zh','admin.field_rating','评分 (0-5)'),
('so','admin.field_rating','Dhibcaha (0-5)'),
('aa','admin.field_rating','Madaallii (0-5)'),
('am','admin.field_rating','ደረጃ (0-5)'),

('en','admin.field_full_name','Full name *'),
('zh','admin.field_full_name','全名 *'),
('so','admin.field_full_name','Magaca oo dhan *'),
('aa','admin.field_full_name','Maqishsho gurraacho *'),
('am','admin.field_full_name','ሙሉ ስም *'),

('en','admin.field_email','Email *'),
('zh','admin.field_email','邮箱 *'),
('so','admin.field_email','Email *'),
('aa','admin.field_email','Email *'),
('am','admin.field_email','ኢሜይል *'),

('en','admin.field_farm_name','Farm name *'),
('zh','admin.field_farm_name','农场名称 *'),
('so','admin.field_farm_name','Magaca beerta *'),
('aa','admin.field_farm_name','Beerri maqishsho *'),
('am','admin.field_farm_name','የእርሻ ስም *'),

('en','admin.field_products_desc','Products description'),
('zh','admin.field_products_desc','产品描述'),
('so','admin.field_products_desc','Sharaxaadda badeecadaha'),
('aa','admin.field_products_desc','Oomishoota ibsituu'),
('am','admin.field_products_desc','የምርቶች መግለጫ'),

-- ============================================================
-- ADMIN ORDERS
-- ============================================================
('en','admin.orders_none','No orders'),
('zh','admin.orders_none','暂无订单'),
('so','admin.orders_none','Dalabyo ma jiraan'),
('aa','admin.orders_none','Ajandooyye hixinootto'),
('am','admin.orders_none','ምንም ትዕዛዞች የለም'),

('en','admin.orders_none_status','No orders with this status'),
('zh','admin.orders_none_status','此状态下没有订单'),
('so','admin.orders_none_status','Dalabyo xaaladdan leh ma jiraan'),
('aa','admin.orders_none_status','Haala kanaan ajandooyye hixinootto'),
('am','admin.orders_none_status','በዚህ ሁኔታ ምንም ትዕዛዞች የለም'),

('en','admin.order_status_lbl','Status'),
('zh','admin.order_status_lbl','状态'),
('so','admin.order_status_lbl','Xaaladda'),
('aa','admin.order_status_lbl','Haala'),
('am','admin.order_status_lbl','ሁኔታ'),

('en','admin.order_items','Items'),
('zh','admin.order_items','商品'),
('so','admin.order_items','Alaabta'),
('aa','admin.order_items','Wanxallicha'),
('am','admin.order_items','ዕቃዎች'),

('en','admin.order_no_items','No items'),
('zh','admin.order_no_items','无商品'),
('so','admin.order_no_items','Alaab ma jirto'),
('aa','admin.order_no_items','Wanxalla hixinne'),
('am','admin.order_no_items','ምንም ዕቃዎች የለም'),

-- ============================================================
-- ADMIN REQUESTS
-- ============================================================
('en','admin.access_denied_meta','Contact the Racine Bio admin to get access.'),
('zh','admin.access_denied_meta','联系 Racine Bio 管理员以获得访问权限。'),
('so','admin.access_denied_meta','La xiriir maamulaha Racine Bio si aad u hesho gelitaanka.'),
('aa','admin.access_denied_meta','Seentummaaf Racine Bio hoogganaa qunnamii.'),
('am','admin.access_denied_meta','መዳረሻ ለማግኘት የ Racine Bio አስተዳዳሪን ያናጋሩ።'),

-- ============================================================
-- PRODUCER SPACE
-- ============================================================
('en','producer.loading','Loading...'),
('zh','producer.loading','加载中...'),
('so','producer.loading','Rarida...'),
('aa','producer.loading','Naqna...'),
('am','producer.loading','በመጫን ላይ...'),

('en','producer.space_label','Producer Space'),
('zh','producer.space_label','生产者空间'),
('so','producer.space_label','Goobta Beeraleyda'),
('aa','producer.space_label','Oomishitoota bakka'),
('am','producer.space_label','የአምራቾች ቦታ'),

('en','producer.back_site','Site'),
('zh','producer.back_site','网站'),
('so','producer.back_site','Goobta'),
('aa','producer.back_site','Gooticha'),
('am','producer.back_site','ጣቢያ'),

('en','producer.nav_dashboard','Dashboard'),
('zh','producer.nav_dashboard','仪表板'),
('so','producer.nav_dashboard','Xogta'),
('aa','producer.nav_dashboard','Gabaasa'),
('am','producer.nav_dashboard','ዳሽቦርድ'),

('en','producer.nav_products','My products'),
('zh','producer.nav_products','我的产品'),
('so','producer.nav_products','Badeecadahaygii'),
('aa','producer.nav_products','Oomishoota koo'),
('am','producer.nav_products','ምርቶቼ'),

('en','producer.nav_orders','My orders'),
('zh','producer.nav_orders','我的订单'),
('so','producer.nav_orders','Dalabyadayda'),
('aa','producer.nav_orders','Ajandooyye koo'),
('am','producer.nav_orders','ትዕዛዞቼ'),

('en','producer.welcome','Welcome'),
('zh','producer.welcome','欢迎'),
('so','producer.welcome','Soo dhawoow'),
('aa','producer.welcome','Baga nagaan dhufte'),
('am','producer.welcome','እንኳን ደህና መጡ'),

('en','producer.stat_products','Products'),
('zh','producer.stat_products','产品'),
('so','producer.stat_products','Badeecadaha'),
('aa','producer.stat_products','Oomishoota'),
('am','producer.stat_products','ምርቶች'),

('en','producer.stat_orders','Orders'),
('zh','producer.stat_orders','订单'),
('so','producer.stat_orders','Dalabyo'),
('aa','producer.stat_orders','Ajandooyye'),
('am','producer.stat_orders','ትዕዛዞች'),

('en','producer.stat_revenue','Revenue'),
('zh','producer.stat_revenue','收入'),
('so','producer.stat_revenue','Dakhliga'),
('aa','producer.stat_revenue','Galii'),
('am','producer.stat_revenue','ገቢ'),

('en','producer.see_all','See all'),
('zh','producer.see_all','查看全部'),
('so','producer.see_all','Dhammaantood arag'),
('aa','producer.see_all','Hundi ilaali'),
('am','producer.see_all','ሁሉንም ይዩ'),

('en','producer.add_product','Add a product'),
('zh','producer.add_product','添加产品'),
('so','producer.add_product','Kudar badeecad'),
('aa','producer.add_product','Oomishsha ida''i'),
('am','producer.add_product','ምርት ጨምር'),

('en','producer.add_product_desc','Manage your catalog'),
('zh','producer.add_product_desc','管理您的目录'),
('so','producer.add_product_desc','Maamul liistadaada'),
('aa','producer.add_product_desc','Kataalogaaki qindeessi'),
('am','producer.add_product_desc','ካታሎጎን ያስተዳድሩ'),

('en','producer.view_orders','View orders'),
('zh','producer.view_orders','查看订单'),
('so','producer.view_orders','Dalabyo arag'),
('aa','producer.view_orders','Ajandooyye ilaali'),
('am','producer.view_orders','ትዕዛዞች ይዩ'),

('en','producer.view_orders_desc','Track your deliveries'),
('zh','producer.view_orders_desc','跟踪您的配送'),
('so','producer.view_orders_desc','La soco geynta'),
('aa','producer.view_orders_desc','Geeshiita hordofii'),
('am','producer.view_orders_desc','ዴሊቨሪዎችን ይከታተሉ'),

('en','producer.recent_orders','Recent orders'),
('zh','producer.recent_orders','最近订单'),
('so','producer.recent_orders','Dalabyadii dhowaan'),
('aa','producer.recent_orders','Ajandooyye dhooto'),
('am','producer.recent_orders','የቅርብ ጊዜ ትዕዛዞች'),

('en','producer.no_orders_yet','No orders yet'),
('zh','producer.no_orders_yet','暂无订单'),
('so','producer.no_orders_yet','Dalabyo ma jiraan weli'),
('aa','producer.no_orders_yet','Ajandooyye hixinootto'),
('am','producer.no_orders_yet','እስካሁን ምንም ትዕዛዝ የለም'),

('en','producer.no_products','No products yet'),
('zh','producer.no_products','暂无产品'),
('so','producer.no_products','Badeecado ma jiraan weli'),
('aa','producer.no_products','Oomishooti hixinootto'),
('am','producer.no_products','እስካሁን ምንም ምርቶች የለም'),

('en','producer.add_first','Add your first product'),
('zh','producer.add_first','添加您的第一个产品'),
('so','producer.add_first','Kudar badeecaddaada koowaad'),
('aa','producer.add_first','Oomishsha jalqabaa kee ida''i'),
('am','producer.add_first','የመጀመሪያ ምርትዎን ጨምሩ'),

('en','producer.no_orders','No orders for your products'),
('zh','producer.no_orders','您的产品暂无订单'),
('so','producer.no_orders','Dalabyo ma jiraan badeecadahaaga'),
('aa','producer.no_orders','Oomishoota keef ajandooyye hixinootto'),
('am','producer.no_orders','ለምርቶቻችሁ ምንም ትዕዛዞች የለም'),

('en','producer.details','Details'),
('zh','producer.details','详情'),
('so','producer.details','Faahfaahin'),
('aa','producer.details','Bal''inaan'),
('am','producer.details','ዝርዝሮች'),

('en','producer.no_items','No items'),
('zh','producer.no_items','无商品'),
('so','producer.no_items','Alaab ma jirto'),
('aa','producer.no_items','Wanxalla hixinne'),
('am','producer.no_items','ምንም ዕቃዎች የለም'),

('en','producer.my_items_in_order','My items in this order'),
('zh','producer.my_items_in_order','我在此订单中的商品'),
('so','producer.my_items_in_order','Alaabadayda dalabkan ku jirta'),
('aa','producer.my_items_in_order','Ajando kanaan keessa wanxallichi koo'),
('am','producer.my_items_in_order','በዚህ ትዕዛዝ ውስጥ ያሉ ዕቃዎቼ'),

('en','producer.access_denied','Access reserved for producers'),
('zh','producer.access_denied','仅限生产者访问'),
('so','producer.access_denied','Gelitaanka waxaa loogu tala galay beeraleyda'),
('aa','producer.access_denied','Seentummi oomishitootaaf qofa'),
('am','producer.access_denied','ለአምራቾች ብቻ የተጠበቀ'),

('en','producer.access_denied_msg','This space is reserved for producers approved by Racine Bio.'),
('zh','producer.access_denied_msg','此空间仅供 Racine Bio 批准的生产者使用。'),
('so','producer.access_denied_msg','Goobtan waxaa loogu talagalay beeraleyda Racine Bio ansixisay.'),
('aa','producer.access_denied_msg','Bakki kun Racine Bio hayyamteen oomishitootaaf qofa.'),
('am','producer.access_denied_msg','ይህ ቦታ በ Racine Bio የተፈቀዱ አምራቾች ብቻ ነው።'),

('en','producer.become_cta','Become a producer'),
('zh','producer.become_cta','成为生产者'),
('so','producer.become_cta','Noqo beerale'),
('aa','producer.become_cta','Oomishitoota ta''i'),
('am','producer.become_cta','አምራቾች ሁን'),

('en','producer.back_home','← Back to home'),
('zh','producer.back_home','← 返回首页'),
('so','producer.back_home','← Ku laabo bogga hore'),
('aa','producer.back_home','← Manna galti'),
('am','producer.back_home','← ወደ ዋናው ገፅ ተመለስ'),

-- ============================================================
-- BECOME PRODUCER PAGE
-- ============================================================
('en','producer.already_producer','You are already a producer!'),
('zh','producer.already_producer','您已经是生产者了！'),
('so','producer.already_producer','Waad horeba beerale tahay!'),
('aa','producer.already_producer','Durumaa oomishitoota ta''ate!'),
('am','producer.already_producer','አስቀድሞ አምራቾች ነዎት!'),

('en','producer.already_producer_msg','Your account is approved. Access your producer space.'),
('zh','producer.already_producer_msg','您的账户已获批准。访问您的生产者空间。'),
('so','producer.already_producer_msg','Xisaabtaadu waa la ansixiyey. Geli goobta beeralaha.'),
('aa','producer.already_producer_msg','Akkaawuntichi hayyamame. Oomishitoota bakka seenu.'),
('am','producer.already_producer_msg','መለያዎ ተፈቅዷል። የአምራቾች ቦታን ይድረሱ።'),

('en','producer.go_to_space','Access my space →'),
('zh','producer.go_to_space','进入我的空间 →'),
('so','producer.go_to_space','Geli goobteydii →'),
('aa','producer.go_to_space','Bakka koo seenu →'),
('am','producer.go_to_space','ወደ ቦታዬ ይሂዱ →'),

('en','producer.request_pending','Request pending'),
('zh','producer.request_pending','申请待处理'),
('so','producer.request_pending','Codsi la sugayo'),
('aa','producer.request_pending','Gaaffii eegamaa'),
('am','producer.request_pending','ጥያቄ በመጠባበቅ'),

('en','producer.request_pending_msg','Your request has been received. We will contact you shortly.'),
('zh','producer.request_pending_msg','您的申请已收到。我们将很快与您联系。'),
('so','producer.request_pending_msg','Codsigaagii waa la helay. Dhawaan lagula xiriiri doonaa.'),
('aa','producer.request_pending_msg','Gaaffii kee argame. Dhumate siin bilbiluuf jirra.'),
('am','producer.request_pending_msg','ጥያቄዎ ተቀবሏል። በቅርቡ እናናግርዎታለን።'),

('en','producer.request_sent','Request sent!'),
('zh','producer.request_sent','申请已发送！'),
('so','producer.request_sent','Codsiga waa la diray!'),
('aa','producer.request_sent','Gaaffii ergame!'),
('am','producer.request_sent','ጥያቄ ተልኳል!'),

('en','producer.request_sent_msg','Your request has been received. We will contact you shortly.'),
('zh','producer.request_sent_msg','您的申请已收到。我们将很快与您联系。'),
('so','producer.request_sent_msg','Codsigaagii waa la helay. Dhawaan lagula xiriiri doonaa.'),
('aa','producer.request_sent_msg','Gaaffii kee argame. Dhumate siin bilbiluuf jirra.'),
('am','producer.request_sent_msg','ጥያቄዎ ተቀብሏል። በቅርቡ እናናግርዎታለን።'),

('en','producer.become_title','Become a Racine Bio producer'),
('zh','producer.become_title','成为 Racine Bio 的生产者'),
('so','producer.become_title','Ku noqo beerale Racine Bio'),
('aa','producer.become_title','Racine Bio oomishitoota ta''i'),
('am','producer.become_title','የ Racine Bio አምራቾች ሁን'),

('en','producer.become_subtitle','Join our network of local producers and sell your products online.'),
('zh','producer.become_subtitle','加入我们的本地生产者网络，在线销售您的产品。'),
('so','producer.become_subtitle','Ku biir shabakaddayada beeraleyda maxaliga ah oo alaabadaada ku iib online.'),
('aa','producer.become_subtitle','Naannoo oomishitootankoo sirna seenu oomishoota kee online gati.'),
('am','producer.become_subtitle','የሀገር ውስጥ አምራቾቻችን አካል ሁኑ ምርቶቻችሁን ኦንላይን ሽጡ።'),

('en','producer.benefit_direct','Direct sales'),
('zh','producer.benefit_direct','直销'),
('so','producer.benefit_direct','Ganacsiga tooska ah'),
('aa','producer.benefit_direct','Gurguraa tokkicha'),
('am','producer.benefit_direct','ቀጥተኛ ሽያጭ'),

('en','producer.benefit_direct_desc','Reach customers directly without intermediaries'),
('zh','producer.benefit_direct_desc','直接接触客户，无需中间商'),
('so','producer.benefit_direct_desc','Macaamiisha geli si toos ah iyada oo aan dhexdhexaadiyayaasha jirin'),
('aa','producer.benefit_direct_desc','Macaangalii dhibbentee hidda wajjin dhuguma qunnami'),
('am','producer.benefit_direct_desc','ያለ ሸምጋዮች ቀጥታ ደንበኞችን ደርሱ'),

('en','producer.benefit_dashboard','Simple dashboard'),
('zh','producer.benefit_dashboard','简单仪表板'),
('so','producer.benefit_dashboard','Xog fudud'),
('aa','producer.benefit_dashboard','Gabaasa salphaa'),
('am','producer.benefit_dashboard','ቀላል ዳሽቦርድ'),

('en','producer.benefit_dashboard_desc','Manage your products and orders easily'),
('zh','producer.benefit_dashboard_desc','轻松管理您的产品和订单'),
('so','producer.benefit_dashboard_desc','Maamul badeecadahaaga iyo dalabyadaada si fudud'),
('aa','producer.benefit_dashboard_desc','Oomishoota ajandootta kee salphaan qindeessi'),
('am','producer.benefit_dashboard_desc','ምርቶቻችሁን እና ትዕዛዞቻችሁን በቀላሉ ያስተዳድሩ'),

('en','producer.benefit_payment','Fast payment'),
('zh','producer.benefit_payment','快速付款'),
('so','producer.benefit_payment','Lacag bixin degdeg ah'),
('aa','producer.benefit_payment','Kaffaltiinsa ariifate'),
('am','producer.benefit_payment','ፈጣን ክፍያ'),

('en','producer.benefit_payment_desc','Receive payments directly for your products'),
('zh','producer.benefit_payment_desc','直接接收产品付款'),
('so','producer.benefit_payment_desc','Si toos ah u hel lacagaha badeecadahaaga'),
('aa','producer.benefit_payment_desc','Oomishoota kee kaffaltiinsa dhuguma argadhu'),
('am','producer.benefit_payment_desc','ለምርቶቻችሁ ቀጥታ ክፍያ ይቀበሉ'),

('en','producer.form_title','Producer application'),
('zh','producer.form_title','生产者申请'),
('so','producer.form_title','Codsiga beeralaha'),
('aa','producer.form_title','Oomishitoota gaaffii'),
('am','producer.form_title','የአምራቾች ማመልከቻ'),

('en','producer.sending','Sending...'),
('zh','producer.sending','发送中...'),
('so','producer.sending','Dirayaa...'),
('aa','producer.sending','Ergamaa...'),
('am','producer.sending','በመላክ ላይ...'),

('en','producer.send_request','Send my request'),
('zh','producer.send_request','发送我的申请'),
('so','producer.send_request','Dir codsigayga'),
('aa','producer.send_request','Gaaffii koo ergi'),
('am','producer.send_request','ጥያቄዬን ላክ')

-- ============================================================
-- LOGIN PAGE (nouvelles clés)
-- ============================================================
('en','login.tab_signin','Sign in'),
('zh','login.tab_signin','登录'),
('so','login.tab_signin','Gal'),
('aa','login.tab_signin','Gali'),
('am','login.tab_signin','ግባ'),

('en','login.tab_register','Sign up'),
('zh','login.tab_register','注册'),
('so','login.tab_register','Is diiwaangeli'),
('aa','login.tab_register','Gartisi'),
('am','login.tab_register','ተመዝገቡ'),

('en','login.signin_sub','Sign in to access your account.'),
('zh','login.signin_sub','登录以访问您的账户。'),
('so','login.signin_sub','Gal si aad u hesho xisaabtaada.'),
('aa','login.signin_sub','Akkaawuntikoo seenuuf gali.'),
('am','login.signin_sub','መለያዎን ለመድረስ ይግቡ።'),

('en','login.register_sub','Join the organic market of Djibouti.'),
('zh','login.register_sub','加入吉布提有机市场。'),
('so','login.register_sub','Ku biir suuqa dabiiciga ah ee Jabuuti.'),
('aa','login.register_sub','Gabuutih naaturraalaa giyyo seenu.'),
('am','login.register_sub','የጂቡቲ ኦርጋኒክ ገበያን ይቀላቀሉ።'),

('en','login.google','Continue with Google'),
('zh','login.google','使用 Google 继续'),
('so','login.google','Ku sii wad Google'),
('aa','login.google','Google wajjin itti fufi'),
('am','login.google','በGoogle ቀጥል'),

('en','login.or','or'),
('zh','login.or','或'),
('so','login.or','ama'),
('aa','login.or','yookaan'),
('am','login.or','ወይም'),

('en','login.name','Full name'),
('zh','login.name','全名'),
('so','login.name','Magaca oo dhan'),
('aa','login.name','Maqishsho gurraacho'),
('am','login.name','ሙሉ ስም'),

('en','login.name_placeholder','Ahmed Hassan'),
('zh','login.name_placeholder','Ahmed Hassan'),
('so','login.name_placeholder','Ahmed Hassan'),
('aa','login.name_placeholder','Ahmed Hassan'),
('am','login.name_placeholder','Ahmed Hassan'),

('en','login.forgot_password','Forgot password?'),
('zh','login.forgot_password','忘记密码？'),
('so','login.forgot_password','Furaha sirta ma illowday?'),
('aa','login.forgot_password','Iccitii dagatte?'),
('am','login.forgot_password','የሚስጥር ቁጥር ረሳሃ?'),

('en','login.password_hint','Minimum 6 characters'),
('zh','login.password_hint','最少6个字符'),
('so','login.password_hint','Ugu yaraan 6 xaraf'),
('aa','login.password_hint','Xiqqaate qubee 6'),
('am','login.password_hint','ቢያንስ 6 ቁምፊዎች'),

('en','login.panel_title','Fresh products,'),
('zh','login.panel_title','新鲜产品，'),
('so','login.panel_title','Badeecadaha cusub,'),
('aa','login.panel_title','Oomishoota horoo,'),
('am','login.panel_title','ትኩስ ምርቶች,'),

('en','login.panel_accent','directly from farms'),
('zh','login.panel_accent','直接来自农场'),
('so','login.panel_accent','si toos ah beerta'),
('aa','login.panel_accent','beeralee karraa dhuguma'),
('am','login.panel_accent','ቀጥታ ከእርሻዎች'),

('en','login.panel_sub','Organic, local, delivered in 48h from Djiboutian producers.'),
('zh','login.panel_sub','有机、本地，48小时内由吉布提生产者配送。'),
('so','login.panel_sub','Dabiici, maxalig, 48 saac la geeyo oo beeraleyda Jabuuriyiinta ah.'),
('aa','login.panel_sub','Naaturraalaa, naannoo, saata 48 Gabuutih oomishitootaa karraa geeffame.'),
('am','login.panel_sub','ኦርጋኒክ፣ ሀገር-ውስጥ፣ ከጂቡቲ አምራቾች በ48 ሰዓት ይደርሳል።'),

('en','login.feature_bio','Certified organic and local products'),
('zh','login.feature_bio','有机认证和本地产品'),
('so','login.feature_bio','Badeecadaha dabiiciga ah oo la xaqiijiyey iyo maxaliga'),
('aa','login.feature_bio','Naaturraalaa mirkana''e naannoo oomishoota'),
('am','login.feature_bio','የተረጋገጠ ኦርጋኒክ እና የአካባቢ ምርቶች'),

('en','login.feature_delivery','48h delivery in Djibouti'),
('zh','login.feature_delivery','吉布提48小时配送'),
('so','login.feature_delivery','Geyn 48 saac Jabuuti'),
('aa','login.feature_delivery','Saata 48 Gabuutih geeshi'),
('am','login.feature_delivery','48 ሰዓት ዴሊቨሪ ጂቡቲ'),

('en','login.feature_producers','Directly from producers'),
('zh','login.feature_producers','直接来自生产者'),
('so','login.feature_producers','Si toos ah beeraleyda'),
('aa','login.feature_producers','Oomishitootaa karraa dhuguma'),
('am','login.feature_producers','ቀጥታ ከአምራቾች'),

('en','login.feature_payment','Payment via Waafi, D-Money or cash'),
('zh','login.feature_payment','通过 Waafi、D-Money 或现金支付'),
('so','login.feature_payment','Lacag bixin Waafi, D-Money ama lacagta'),
('aa','login.feature_payment','Waafi, D-Money yookaan maallaqa kanfaltii'),
('am','login.feature_payment','በWaafi፣ D-Money ወይም ጥሬ ገንዘብ ክፍያ'),

-- CHECKOUT AUTH GATE
('en','checkout.auth_gate_title','Identify yourself to continue'),
('zh','checkout.auth_gate_title','请登录以继续'),
('so','checkout.auth_gate_title','Is aqoonso si aad u sii wato'),
('aa','checkout.auth_gate_title','Seenu hinaffe itti fufi'),
('am','checkout.auth_gate_title','ለመቀጠል እራስዎን ያስተዋውቁ'),

('en','checkout.auth_gate_sub','Sign in to track your orders, or continue as a guest.'),
('zh','checkout.auth_gate_sub','登录以跟踪您的订单，或以访客身份继续。'),
('so','checkout.auth_gate_sub','Gal si aad u raacdo dalabyadaada, ama sii wad adiga oo martida ah.'),
('aa','checkout.auth_gate_sub','Ajajjoota kee ilaaluuf seenu, yookaan martii ta''ee itti fufi.'),
('am','checkout.auth_gate_sub','ትዕዛዞችዎን ለመከታተል ይግቡ፣ ወይም እንደ እንግዳ ይቀጥሉ።'),

('en','checkout.auth_signin','🔑 Sign in / Register'),
('zh','checkout.auth_signin','🔑 登录 / 注册'),
('so','checkout.auth_signin','🔑 Gal / Is diiwaangeli'),
('aa','checkout.auth_signin','🔑 Seenu / Gartisi'),
('am','checkout.auth_signin','🔑 ግባ / ተመዝገቡ'),

('en','checkout.auth_guest','Continue without account →'),
('zh','checkout.auth_guest','不登录继续 →'),
('so','checkout.auth_guest','Sii wad la''aanta akoon →'),
('aa','checkout.auth_guest','Akkaawunti la''aa itti fufi →'),
('am','checkout.auth_guest','ያለ መለያ ቀጥል →'),

-- ADMIN ORDERS — nouvelles clés
('en','admin.order_delivery','Delivery'),
('zh','admin.order_delivery','配送'),
('so','admin.order_delivery','Geynta'),
('aa','admin.order_delivery','Geeshii'),
('am','admin.order_delivery','ዴሊቨሪ'),

('en','admin.order_name','Customer'),
('zh','admin.order_name','客户'),
('so','admin.order_name','Macmiilka'),
('aa','admin.order_name','Macca''alaa'),
('am','admin.order_name','ደንበኛ'),

('en','admin.order_phone','Phone'),
('zh','admin.order_phone','电话'),
('so','admin.order_phone','Telefoonka'),
('aa','admin.order_phone','Teleefonni'),
('am','admin.order_phone','ስልክ'),

('en','admin.order_address','Address'),
('zh','admin.order_address','地址'),
('so','admin.order_address','Cinwaanka'),
('aa','admin.order_address','Teessoo'),
('am','admin.order_address','አድራሻ'),

('en','admin.order_payment','Payment'),
('zh','admin.order_payment','付款方式'),
('so','admin.order_payment','Lacag bixinta'),
('aa','admin.order_payment','Kanfaltii'),
('am','admin.order_payment','ክፍያ')

ON CONFLICT (language_code, key) DO UPDATE SET value = EXCLUDED.value;

-- =============================================================
-- NOUVEAUX BLOCS HOMEPAGE — Sélection du moment
-- =============================================================
INSERT INTO ui_translations (language_code, key, value) VALUES
('en','featuredTitle','Selection of the moment'),
('zh','featuredTitle','精选推荐'),
('so','featuredTitle','Xulashada wakhtiga'),
('aa','featuredTitle','Doorbidhii wakti'),
('am','featuredTitle','የጊዜው ምርጥ ምርቶች'),

('en','featuredSub','Hand-picked products by our team — anti-waste & great deals'),
('zh','featuredSub','我们团队精心挑选的产品 — 减少浪费和优惠'),
('so','featuredSub','Badeecadaha ay xushay kooxdeenna — ka hortagga lumeynta & qiimaha fiican'),
('aa','featuredSub','Noo meeciin boodde qoriinama — baddaleyta daafitta & hagaagsi'),
('am','featuredSub','በቡድናችን የተመረጡ ምርቶች — ብክነትን መቀነስ እና ጥሩ ዋጋዎች'),

-- =============================================================
-- NOUVEAUX BLOCS HOMEPAGE — Espace producteur
-- =============================================================
('en','producerSpaceTag','Producer Space'),
('zh','producerSpaceTag','生产者空间'),
('so','producerSpaceTag','Goobta Beeralayda'),
('aa','producerSpaceTag','Oomishittoota Maqiishi'),
('am','producerSpaceTag','የአምራቾች ቦታ'),

('en','producerSpaceTitle','Are you a producer?'),
('zh','producerSpaceTitle','您是生产者吗？'),
('so','producerSpaceTitle','Ma tahay beeraleye?'),
('aa','producerSpaceTitle','Oomishitto mittu?'),
('am','producerSpaceTitle','አምራች ነዎት?'),

('en','producerSpaceTitle2','Join our network'),
('zh','producerSpaceTitle2','加入我们的网络'),
('so','producerSpaceTitle2','Ku biir shabakadeenna'),
('aa','producerSpaceTitle2','Shabakoyta kee gali'),
('am','producerSpaceTitle2','ወደ አውታረ መረባችን ይቀላቀሉ'),

('en','producerSpaceDesc','Racine Bio supports you beyond sales: seeds, agronomic advice, shared equipment and a community of engaged producers.'),
('zh','producerSpaceDesc','Racine Bio不仅支持您的销售，还提供种子、农业建议、共享设备和积极的生产者社区。'),
('so','producerSpaceDesc','Racine Bio waxay kaa caawisaa intii ka baxeysa iibka: abuurka, talooyinka beeraha, qaladaadka la wadaago iyo beeralayda iskaashada ah.'),
('aa','producerSpaceDesc','Racine Bio kee gargaara garra giddini bakoyta kee: xiinoota, gorsha oomishii, qaala wadaagitta noo boodde oomishittoota'),
('am','producerSpaceDesc','Racine Bio ከሽያጭ ባሻገር ይደግፍዎታል፡ ዘሮች፣ የግብርና ምክር፣ የጋራ መሳሪያዎች እና ቁርጠኛ አምራቾች ማህበረሰብ።'),

('en','producerSpaceCta','Discover the benefits'),
('zh','producerSpaceCta','了解优势'),
('so','producerSpaceCta','Ogaaw faa\'iidooyinka'),
('aa','producerSpaceCta','Faydoota og'),
('am','producerSpaceCta','ጥቅሞቹን ያግኙ'),

('en','ps.seeds','Organic seeds'),
('zh','ps.seeds','有机种子'),
('so','ps.seeds','Abuurka dabiiciga ah'),
('aa','ps.seeds','Xiinoota naaturraalaa'),
('am','ps.seeds','ኦርጋኒክ ዘሮች'),

('en','ps.seeds_desc','Access to certified seeds at preferential rates'),
('zh','ps.seeds_desc','以优惠价格获得认证种子'),
('so','ps.seeds_desc','Helitaanka abuurka la xaqiijiyey qiimo gaar ah'),
('aa','ps.seeds_desc','Xiinoota mirkaneeffaman qixxeessi fiixe kee helti'),
('am','ps.seeds_desc','በቅድሚያ ዋጋ የተረጋገጡ ዘሮችን ማግኘት'),

('en','ps.advice','Agronomic advice'),
('zh','ps.advice','农业建议'),
('so','ps.advice','Talooyinka beeraha'),
('aa','ps.advice','Gorsha oomishii'),
('am','ps.advice','የግብርና ምክር'),

('en','ps.advice_desc','Experts available to guide you'),
('zh','ps.advice_desc','专家随时为您提供指导'),
('so','ps.advice_desc','Khubarada u diyaarka inay kugu hogaamiyaan'),
('aa','ps.advice_desc','Ogummaanottoota geeddissi kee xiinawaa'),
('am','ps.advice_desc','ለመምራት ዝግጁ የሆኑ ባለሙያዎች'),

('en','ps.equipment','Shared equipment'),
('zh','ps.equipment','共享设备'),
('so','ps.equipment','Qaladaadka wadaaga'),
('aa','ps.equipment','Qaala wadaagitta'),
('am','ps.equipment','የጋራ መሳሪያዎች'),

('en','ps.equipment_desc','Rental and lending between partner producers'),
('zh','ps.equipment_desc','合作生产者之间的租赁和借用'),
('so','ps.equipment_desc','Kireynta iyo amaahdaynta u dhaxeysa beeralayda'),
('aa','ps.equipment_desc','Kireessa noo keenaa oomishittoota nagaha'),
('am','ps.equipment_desc','በአጋር አምራቾች መካከል ኪራይ እና ብድር'),

('en','ps.community','Community'),
('zh','ps.community','社区'),
('so','ps.community','Bulshada'),
('aa','ps.community','Jamiyyatii'),
('am','ps.community','ማህበረሰብ'),

('en','ps.community_desc','Exchange, mutual support and shared experiences'),
('zh','ps.community_desc','交流、互相支持和共享经验'),
('so','ps.community_desc','Is-weydaarsiga, taageerada is-dhaafsiga iyo khibradaha la wadaaga'),
('aa','ps.community_desc','Foodishiimi, gargaarsi is-baalte noo xaajoota wadaagitta'),
('am','ps.community_desc','ልውውጥ፣ የጋራ ድጋፍ እና የጋራ ልምዶች'),

-- =============================================================
-- NOUVEAUX BLOCS HOMEPAGE — Comment ça marche
-- =============================================================
('en','howItWorksTitle','How does it work?'),
('zh','howItWorksTitle','如何运作？'),
('so','howItWorksTitle','Sidee u shaqeysaa?'),
('aa','howItWorksTitle','Hiittoo shaggeessa?'),
('am','howItWorksTitle','እንዴት ይሰራል?'),

('en','howItWorksSub','Order your fresh products in 3 simple steps'),
('zh','howItWorksSub','3个简单步骤订购您的新鲜产品'),
('so','howItWorksSub','Dalbashada badeecadahaaga cusub 3 tallaabo oo fudud'),
('aa','howItWorksSub','Oomishootak cusheyta 3 tarki salaamate dalbaddi'),
('am','howItWorksSub','ትኩስ ምርቶችዎን በ3 ቀላል ደረጃዎች ይዘዙ'),

('en','howStepLabel','Step'),
('zh','howStepLabel','步骤'),
('so','howStepLabel','Tallaabooyinka'),
('aa','howStepLabel','Tarki'),
('am','howStepLabel','ደረጃ'),

('en','howStep1Title','Browse'),
('zh','howStep1Title','浏览'),
('so','howStep1Title','Raadi'),
('aa','howStep1Title','Doo'),
('am','howStep1Title','ያስሱ'),

('en','howStep1Desc','Explore our organic and local products, filtered by category, origin or type.'),
('zh','howStep1Desc','探索我们的有机和本地产品，按类别、产地或类型过滤。'),
('so','howStep1Desc','Sahami badeecadaheenna dabiiciga ah iyo kuwa maxalliga ah, u shaandheeyay qaybta, xigmadda ama nooca.'),
('aa','howStep1Desc','Oomishootayta naaturraalaa noo maxallitta sahami, qaybii, asalii noo noocii la gaazizine.'),
('am','howStep1Desc','የኦርጋኒክ እና የአካባቢ ምርቶቻችንን ያስሱ፣ በምድብ፣ ምንጭ ወይም አይነት ተጣርተዋል።'),

('en','howStep2Title','Order'),
('zh','howStep2Title','下单'),
('so','howStep2Title','Dalbo'),
('aa','howStep2Title','Dalbi'),
('am','howStep2Title','ይዘዙ'),

('en','howStep2Desc','Add to cart, choose your payment method and confirm in a few clicks.'),
('zh','howStep2Desc','加入购物车，选择支付方式，几次点击即可确认。'),
('so','howStep2Desc','Ku dar dambiilaha, dooro habka lacag bixinta oo xaqiiji dhawr gujis ah.'),
('aa','howStep2Desc','Dambiilaha ku geli, kanfallii hab doori noo gujiyeessa lama\'eennaamin xaqiiji.'),
('am','howStep2Desc','ወደ ጋሪ ያክሉ፣ የክፍያ ዘዴዎን ይምረጡ እና በጥቂት ጠቅታዎች ያረጋግጡ።'),

('en','howStep3Title','Receive'),
('zh','howStep3Title','收货'),
('so','howStep3Title','Qaado'),
('aa','howStep3Title','Fuuddi'),
('am','howStep3Title','ይቀበሉ'),

('en','howStep3Desc','Your fresh products are delivered directly from farms to your door.'),
('zh','howStep3Desc','您的新鲜产品从农场直接送到您家门口。'),
('so','howStep3Desc','Badeecadahaaga cusub waxaa lagu gaarsiin doonaa xarunnahaaga tooska ka ah beerta.'),
('aa','howStep3Desc','Oomishootak cusheyta foolkaatak boodde tooska geeddabbeessa kee geeda.'),
('am','howStep3Desc','ትኩስ ምርቶችዎ ከእርሻ ቦታዎች ቀጥታ ወደ ቤትዎ ይቀርባሉ።'),

('en','howCta','Start shopping'),
('zh','howCta','开始购物'),
('so','howCta','Bilow xarashada'),
('aa','howCta','Gatii biisi'),
('am','howCta','ግዢ ይጀምሩ'),

-- =============================================================
-- PAGE BECOME-PRODUCER — Toutes les clés bp.*
-- =============================================================
('en','bp.hero_tag','Partner Producers Programme'),
('zh','bp.hero_tag','合作生产者计划'),
('so','bp.hero_tag','Barnaamijka Beeralayda Iskaashiga'),
('aa','bp.hero_tag','Barnaamijii Oomishittoota Nageeytitta'),
('am','bp.hero_tag','የአጋር አምራቾች ፕሮግራም'),

('en','bp.hero_title1','Sell better,'),
('zh','bp.hero_title1','卖得更好，'),
('so','bp.hero_title1','Si fiican u iibso,'),
('aa','bp.hero_title1','Hagaagsi gattaddi,'),
('am','bp.hero_title1','በተሻለ ሁኔታ ይሽጡ,'),

('en','bp.hero_title2','grow with us'),
('zh','bp.hero_title2','与我们共同成长'),
('so','bp.hero_title2','naga wax baaro'),
('aa','bp.hero_title2','noo walaalesso ol\'olu'),
('am','bp.hero_title2','ከኛ ጋር ያድጉ'),

('en','bp.hero_desc','Racine Bio opens you access to a direct market, as well as concrete resources to develop your agricultural activity.'),
('zh','bp.hero_desc','Racine Bio为您开放直接市场，同时提供发展农业活动的具体资源。'),
('so','bp.hero_desc','Racine Bio waxay kuu furtaa suuq toos ah, iyo kheyraad xaqiiqda ah si aad u horumariso hawshaada beeraha.'),
('aa','bp.hero_desc','Racine Bio suuqa tooskii kee furtaa, kadhaan kheyraad haqiiqii oomishii boosha kee horonsiisi.'),
('am','bp.hero_desc','Racine Bio ቀጥተኛ ገበያ ያሳርፍልዎታል፣ እንዲሁም የግብርና እንቅስቃሴዎን ለማዳበር ተጨባጭ ሀብቶች።'),

('en','bp.hero_cta','Submit my application'),
('zh','bp.hero_cta','提交我的申请'),
('so','bp.hero_cta','Soo dir codsigayga'),
('aa','bp.hero_cta','Codsiima koo dir'),
('am','bp.hero_cta','ማመልከቻዬን አስገባ'),

('en','bp.benefits_title','What you gain by joining Racine Bio'),
('zh','bp.benefits_title','加入Racine Bio的收益'),
('so','bp.benefits_title','Maxaad ka helaysaa ku biirista Racine Bio'),
('aa','bp.benefits_title','Racine Bio ku biirtaa maa faaydootaa'),
('am','bp.benefits_title','Racine Bio ሲቀላቀሉ የሚያገኙት'),

('en','bp.benefits_sub','Much more than a sales platform'),
('zh','bp.benefits_sub','远不止一个销售平台'),
('so','bp.benefits_sub','Waxaa ka badan goob iibinta'),
('aa','bp.benefits_sub','Gattanno maqiishi garra'),
('am','bp.benefits_sub','ከሽያጭ መድረክ በላይ ብዙ'),

('en','bp.b1_title','Direct sales'),
('zh','bp.b1_title','直销'),
('so','bp.b1_title','Iibka tooska ah'),
('aa','bp.b1_title','Gattii tooskii'),
('am','bp.b1_title','ቀጥተኛ ሽያጭ'),

('en','bp.b1_desc','Reach thousands of consumers without intermediaries. You set your prices, you keep your margins.'),
('zh','bp.b1_desc','直接接触数千名消费者，无需中间商。您定价，您保留利润。'),
('so','bp.b1_desc','Gaar isticmaaleyaasha iyada oo aan lahayn dhexdhexaadiyayaal. Adiga ayaa qiimaha go\'aamiyo.'),
('aa','bp.b1_desc','Dhibaatoobe la\'aantii gattitootamaa kumaankuuma gari. Qixxeessoota kee amaana, margini kee qabaddaddi.'),
('am','bp.b1_desc','ያለ አስታራቂዎች ሺዎች ሸማቾችን ይድረሱ። ዋጋዎን ያስተካክሉ፣ ትርፍዎን ይጠብቁ።'),

('en','bp.b2_title','Certified organic seeds'),
('zh','bp.b2_title','认证有机种子'),
('so','bp.b2_title','Abuurka dabiiciga la xaqiijiyey'),
('aa','bp.b2_title','Xiinoota naaturraalaa mirkaneeffama'),
('am','bp.b2_title','የተረጋገጡ ኦርጋኒክ ዘሮች'),

('en','bp.b2_desc','Access to quality seeds at preferential rates negotiated with our agricultural partners.'),
('zh','bp.b2_desc','以与农业伙伴协商的优惠价格获得优质种子。'),
('so','bp.b2_desc','Helitaanka abuurka tayo leh qiimaha la xoojiyey la wadaagay wadahadal beeralayda.'),
('aa','bp.b2_desc','Qixxeessi fiixe la guddoomame xinaata nageeytitta noo xiinoota tayo leh helti.'),
('am','bp.b2_desc','ከግብርና አጋሮቻችን ጋር በተደራደረ ቅድሚያ ዋጋ ጥራት ያላቸው ዘሮችን ማግኘት።'),

('en','bp.b3_title','Agronomic advice'),
('zh','bp.b3_title','农业技术咨询'),
('so','bp.b3_title','Talooyinka xirfadlayaasha beeraha'),
('aa','bp.b3_title','Gorsha oomishii xobbii'),
('am','bp.b3_title','የግብርና ባለሙያ ምክር'),

('en','bp.b3_desc','Personalized technical support: crop rotation, organic farming, water management.'),
('zh','bp.b3_desc','个性化技术支持：轮作、有机农业、水资源管理。'),
('so','bp.b3_desc','Taageero farsameed oo shakhsi ah: wareejinta dalagga, beerashada dabiiciga, maareynta biyaha.'),
('aa','bp.b3_desc','Gargaarsa farsamoo shakhsii: wareegga beertii, oomishii naaturraalaa, bixxii maamuli.'),
('am','bp.b3_desc','ግላዊ ቴክኒካዊ ድጋፍ፡ የሰብል ሽክርክር፣ ኦርጋኒክ እርሻ፣ የውሃ አስተዳደር።'),

('en','bp.b4_title','Shared agricultural equipment'),
('zh','bp.b4_title','共享农业设备'),
('so','bp.b4_title','Qaladaadka beeraha ee la wadaago'),
('aa','bp.b4_title','Qaala oomishii wadaagitta'),
('am','bp.b4_title','የጋራ የግብርና መሳሪያዎች'),

('en','bp.b4_desc','Access to shared equipment between partner producers — rental, lending, collective maintenance.'),
('zh','bp.b4_desc','合作生产者之间共享设备的使用权——租赁、借用、集体维护。'),
('so','bp.b4_desc','Helitaanka qaladaadka la wadaago u dhaxeeya beeralayda — kireynta, amaahdaynta, dayactirka.'),
('aa','bp.b4_desc','Oomishittoota nagaha u dhaxaa qaala wadaagitta helti — kireessa, amaanahii, dayactirkii wadajirkii.'),
('am','bp.b4_desc','በአጋር አምራቾች መካከል የጋራ መሳሪያዎችን ማግኘት — ኪራይ፣ ብድር፣ የጋራ ጥገና።'),

('en','bp.b5_title','Exchange space'),
('zh','bp.b5_title','交流空间'),
('so','bp.b5_title','Goobta is-weydaarsiga'),
('aa','bp.b5_title','Foodishiimi maqiishi'),
('am','bp.b5_title','የልውውጥ ቦታ'),

('en','bp.b5_desc','Join an active community of producers. Share your experiences, build together.'),
('zh','bp.b5_desc','加入活跃的生产者社区。分享您的经验，共同建设。'),
('so','bp.b5_desc','Ku biir bulshada firfircoon ee beeralayda. La wadaag khibradahaaga, wada dhis.'),
('aa','bp.b5_desc','Oomishittoota jamiyyatii firfircoon ku gali. Muuxxoota kee wadaagi, wada dhisi.'),
('am','bp.b5_desc','ንቁ የአምራቾች ማህበረሰብ ይቀላቀሉ። ልምዶችዎን ያጋሩ፣ አብረው ይገንቡ።'),

('en','bp.b6_title','Complete dashboard'),
('zh','bp.b6_title','完整仪表板'),
('so','bp.b6_title','Miiska shaqada oo buuxa'),
('aa','bp.b6_title','Daashboordii guutu'),
('am','bp.b6_title','ሙሉ ዳሽቦርድ'),

('en','bp.b6_desc','Manage your products, stock and orders in real time from your personal producer space.'),
('zh','bp.b6_desc','从您的个人生产者空间实时管理您的产品、库存和订单。'),
('so','bp.b6_desc','Maamul badeecadahaaga, kaydkaaga iyo amarradaada wakti dhabta ah goobta shakhsiga ah.'),
('aa','bp.b6_desc','Oomishootaaka, kaydkaaka noo dalbaddeeka wakti dhabta maqiishikaaka shakhsii maamu.'),
('am','bp.b6_desc','ምርቶችዎን፣ ክምችትዎን እና ትዕዛዞችዎን ከግላዊ አምራቾ ቦታዎ በቀጥታ ያስተዳድሩ።'),

('en','bp.stat1','Products verified and traceable'),
('zh','bp.stat1','产品经过验证和可追溯'),
('so','bp.stat1','Badeecadaha la xaqiijiyey oo la raadraaci karo'),
('aa','bp.stat1','Oomishoota mirkaneeffama noo raadraacamaa'),
('am','bp.stat1','ምርቶቹ የተረጋገጡ እና ሊከታተሉ የሚቻሉ'),

('en','bp.stat2','Application processing time'),
('zh','bp.stat2','申请处理时间'),
('so','bp.stat2','Wakhtiga u qaadato codsiyada'),
('aa','bp.stat2','Codsiima magansumitta wakti'),
('am','bp.stat2','የማመልከቻ ማስኬጃ ጊዜ'),

('en','bp.stat3','Commission for the first 3 months'),
('zh','bp.stat3','前3个月的佣金'),
('so','bp.stat3','Komishanada 3-da bilood ee koowaad'),
('aa','bp.stat3','Komisyonii 3 bilii kowaayttii'),
('am','bp.stat3','ለመጀመሪያ 3 ወራት ኮሚሽን'),

('en','bp.steps_title','How to join the network?'),
('zh','bp.steps_title','如何加入网络？'),
('so','bp.steps_title','Sidee loo biiraa shabakada?'),
('aa','bp.steps_title','Hiittoo shabakoyta ku gali?'),
('am','bp.steps_title','አውታረ መረቡን እንዴት መቀላቀል ይቻላል?'),

('en','bp.step_label','Step'),
('zh','bp.step_label','步骤'),
('so','bp.step_label','Tallaabo'),
('aa','bp.step_label','Tarki'),
('am','bp.step_label','ደረጃ'),

('en','bp.step1_title','Submit your application'),
('zh','bp.step1_title','提交您的申请'),
('so','bp.step1_title','Soo dir codsigaaga'),
('aa','bp.step1_title','Codsiima koo dir'),
('am','bp.step1_title','ማመልከቻዎን ያስገቡ'),

('en','bp.step1_desc','Fill in the form below. It is quick — 2 minutes is enough.'),
('zh','bp.step1_desc','填写下面的表格。很快 — 2分钟就够了。'),
('so','bp.step1_desc','Buuxi foomka hoose. Waa degdeg — 2 daqiiqo ayaa ku filnaan doonta.'),
('aa','bp.step1_desc','Booda foomka giddiima. Salphu — 2 daqiiqo ku eexxa.'),
('am','bp.step1_desc','ከዚህ በታች ያለውን ቅጽ ይሙሉ። ፈጣን ነው — 2 ደቂቃ ይበቃል።'),

('en','bp.step2_title','Interview with our team'),
('zh','bp.step2_title','与我们团队面谈'),
('so','bp.step2_title','Wareysiga kooxdeenna'),
('aa','bp.step2_title','Kooxoyta koo noo gorgortan'),
('am','bp.step2_title','ከቡድናችን ጋር ቃለ ምልልስ'),

('en','bp.step2_desc','We contact you within 48h to validate your profile and answer your questions.'),
('zh','bp.step2_desc','我们在48小时内联系您以验证您的档案并回答您的问题。'),
('so','bp.step2_desc','Waxaan kula soo xiriiraa 48s si aan u xaqiijino astaammahaaga oo aan su\'aalahaaga ka jawaabno.'),
('aa','bp.step2_desc','48s gudda koo la xiriirra astaammahaaka xaqiijisi noo su\'aalaaka ka jawaabi.'),
('am','bp.step2_desc','ፕሮፋይልዎን ለማረጋገጥ እና ጥያቄዎችዎን ለመመለስ በ48 ሰዓት ውስጥ እናገኝዎታለን።'),

('en','bp.step3_title','Start selling'),
('zh','bp.step3_title','开始销售'),
('so','bp.step3_title','Bilow iibinta'),
('aa','bp.step3_title','Gattii biisi'),
('am','bp.step3_title','መሸጥ ይጀምሩ'),

('en','bp.step3_desc','Your space is activated. Add your products and receive your first orders.'),
('zh','bp.step3_desc','您的空间已激活。添加您的产品并接收您的第一批订单。'),
('so','bp.step3_desc','Goobtagaaga waa la hawlgeliyey. Ku dar badeecadahaaga oo hel amarradaada koowaad.'),
('aa','bp.step3_desc','Maqiishikaaka hawlgelame. Oomishootaaka ku geli noo dalbaddeekii kowaayttii fuuddi.'),
('am','bp.step3_desc','ቦታዎ ነቅሏል። ምርቶችዎን ያክሉ እና የመጀመሪያ ትዕዛዞችዎን ይቀበሉ።'),

('en','bp.form_title','Application form'),
('zh','bp.form_title','申请表'),
('so','bp.form_title','Foomka codsiga'),
('aa','bp.form_title','Foomki codsiimaa'),
('am','bp.form_title','የማመልከቻ ቅጽ'),

('en','bp.form_required','All fields marked * are required.'),
('zh','bp.form_required','所有标有*的字段均为必填项。'),
('so','bp.form_required','Dhammaan meelaha lagu calaamadeeyey * waa waajib.'),
('aa','bp.form_required','Meelaha * la calaamadiise hunda waajibba.'),
('am','bp.form_required','* ምልክት ያላቸው ሁሉም ሜዳዎች አስፈላጊ ናቸው።'),

('en','bp.field_fullname','Full name'),
('zh','bp.field_fullname','全名'),
('so','bp.field_fullname','Magaca oo dhan'),
('aa','bp.field_fullname','Maqaa cuuqu'),
('am','bp.field_fullname','ሙሉ ስም'),

('en','bp.field_email','Email'),
('zh','bp.field_email','电子邮件'),
('so','bp.field_email','Iimeelka'),
('aa','bp.field_email','Iimeelii'),
('am','bp.field_email','ኢሜይል'),

('en','bp.field_phone','Phone'),
('zh','bp.field_phone','电话'),
('so','bp.field_phone','Telefoonka'),
('aa','bp.field_phone','Teleefonni'),
('am','bp.field_phone','ስልክ'),

('en','bp.field_region','Region'),
('zh','bp.field_region','地区'),
('so','bp.field_region','Gobolka'),
('aa','bp.field_region','Qaallacha'),
('am','bp.field_region','ክልል'),

('en','bp.field_farm_name','Farm name'),
('zh','bp.field_farm_name','农场名称'),
('so','bp.field_farm_name','Magaca beerta'),
('aa','bp.field_farm_name','Beertii maqaa'),
('am','bp.field_farm_name','የእርሻ ስም'),

('en','bp.field_farm_size','Cultivated area'),
('zh','bp.field_farm_size','耕种面积'),
('so','bp.field_farm_size','Dhulka la beeray'),
('aa','bp.field_farm_size','Beertii dhexxa'),
('am','bp.field_farm_size','የሚታረስ መሬት'),

('en','bp.field_experience','Years of farming experience'),
('zh','bp.field_experience','农业经验年数'),
('so','bp.field_experience','Sannnadaha khibradda beeraha'),
('aa','bp.field_experience','Oomishii muuxxoo sannado'),
('am','bp.field_experience','የእርሻ ልምድ ዓመታት'),

('en','bp.select_placeholder','Select'),
('zh','bp.select_placeholder','选择'),
('so','bp.select_placeholder','Dooro'),
('aa','bp.select_placeholder','Doori'),
('am','bp.select_placeholder','ይምረጡ'),

('en','bp.exp_0_2','Less than 2 years'),
('zh','bp.exp_0_2','不到2年'),
('so','bp.exp_0_2','Ka yar 2 sano'),
('aa','bp.exp_0_2','2 sanottu garra'),
('am','bp.exp_0_2','ከ2 ዓመት በታች'),

('en','bp.exp_2_5','2 to 5 years'),
('zh','bp.exp_2_5','2至5年'),
('so','bp.exp_2_5','2 ilaa 5 sano'),
('aa','bp.exp_2_5','2 noo 5 sanottu'),
('am','bp.exp_2_5','2 እስከ 5 ዓመት'),

('en','bp.exp_5_10','5 to 10 years'),
('zh','bp.exp_5_10','5至10年'),
('so','bp.exp_5_10','5 ilaa 10 sano'),
('aa','bp.exp_5_10','5 noo 10 sanottu'),
('am','bp.exp_5_10','5 እስከ 10 ዓመት'),

('en','bp.exp_10','More than 10 years'),
('zh','bp.exp_10','10年以上'),
('so','bp.exp_10','Ka badan 10 sano'),
('aa','bp.exp_10','10 sanottu garra'),
('am','bp.exp_10','ከ10 ዓመት በላይ'),

('en','bp.field_products','What products do you offer?'),
('zh','bp.field_products','您提供什么产品？'),
('so','bp.field_products','Badeecadaha maxaad bixisaa?'),
('aa','bp.field_products','Oomishoota maa bixittaa?'),
('am','bp.field_products','ምን ምርቶች ያቀርባሉ?'),

('en','bp.field_products_placeholder','Fresh vegetables, fruits, aromatic plants, eggs...'),
('zh','bp.field_products_placeholder','新鲜蔬菜、水果、芳香植物、鸡蛋...'),
('so','bp.field_products_placeholder','Khudradda cusub, miraha, dhirta udgoonka, ukunta...'),
('aa','bp.field_products_placeholder','Kudraata cusheyta, miirota, marqaaniita udgoonka, hanqallaata...'),
('am','bp.field_products_placeholder','ትኩስ አትክልቶች፣ ፍራፍሬዎች፣ ሽቱ ዕፅዋት፣ እንቁላሎች...'),

('en','bp.privacy_note','Your information is confidential and will only be used to process your application.'),
('zh','bp.privacy_note','您的信息是保密的，仅用于处理您的申请。'),
('so','bp.privacy_note','Macluumaadkaaga waa sir ah oo keliya loo isticmaali doonaa si loo maaliyo codsigaaga.'),
('aa','bp.privacy_note','Odeeffannooka maxreemaa noo codsiimaa magansumi kelitti itti fayyadamama.'),
('am','bp.privacy_note','መረጃዎ ሚስጥራዊ ሲሆን ማመልከቻዎን ለማስኬድ ብቻ ጥቅም ላይ ይውላል።'),

('en','bp.submit','Send my application'),
('zh','bp.submit','发送我的申请'),
('so','bp.submit','Dir codsigayga'),
('aa','bp.submit','Codsiima koo dir'),
('am','bp.submit','ማመልከቻዬን ላክ'),

('en','bp.contact_email_prefix','Our team will contact you at'),
('zh','bp.contact_email_prefix','我们的团队将通过以下邮件联系您：'),
('so','bp.contact_email_prefix','Kooxdeenna waxay kula soo xiriiri doontaa'),
('aa','bp.contact_email_prefix','Kooxoyta koo kaa la xiriira'),
('am','bp.contact_email_prefix','ቡድናችን ያነጋግርዎታል'),

('en','bp.contact_email_suffix','within 48 hours.'),
('zh','bp.contact_email_suffix','将在48小时内联系您。'),
('so','bp.contact_email_suffix','48 saac gudahood.'),
('aa','bp.contact_email_suffix','48 saawiti gudda.'),
('am','bp.contact_email_suffix','በ48 ሰዓት ውስጥ።')

ON CONFLICT (language_code, key) DO UPDATE SET value = EXCLUDED.value;
