-- Abonnement : fréquence (hebdo/quinzaine/mensuel) + date de validité + un panier par fréquence.
-- À exécuter dans Supabase Dashboard → SQL Editor.

-- 1) Nouvelles colonnes
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS frequency   text NOT NULL DEFAULT 'weekly';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS valid_until date;

-- Valeurs autorisées pour la fréquence
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_frequency_chk;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_frequency_chk
  CHECK (frequency IN ('weekly','fortnightly','monthly'));

-- 2) Validité par défaut (1 an) pour les abonnements existants
UPDATE subscriptions
   SET valid_until = (COALESCE(created_at::date, now()::date) + interval '1 year')::date
 WHERE valid_until IS NULL;

-- 3) Clé primaire composite (un abonnement par client ET par fréquence)
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_pkey;
ALTER TABLE subscriptions ADD PRIMARY KEY (user_id, frequency);

-- 4) Le panier type est désormais lié à une fréquence
ALTER TABLE subscription_items ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'weekly';

-- (Les politiques RLS existantes filtrent par user_id = auth.uid() : toujours valides.)
