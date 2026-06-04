-- Traductions de la bannière "commande en cours" (accueil) + pluriel panier
-- Clés : cart.resume_text, cart.resume_cta, cart.item, cart.items
-- Langues : en, zh, so, aa, am  (fr utilise les fallbacks codés, pas de lignes SQL)
-- Colonne langue : language_code
-- Exécuter dans Supabase Dashboard → SQL Editor

DELETE FROM ui_translations
WHERE language_code IN ('en','zh','so','aa','am')
  AND key IN ('cart.resume_text','cart.resume_cta','cart.item','cart.items');

INSERT INTO ui_translations (language_code, key, value) VALUES

-- ============================================================
-- cart.resume_text  (fr : "Vous avez une commande en cours")
-- ============================================================
('en','cart.resume_text','You have an order in progress'),
('zh','cart.resume_text','您有一个进行中的订单'),
('so','cart.resume_text','Waxaad haysataa dalab socda'),
('aa','cart.resume_text','Ajaja adeemsifamaa qabda'),
('am','cart.resume_text','በሂደት ላይ ያለ ትዕዛዝ አለዎት'),

-- ============================================================
-- cart.resume_cta  (fr : "Reprendre →")
-- ============================================================
('en','cart.resume_cta','Resume →'),
('zh','cart.resume_cta','继续结算 →'),
('so','cart.resume_cta','Sii wad →'),
('aa','cart.resume_cta','Itti fufi →'),
('am','cart.resume_cta','ቀጥል →'),

-- ============================================================
-- cart.item  (fr : "article", singulier)
-- ============================================================
('en','cart.item','item'),
('zh','cart.item','件商品'),
('so','cart.item','shay'),
('aa','cart.item','mi''a'),
('am','cart.item','እቃ'),

-- ============================================================
-- cart.items  (fr : "articles", pluriel)
-- ============================================================
('en','cart.items','items'),
('zh','cart.items','件商品'),
('so','cart.items','alaab'),
('aa','cart.items','mi''oota'),
('am','cart.items','እቃዎች');
