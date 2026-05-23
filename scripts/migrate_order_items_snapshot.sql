-- Migration : snapshot produit dans order_items
-- À exécuter dans Supabase Dashboard → SQL Editor

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS product_name      text,
  ADD COLUMN IF NOT EXISTS product_image_url text,
  ADD COLUMN IF NOT EXISTS product_unit      text,
  ADD COLUMN IF NOT EXISTS product_farm      text;

-- Backfill des anciennes commandes depuis la table products
UPDATE order_items oi
SET
  product_name      = p.name,
  product_image_url = p.image_url,
  product_unit      = p.unit,
  product_farm      = p.farm
FROM products p
WHERE oi.product_id = p.id
  AND oi.product_name IS NULL;
