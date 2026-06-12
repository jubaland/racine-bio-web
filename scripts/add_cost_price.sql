-- Suivi financier : coût d'achat par produit + capture du coût au moment de la vente.
-- À exécuter dans Supabase Dashboard → SQL Editor.

-- 1) Coût d'achat (prix de revient) par produit. NULL = non renseigné (marge inconnue).
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price numeric;

-- 2) Snapshot du coût au moment de la commande (reste exact même si le coût change
--    plus tard). Les anciennes lignes restent NULL → on retombe sur le coût courant.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_cost numeric;
