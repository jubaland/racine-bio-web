-- Active la diffusion temps réel (Realtime) sur la table favorites.
-- À exécuter dans Supabase Dashboard → SQL Editor.
-- (Si le message dit que la table est déjà membre de la publication, ignorez-le.)

ALTER PUBLICATION supabase_realtime ADD TABLE favorites;

-- Nécessaire pour que les événements DELETE soient diffusés correctement
-- avec la RLS activée (l'ancienne ligne doit contenir toutes ses colonnes).
ALTER TABLE favorites REPLICA IDENTITY FULL;
