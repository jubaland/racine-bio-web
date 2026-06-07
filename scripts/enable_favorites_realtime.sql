-- Active la diffusion temps réel (Realtime) sur la table favorites.
-- À exécuter dans Supabase Dashboard → SQL Editor.
-- (Si le message dit que la table est déjà membre de la publication, ignorez-le.)

ALTER PUBLICATION supabase_realtime ADD TABLE favorites;

-- La clé primaire (user_id, product_id) suffit pour filtrer les événements
-- INSERT et DELETE par utilisateur (user_id est dans la PK).
