-- Traductions des pages et composants principaux du site Racine Bio
-- Langues : en, zh, so, aa, am  (fr utilise les fallbacks codés, pas de lignes SQL nécessaires)
-- Exécuter dans Supabase Dashboard → SQL Editor

DELETE FROM ui_translations
WHERE language_code IN ('en','zh','so','aa','am')
  AND key LIKE ANY(ARRAY[
    'login.%','profile.%','checkout.%','cart.%','product.%',
    'home.%','filter.%','origin.%'
  ]);

INSERT INTO ui_translations (language_code, key, value) VALUES

-- ============================================================
-- LOGIN
-- ============================================================
('en','login.register_success','Account created! Check your email to confirm.'),
('zh','login.register_success','账户已创建！请检查您的电子邮件以确认。'),
('so','login.register_success','Xisaabta waa la sameeyey! Hubi email-kaaga si aad u xaqiijiso.'),
('aa','login.register_success','Akkaawuntichi tolame! Email keeti ilaali xaqiiqsumaanno.'),
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
('aa','login.already_account','Akkaawunti harra qabdaa? Gali'),
('am','login.already_account','መለያ አለዎt? ግባ'),

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
('aa','profile.stat_favorites','Farqe'),
('am','profile.stat_favorites','ተወዳጆች'),

('en','profile.stat_reviews','Reviews'),
('zh','profile.stat_reviews','评价'),
('so','profile.stat_reviews','Dooodooyinka'),
('aa','profile.stat_reviews','Mabla''ooyye'),
('am','profile.stat_reviews','ግምገማዎች'),

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
('aa','checkout.thanks','Ajandooki hammanna. Geeshi''naanno afaatinno.'),
('am','checkout.thanks','ለትዕዛዝዎ እናመሰግናለን። ለዴሊቨሪ ያገኙዎታል።'),

('en','checkout.payment_method_label','Payment method'),
('zh','checkout.payment_method_label','支付方式'),
('so','checkout.payment_method_label','Qaabka lacag bixinta'),
('aa','checkout.payment_method_label','Kaffaltii gede'),
('am','checkout.payment_method_label','የክፍያ ዘዴ'),

('en','checkout.back_home_btn','🏠 Back to home'),
('zh','checkout.back_home_btn','🏠 返回首页'),
('so','checkout.back_home_btn','🏠 Ku laabo bogga hore'),
('aa','checkout.back_home_btn','🏠 Manna galti'),
('am','checkout.back_home_btn','🏠 ወደ ዋናው ገፅ ተመለስ'),

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

('en','checkout.name_placeholder','Ex: Ahmed Hassan'),
('zh','checkout.name_placeholder','例：Ahmed Hassan'),
('so','checkout.name_placeholder','Tusaale: Ahmed Hassan'),
('aa','checkout.name_placeholder','Fakke: Ahmed Hassan'),
('am','checkout.name_placeholder','ምሳሌ: Ahmed Hassan'),

('en','checkout.phone_placeholder','Ex: 77 XX XX XX'),
('zh','checkout.phone_placeholder','例：77 XX XX XX'),
('so','checkout.phone_placeholder','Tusaale: 77 XX XX XX'),
('aa','checkout.phone_placeholder','Fakke: 77 XX XX XX'),
('am','checkout.phone_placeholder','ምሳሌ: 77 XX XX XX'),

('en','checkout.address_placeholder','Ex: Quarter 4, Peace Street, Djibouti City'),
('zh','checkout.address_placeholder','例：第4区，和平街，吉布提市'),
('so','checkout.address_placeholder','Tusaale: Xaafadda 4, Jidka Nabadda, Magaalada Jabuuti'),
('aa','checkout.address_placeholder','Fakke: Gobba 4, Gammachuu Karaa, Jibuuti Magaalaa'),
('am','checkout.address_placeholder','ምሳሌ: ሰፈር 4, የሰላም መንገድ, ጂቡቲ ከተማ'),

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

('en','checkout.mobile_number','Number'),
('zh','checkout.mobile_number','号码'),
('so','checkout.mobile_number','Lambarka'),
('aa','checkout.mobile_number','Lakkoofsa'),
('am','checkout.mobile_number','ቁጥር'),

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

('en','checkout.waafi_label','Waafi'),
('zh','checkout.waafi_label','Waafi'),
('so','checkout.waafi_label','Waafi'),
('aa','checkout.waafi_label','Waafi'),
('am','checkout.waafi_label','Waafi'),

('en','checkout.waafi_desc','Waafi mobile payment'),
('zh','checkout.waafi_desc','Waafi手机支付'),
('so','checkout.waafi_desc','Lacag bixin mobaylka Waafi'),
('aa','checkout.waafi_desc','Waafi bilbila kanfaltii'),
('am','checkout.waafi_desc','ዋፊ ሞባይል ክፍያ'),

('en','checkout.dmoney_label','D-Money'),
('zh','checkout.dmoney_label','D-Money'),
('so','checkout.dmoney_label','D-Money'),
('aa','checkout.dmoney_label','D-Money'),
('am','checkout.dmoney_label','D-Money'),

('en','checkout.dmoney_desc','D-Money mobile payment'),
('zh','checkout.dmoney_desc','D-Money手机支付'),
('so','checkout.dmoney_desc','Lacag bixin mobaylka D-Money'),
('aa','checkout.dmoney_desc','D-Money bilbila kanfaltii'),
('am','checkout.dmoney_desc','ዲ-ሙኒ ሞባይል ክፍያ'),

('en','checkout.cash_label','Cash'),
('zh','checkout.cash_label','现金'),
('so','checkout.cash_label','Lacagta'),
('aa','checkout.cash_label','Maallaqa'),
('am','checkout.cash_label','ጥሬ ገንዘብ'),

('en','checkout.cash_desc','Cash on delivery'),
('zh','checkout.cash_desc','货到付款'),
('so','checkout.cash_desc','Lacag bixin markaad hesho'),
('aa','checkout.cash_desc','Geessitii kaffaltii'),
('am','checkout.cash_desc','በዴሊቨሪ ጊዜ ክፍያ'),

-- ============================================================
-- CART
-- ============================================================
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
('aa','product.local_badge','Oomishsha naannoo'),
('am','product.local_badge','የአካባቢ ምርት'),

('en','product.bio_badge','Certified Organic'),
('zh','product.bio_badge','有机认证'),
('so','product.bio_badge','Dabiici ah oo la xaqiijiyey'),
('aa','product.bio_badge','Naaturraalaa mirkane''e'),
('am','product.bio_badge','የተረጋገጠ ኦርጋኒክ'),

('en','product.delivery_badge','48h Delivery'),
('zh','product.delivery_badge','48小时配送'),
('so','product.delivery_badge','Geyn 48 saac'),
('aa','product.delivery_badge','Saata 48 keessa geeshi'),
('am','product.delivery_badge','48 ሰዓት ዴሊቨሪ'),

('en','product.similar','Similar products'),
('zh','product.similar','相似产品'),
('so','product.similar','Badeecadaha la mid ah'),
('aa','product.similar','Oomishsha walfakkaatan'),
('am','product.similar','ተመሳሳይ ምርቶች'),

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

-- ============================================================
-- HOME PAGE
-- ============================================================
('en','home.no_products','No products found'),
('zh','home.no_products','未找到产品'),
('so','home.no_products','Lama helin badeecad'),
('aa','home.no_products','Oomishshi argame hixinne'),
('am','home.no_products','ምርት አልተገኘም'),

('en','home.reset_filters','Reset filters'),
('zh','home.reset_filters','重置筛选'),
('so','home.reset_filters','Dib u dejii shaandhaysaha'),
('aa','home.reset_filters','Caancaltu deebisi'),
('am','home.reset_filters','ማጣሪያዎችን ዳግም አስጀምር'),

-- ============================================================
-- TYPE FILTERS
-- ============================================================
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

-- ============================================================
-- COUNTRY / ORIGIN NAMES
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
('am','origin.FR','ፈረንሳይ');
