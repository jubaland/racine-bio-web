-- =====================================================================
-- PHASE 6 — Promotions planifiées par produit (25/09/2026)
-- Une promotion = prix promo sur une période [starts_at, ends_at]. Le prix du produit n'est pas
-- modifié : le prix effectif est calculé à la lecture (site) et à la commande (API, prix serveur),
-- donc pas de re-validation ni de cron. Marchand (ses produits) ou admin (tout produit).
-- Point de retour : sauvegarde 2026-09-25-avant-promos-marchands.
-- =====================================================================
create table if not exists public.product_promotions (
  id           bigint generated always as identity primary key,
  product_id   bigint  not null references public.products(id) on delete cascade,
  owner_id     uuid,                                   -- marchand (null = promotion Hornafresh)
  promo_price  numeric not null check (promo_price > 0),
  starts_at    date    not null,
  ends_at      date    not null check (ends_at >= starts_at),
  status       text    not null default 'scheduled',   -- scheduled | cancelled
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists pp_active_idx on public.product_promotions (product_id, starts_at, ends_at) where status = 'scheduled';

alter table public.product_promotions enable row level security;
drop policy if exists pp_read  on public.product_promotions;
drop policy if exists pp_write on public.product_promotions;
-- Lecture publique (le site calcule le prix affiché) ; écriture via API service role / admin
create policy pp_read  on public.product_promotions for select using (true);
create policy pp_write on public.product_promotions for all
  using (public.is_admin_or_perm('products','edit')) with check (public.is_admin_or_perm('products','edit'));

-- ROLLBACK
-- drop table if exists public.product_promotions;
