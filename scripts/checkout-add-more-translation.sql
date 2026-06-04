-- Traduction du bouton "Ajouter d'autres produits" (checkout étape 1)
-- Clé : checkout.add_more
-- Langues : en, zh, so, aa, am  (fr utilise le fallback codé, pas de ligne SQL)
-- Colonne langue : language_code
-- Exécuter dans Supabase Dashboard → SQL Editor

DELETE FROM ui_translations
WHERE language_code IN ('en','zh','so','aa','am')
  AND key = 'checkout.add_more';

INSERT INTO ui_translations (language_code, key, value) VALUES
('en','checkout.add_more','＋ Add more products'),
('zh','checkout.add_more','＋ 添加更多商品'),
('so','checkout.add_more','＋ Ku dar alaab kale'),
('aa','checkout.add_more','＋ Mi''oota biraa itti dabali'),
('am','checkout.add_more','＋ ተጨማሪ ምርቶች ጨምር');
