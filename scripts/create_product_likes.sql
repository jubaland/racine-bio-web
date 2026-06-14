-- « J'aime » produit : un client ayant reçu un produit peut l'aimer (1 fois).
-- Le compteur est dénormalisé sur products.likes_count pour un affichage instantané.
-- À exécuter dans Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS product_likes (
  product_id bigint NOT NULL,
  user_id    uuid   NOT NULL,
  user_name  text,                       -- prénom figé au moment du like (affichage « qui a aimé »)
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, user_id)
);

-- Si la table existe déjà :
ALTER TABLE product_likes ADD COLUMN IF NOT EXISTS user_name text;

ALTER TABLE products ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;

-- Écritures via l'API (service role) qui vérifie l'éligibilité (commande livrée).
-- Lecture des likes restreinte au propriétaire ; le compteur public vit sur products.
ALTER TABLE product_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pl_select_own ON product_likes;
CREATE POLICY pl_select_own ON product_likes FOR SELECT USING (auth.uid() = user_id);
