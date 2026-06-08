-- Frais de transport personnalisés pour les commandes récurrentes (abonnements).
-- À exécuter dans Supabase Dashboard → SQL Editor.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 0;
