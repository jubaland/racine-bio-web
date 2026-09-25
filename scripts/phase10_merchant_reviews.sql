-- =====================================================================
-- PHASE 10 — Avis clients par marchand (25/09/2026)
-- Un client ayant reçu une commande LIVRÉE contenant un produit du marchand peut noter le marchand
-- (1 à 5) avec un commentaire ; un avis par client et par marchand (modifiable). Modération admin
-- (published | hidden). Moyenne et nombre dénormalisés sur merchant_profiles (recalculés par l'API).
-- Point de retour : sauvegarde 2026-09-25-avant-avis-marchands.
-- =====================================================================
create table if not exists public.merchant_reviews (
  id          bigint generated always as identity primary key,
  owner_id    uuid    not null references auth.users(id) on delete cascade,   -- marchand noté
  user_id     uuid    not null references auth.users(id) on delete cascade,   -- client
  user_name   text,                                                            -- prénom figé
  rating      integer not null check (rating between 1 and 5),
  comment     text,
  status      text    not null default 'published' check (status in ('published','hidden')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, user_id)
);
create index if not exists mrev_owner_idx on public.merchant_reviews (owner_id, status, created_at desc);

alter table public.merchant_profiles
  add column if not exists rating_avg   numeric,
  add column if not exists rating_count integer not null default 0;

alter table public.merchant_reviews enable row level security;
drop policy if exists mrev_read  on public.merchant_reviews;
drop policy if exists mrev_write on public.merchant_reviews;
-- Lecture publique des avis publiés (vitrine) ; l'auteur voit aussi le sien ; écriture via API / admin
create policy mrev_read  on public.merchant_reviews for select
  using (status = 'published' or user_id = auth.uid() or public.is_admin_or_perm('merchants','view'));
create policy mrev_write on public.merchant_reviews for all
  using (public.is_admin_or_perm('merchants','edit')) with check (public.is_admin_or_perm('merchants','edit'));

-- ROLLBACK
-- alter table public.merchant_profiles drop column if exists rating_avg, drop column if exists rating_count;
-- drop table if exists public.merchant_reviews;
