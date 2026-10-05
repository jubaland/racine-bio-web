-- Phase 37 : modification des quantités d'une commande quel que soit son statut (sauf annulée),
-- avec garde-fous : motif obligatoire après expédition, journal immuable des modifications
-- (qui, quoi, quand, pourquoi), alerte admin quand un gestionnaire modifie une commande livrée.
-- Migration additive. Accès serveur uniquement (RLS sans politique).

create table if not exists public.order_edits (
  id            bigint generated always as identity primary key,
  order_id      bigint not null references public.orders(id) on delete cascade,
  item_id       bigint,
  product_name  text,
  product_unit  text,
  from_qty      numeric not null,
  to_qty        numeric not null,
  price         numeric not null default 0,         -- prix unitaire de la ligne au moment du changement
  amount        integer not null default 0,          -- variation du montant des articles (négatif : réduction)
  refund_method text,                                -- wallet | cash | manual | credit | none (réductions)
  reason        text,                                -- motif (obligatoire après expédition)
  by_user       uuid,
  by_name       text,
  by_role       text,                                -- admin | manager
  order_status  text,                                -- statut de la commande au moment du changement
  created_at    timestamptz not null default now()
);
create index if not exists order_edits_order_idx   on public.order_edits (order_id);
create index if not exists order_edits_created_idx on public.order_edits (created_at desc);

alter table public.order_edits enable row level security;
