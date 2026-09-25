-- =====================================================================
-- PHASE 2 — Relevés de ventes et reversements aux marchands (25/09/2026)
-- Modèle : Hornafresh encaisse le client ; chaque ligne LIVRÉE d'un produit marchand est due au
-- marchand à 100 % du prix (abonnement seul, pas de commission). Les frais de livraison restent
-- à Hornafresh. Un reversement regroupe des lignes livrées non encore reversées ; chaque ligne
-- reversée est marquée par order_items.payout_id (exactitude garantie même après réduction ou
-- annulation, puisque seules les lignes livrées non marquées comptent).
-- Point de retour : sauvegarde 2026-09-25-avant-phase2-reversements.
-- =====================================================================

create table if not exists public.merchant_payouts (
  id           bigint generated always as identity primary key,
  user_id      uuid    not null references auth.users(id) on delete cascade,
  amount       numeric not null,
  lines_count  integer not null default 0,
  method       text    not null default 'waafi',   -- waafi | cash | other
  reference    text,
  note         text,
  period_from  date,                                -- plus ancienne commande reversée
  period_to    date,                                -- plus récente commande reversée
  paid_at      timestamptz not null default now(),
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists mpay_user_idx on public.merchant_payouts (user_id, paid_at desc);

alter table public.order_items add column if not exists payout_id bigint references public.merchant_payouts(id) on delete set null;
create index if not exists oi_payout_idx on public.order_items (payout_id);

-- RLS : le marchand lit ses propres reversements ; écriture = API service role / admin
alter table public.merchant_payouts enable row level security;
drop policy if exists mpay_read  on public.merchant_payouts;
drop policy if exists mpay_write on public.merchant_payouts;
create policy mpay_read  on public.merchant_payouts for select
  using (user_id = auth.uid() or public.is_admin_or_perm('merchants','view'));
create policy mpay_write on public.merchant_payouts for all
  using (public.is_admin_or_perm('merchants','edit')) with check (public.is_admin_or_perm('merchants','edit'));

-- =====================================================================
-- ROLLBACK
-- alter table public.order_items drop column if exists payout_id;
-- drop table if exists public.merchant_payouts;
-- =====================================================================
