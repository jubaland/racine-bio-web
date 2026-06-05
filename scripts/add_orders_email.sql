-- Ajoute la colonne email aux commandes (pour contacter les clients invités).
-- À EXÉCUTER AVANT de déployer le code du checkout invité (sinon les commandes
-- échoueraient sur une colonne inconnue).
-- Supabase Dashboard → SQL Editor.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS email text;
