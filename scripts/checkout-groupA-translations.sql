-- Traductions checkout — clés manquantes en base (groupe A)
-- Blocs : mur de connexion (auth_gate), paiement Waafi, contrôles panier
-- Langues : en, zh, so, aa, am  (fr utilise les fallbacks codés)
-- Colonne langue : language_code
-- Appliqué en prod via REST le 2026-06-04. Exécuter dans Supabase SQL Editor si besoin de rejouer.

DELETE FROM ui_translations
WHERE language_code IN ('en','zh','so','aa','am')
  AND key IN (
    'checkout.auth_gate_title','checkout.auth_gate_sub','checkout.auth_signin','checkout.auth_guest',
    'checkout.waafi_merchant_label','checkout.waafi_amount_label','checkout.waafi_manual_instructions','checkout.waafi_manual_note',
    'checkout.decrease','checkout.increase','checkout.max_stock','checkout.remove_item'
  );

INSERT INTO ui_translations (language_code, key, value) VALUES

-- Étape 3 — mur de connexion
('en','checkout.auth_gate_title','Sign in to continue'),
('zh','checkout.auth_gate_title','登录以继续'),
('so','checkout.auth_gate_title','Gal si aad u sii wadato'),
('aa','checkout.auth_gate_title','Itti fufuuf seeni'),
('am','checkout.auth_gate_title','ለመቀጠል ይግቡ'),

('en','checkout.auth_gate_sub','Sign in to track your orders, or continue without an account.'),
('zh','checkout.auth_gate_sub','登录以跟踪您的订单，或不创建账户继续。'),
('so','checkout.auth_gate_sub','Gal si aad ula socoto dalabkaaga, ama sii wad adoo aan akoon lahayn.'),
('aa','checkout.auth_gate_sub','Ajaja keeti hordofuuf seeni, yookiin akkaawunti malee itti fufi.'),
('am','checkout.auth_gate_sub','ትዕዛዞችዎን ለመከታተል ይግቡ፣ ወይም ያለ መለያ ይቀጥሉ።'),

('en','checkout.auth_signin','🔑 Sign in / Sign up'),
('zh','checkout.auth_signin','🔑 登录 / 注册'),
('so','checkout.auth_signin','🔑 Gal / Isdiiwaangeli'),
('aa','checkout.auth_signin','🔑 Seeni / Galmaa''i'),
('am','checkout.auth_signin','🔑 ግባ / ተመዝገብ'),

('en','checkout.auth_guest','Continue without an account →'),
('zh','checkout.auth_guest','不创建账户继续 →'),
('so','checkout.auth_guest','Sii wad akoon la''aan →'),
('aa','checkout.auth_guest','Akkaawunti malee itti fufi →'),
('am','checkout.auth_guest','ያለ መለያ ይቀጥሉ →'),

-- Paiement Waafi
('en','checkout.waafi_merchant_label','Waafi merchant number'),
('zh','checkout.waafi_merchant_label','Waafi 商户号码'),
('so','checkout.waafi_merchant_label','Lambarka ganacsadaha Waafi'),
('aa','checkout.waafi_merchant_label','Lakkoofsa daldalaa Waafi'),
('am','checkout.waafi_merchant_label','የWaafi ነጋዴ ቁጥር'),

('en','checkout.waafi_amount_label','Amount to send'),
('zh','checkout.waafi_amount_label','应发送金额'),
('so','checkout.waafi_amount_label','Qadarka la dirayo'),
('aa','checkout.waafi_amount_label','Hamma ergamu'),
('am','checkout.waafi_amount_label','የሚላክ መጠን'),

('en','checkout.waafi_manual_instructions','Send the total amount to our Waafi account, then confirm your order.'),
('zh','checkout.waafi_manual_instructions','将总金额发送至我们的 Waafi 账户，然后确认您的订单。'),
('so','checkout.waafi_manual_instructions','U dir wadarta guud akoonkayaga Waafi, ka dibna xaqiiji dalabkaaga.'),
('aa','checkout.waafi_manual_instructions','Ida''ama walii galaa gara akkaawuntii Waafi keenyaatti ergi, sana booda ajaja kee mirkaneessi.'),
('am','checkout.waafi_manual_instructions','ጠቅላላ መጠኑን ወደ የእኛ Waafi መለያ ይላኩ፣ ከዚያ ትዕዛዝዎን ያረጋግጡ።'),

('en','checkout.waafi_manual_note','⚠️ Your order will be processed once our team confirms the payment.'),
('zh','checkout.waafi_manual_note','⚠️ 我们的团队确认付款后，您的订单将被处理。'),
('so','checkout.waafi_manual_note','⚠️ Dalabkaaga waa la habayn doonaa marka kooxdayadu xaqiijiso lacag bixinta.'),
('aa','checkout.waafi_manual_note','⚠️ Ajaja kee erga garreen keenya kaffaltii mirkaneesseen booda ni adeemsifama.'),
('am','checkout.waafi_manual_note','⚠️ ቡድናችን ክፍያውን ካረጋገጠ በኋላ ትዕዛዝዎ ይከናወናል።'),

-- Contrôles panier (étape 1)
('en','checkout.decrease','Decrease quantity'),
('zh','checkout.decrease','减少数量'),
('so','checkout.decrease','Dhimi tirada'),
('aa','checkout.decrease','Baay''ina hir''isi'),
('am','checkout.decrease','መጠን ቀንስ'),

('en','checkout.increase','Increase quantity'),
('zh','checkout.increase','增加数量'),
('so','checkout.increase','Kordhi tirada'),
('aa','checkout.increase','Baay''ina dabali'),
('am','checkout.increase','መጠን ጨምር'),

('en','checkout.max_stock','Max stock'),
('zh','checkout.max_stock','库存上限'),
('so','checkout.max_stock','Kaydka ugu badan'),
('aa','checkout.max_stock','Kuusaa ol''aanaa'),
('am','checkout.max_stock','ከፍተኛ ክምችት'),

('en','checkout.remove_item','Remove from cart'),
('zh','checkout.remove_item','从购物车移除'),
('so','checkout.remove_item','Ka saar dambiisha'),
('aa','checkout.remove_item','Gaarii irraa balleessi'),
('am','checkout.remove_item','ከጋሪ አስወግድ');
