-- Table de traduction des options de livraison (même logique que
-- product_translations / category_translations / promo_translations).
-- La table delivery_options garde le FR comme source ; cette table porte les overrides.
-- Langues : en, zh, so, aa, am  (fr = valeurs de delivery_options).
-- À exécuter dans Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS delivery_option_translations (
  id                 bigint generated always as identity primary key,
  delivery_option_id bigint not null references delivery_options(id) on delete cascade,
  language_code      text   not null,
  name               text,
  description        text,
  created_at         timestamptz not null default now(),
  unique (delivery_option_id, language_code)
);

-- Lecture publique (client anon), comme les autres tables de traduction
ALTER TABLE delivery_option_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS delivery_option_translations_read ON delivery_option_translations;
CREATE POLICY delivery_option_translations_read
  ON delivery_option_translations FOR SELECT
  USING (true);

-- Réinsertion idempotente des traductions
DELETE FROM delivery_option_translations WHERE language_code IN ('en','zh','so','aa','am');

INSERT INTO delivery_option_translations (delivery_option_id, language_code, name, description) VALUES

-- Option 1 — Standard / "Livraison dans la journée ou le lendemain"
(1,'en','Standard','Delivery same day or next day'),
(1,'zh','标准','当天或次日送达'),
(1,'so','Caadi','Gaarsiin maalinta ama maalinta xigta'),
(1,'aa','Idilee','Gaheessa guyyaa sana yookiin guyyaa itti aanu'),
(1,'am','መደበኛ','በዕለቱ ወይም በሚቀጥለው ቀን ማድረስ'),

-- Option 2 — Express / "Livraison en 2 à 3 heures"
(2,'en','Express','Delivery within 2 to 3 hours'),
(2,'zh','特快','2 至 3 小时内送达'),
(2,'so','Degdeg','Gaarsiin 2 ilaa 3 saacadood gudahood'),
(2,'aa','Saffisaa','Gaheessa sa''aatii 2 hanga 3 keessatti'),
(2,'am','ፈጣን','ከ2 እስከ 3 ሰዓታት ውስጥ ማድረስ'),

-- Option 3 — Point relais / "Retrait dans un point de collecte"
(3,'en','Pickup point','Pickup at a collection point'),
(3,'zh','自提点','在自提点取货'),
(3,'so','Goobta qaadista','Ka qaado goobta ururinta'),
(3,'aa','Bakka fuudhaa','Bakka walitti qabaa irraa fudhachuu'),
(3,'am','የመውሰጃ ነጥብ','በመሰብሰቢያ ቦታ መውሰድ');
