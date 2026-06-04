-- Rend facultatifs certains champs du formulaire produit admin.
-- Cause : ces colonnes étaient NOT NULL, donc une valeur vide (envoyée en NULL
-- par le code) était rejetée par la base.
-- À exécuter dans Supabase Dashboard → SQL Editor. Non destructif.

-- Emoji
ALTER TABLE products ALTER COLUMN emoji DROP NOT NULL;

-- Tag (slug) + Tag (libellé affiché) — vont par paire
ALTER TABLE products ALTER COLUMN tag       DROP NOT NULL;
ALTER TABLE products ALTER COLUMN tag_label DROP NOT NULL;
