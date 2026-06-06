-- Commande type (abonnement hebdomadaire) — Phase 2.
-- À exécuter dans Supabase Dashboard → SQL Editor.

-- Un abonnement par client
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  delivery_day  smallint not null default 1,   -- 0=dimanche … 6=samedi (JS getDay)
  active        boolean  not null default false,
  paused        boolean  not null default false,
  last_delivery date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subs_own ON subscriptions;
CREATE POLICY subs_own ON subscriptions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Le panier type (produits + quantités)
CREATE TABLE IF NOT EXISTS subscription_items (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references products(id) on delete cascade,
  quantity   numeric not null default 1,
  created_at timestamptz not null default now()
);
ALTER TABLE subscription_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subitems_own ON subscription_items;
CREATE POLICY subitems_own ON subscription_items FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
