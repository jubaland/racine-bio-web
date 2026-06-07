-- Favoris synchronisés par utilisateur (multi-appareils).
-- À exécuter dans Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS favorites (
  user_id    uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id bigint NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS favorites_own ON favorites;
CREATE POLICY favorites_own ON favorites FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
