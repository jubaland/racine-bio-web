-- Nettoyage : suppression de la colonne héritée "color_end" de la table "promos".
-- Le design actuel n'utilise qu'une couleur unique (color_start).
-- À exécuter dans le SQL Editor de Supabase.

ALTER TABLE promos DROP COLUMN IF EXISTS color_end;
