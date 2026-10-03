-- Phase 34 : codes promo en pourcentage / montant fixe sur les articles, et remise accordée par
-- l'admin sur une commande (marchandage). Migration additive.

-- 1) Codes promo : type et valeur
alter table public.promo_codes drop constraint if exists promo_codes_kind_check;
alter table public.promo_codes add constraint promo_codes_kind_check check (kind in ('free_delivery', 'percent', 'amount'));
alter table public.promo_codes add column if not exists value integer check (value is null or value > 0);           -- % (1-100) ou Fdj selon le type
alter table public.promo_codes add column if not exists products_scope text not null default 'all' check (products_scope in ('all', 'hornafresh'));  -- articles concernés : tous, ou produits Hornafresh seulement (hors marchands)

-- 2) Commandes : remises sur les articles
alter table public.orders add column if not exists promo_discount   integer not null default 0;      -- remise du code promo sur les articles (Fdj)
alter table public.orders add column if not exists admin_discount   integer not null default 0;      -- remise globale accordée par l'admin (Fdj)
alter table public.orders add column if not exists discount_history jsonb   not null default '[]'::jsonb;  -- journal des remises admin : [{at, by, by_name, kind, item_id, name, from, to, amount, note}]
alter table public.order_items add column if not exists discount integer not null default 0;         -- remise admin sur la ligne (Fdj, total de la ligne) — le prix reste le prix réel
