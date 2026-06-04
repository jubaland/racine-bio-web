-- Traductions checkout — chaînes auparavant codées en dur, désormais via t() (groupe B)
-- Nouvelles clés : qty_requested, qty_available, code_invalid, code_network_error,
--                  label_home, label_office, label_other, remove_code
-- Langues : en, zh, so, aa, am  (fr = fallback codé)
-- Colonne langue : language_code
-- Appliqué en prod via REST le 2026-06-04. À déployer avec les modifs de app/checkout/page.tsx.
-- NB : les libellés d'adresse stockés en DB restent canoniques FR (Maison/Bureau/Autre) ;
--      seul l'affichage est traduit via ADDR_LABEL_TKEYS dans le code.

DELETE FROM ui_translations
WHERE language_code IN ('en','zh','so','aa','am')
  AND key IN (
    'checkout.qty_requested','checkout.qty_available','checkout.code_invalid','checkout.code_network_error',
    'checkout.label_home','checkout.label_office','checkout.label_other','checkout.remove_code'
  );

INSERT INTO ui_translations (language_code, key, value) VALUES

-- Détail erreur de stock
('en','checkout.qty_requested','requested'),
('zh','checkout.qty_requested','需求'),
('so','checkout.qty_requested','la codsaday'),
('aa','checkout.qty_requested','gaafatame'),
('am','checkout.qty_requested','የተጠየቀ'),

('en','checkout.qty_available','available'),
('zh','checkout.qty_available','可用'),
('so','checkout.qty_available','la heli karo'),
('aa','checkout.qty_available','jiru'),
('am','checkout.qty_available','የሚገኝ'),

-- Erreurs code parrainage
('en','checkout.code_invalid','Invalid code'),
('zh','checkout.code_invalid','代码无效'),
('so','checkout.code_invalid','Koodh khaldan'),
('aa','checkout.code_invalid','Koodii sirrii miti'),
('am','checkout.code_invalid','ልክ ያልሆነ ኮድ'),

('en','checkout.code_network_error','Network error, please try again.'),
('zh','checkout.code_network_error','网络错误，请重试。'),
('so','checkout.code_network_error','Khalad shabakad, fadlan isku day mar kale.'),
('aa','checkout.code_network_error','Dogoggora networkii, maaloo irra deebi''ii yaali.'),
('am','checkout.code_network_error','የአውታረ መረብ ስህተት፣ እባክዎ እንደገና ይሞክሩ።'),

-- Libellés type d'adresse (affichage uniquement)
('en','checkout.label_home','Home'),
('zh','checkout.label_home','家'),
('so','checkout.label_home','Guri'),
('aa','checkout.label_home','Mana'),
('am','checkout.label_home','ቤት'),

('en','checkout.label_office','Office'),
('zh','checkout.label_office','办公室'),
('so','checkout.label_office','Xafiis'),
('aa','checkout.label_office','Biiroo'),
('am','checkout.label_office','ቢሮ'),

('en','checkout.label_other','Other'),
('zh','checkout.label_other','其他'),
('so','checkout.label_other','Kale'),
('aa','checkout.label_other','Kan biraa'),
('am','checkout.label_other','ሌላ'),

-- aria-label retirer le code
('en','checkout.remove_code','Remove code'),
('zh','checkout.remove_code','移除代码'),
('so','checkout.remove_code','Ka saar koodhka'),
('aa','checkout.remove_code','Koodii balleessi'),
('am','checkout.remove_code','ኮዱን አስወግድ');
