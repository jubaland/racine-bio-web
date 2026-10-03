-- Phase 33 : codes promo « livraison offerte », seuil automatique de livraison offerte,
-- frais de livraison calculés côté serveur. Migration additive (aucune donnée existante modifiée).

-- 1) Codes promo --------------------------------------------------------------------------------
create table if not exists public.promo_codes (
  id                bigint generated always as identity primary key,
  code              text not null unique check (code ~ '^[A-Z0-9]{3,20}$'),
  kind              text not null default 'free_delivery' check (kind in ('free_delivery')),
  label             text,                                   -- nom interne de la campagne
  active            boolean not null default true,
  starts_at         timestamptz,                            -- vide : valable tout de suite
  ends_at           timestamptz,                            -- vide : sans date de fin
  min_subtotal      integer check (min_subtotal is null or min_subtotal > 0),        -- panier minimum (Fdj)
  first_order_only  boolean not null default false,
  max_uses          integer check (max_uses is null or max_uses > 0),                -- vide : illimité
  max_uses_per_user integer check (max_uses_per_user is null or max_uses_per_user > 0),
  scope             text not null default 'standard' check (scope in ('standard', 'all')), -- montant couvert : livraison standard, ou toute option
  max_discount      integer check (max_discount is null or max_discount > 0),        -- plafond (Fdj)
  user_id           uuid references auth.users(id) on delete cascade,                -- code personnel (vide : tous les clients)
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 2) Utilisations (une par commande) -----------------------------------------------------------
create table if not exists public.promo_redemptions (
  id         bigint generated always as identity primary key,
  promo_id   bigint not null references public.promo_codes(id) on delete restrict,
  order_id   bigint unique references public.orders(id) on delete cascade,  -- vide le temps de créer la commande
  user_id    uuid,
  phone      text,
  amount     integer not null default 0,                                    -- montant offert (Fdj)
  created_at timestamptz not null default now()
);
create index if not exists promo_redemptions_promo_idx on public.promo_redemptions (promo_id);
create index if not exists promo_redemptions_user_idx  on public.promo_redemptions (user_id);
create index if not exists promo_redemptions_phone_idx on public.promo_redemptions (phone);

-- Accès : uniquement par le serveur (clé de service). Aucune politique = aucun accès navigateur.
alter table public.promo_codes       enable row level security;
alter table public.promo_redemptions enable row level security;

-- 3) Détail de la livraison sur la commande ------------------------------------------------------
alter table public.orders add column if not exists delivery_fee_base        integer;                 -- tarif avant remise
alter table public.orders add column if not exists delivery_discount        integer not null default 0;
alter table public.orders add column if not exists delivery_discount_source text;                    -- promo | threshold | referral_code | referral_credit
alter table public.orders add column if not exists promo_code               text;

-- 4) Réservation atomique d'une utilisation ----------------------------------------------------
-- Verrouille le code, recompte les utilisations (commandes annulées exclues ; réservations sans
-- commande ignorées après 10 minutes) et enregistre l'utilisation. Deux commandes simultanées sur
-- la dernière utilisation : une seule passe.
create or replace function public.promo_redeem(p_promo bigint, p_user uuid, p_phone text, p_amount integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c    public.promo_codes;
  used integer;
  mine integer;
  rid  bigint;
begin
  select * into c from public.promo_codes where id = p_promo for update;
  if not found or not c.active then return jsonb_build_object('ok', false, 'reason', 'inactive'); end if;
  if c.starts_at is not null and now() < c.starts_at then return jsonb_build_object('ok', false, 'reason', 'not_started'); end if;
  if c.ends_at is not null and now() > c.ends_at then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;

  if c.max_uses is not null then
    select count(*) into used
      from public.promo_redemptions r left join public.orders o on o.id = r.order_id
     where r.promo_id = p_promo
       and ((r.order_id is null and r.created_at > now() - interval '10 minutes') or (o.id is not null and o.status <> 'cancelled'));
    if used >= c.max_uses then return jsonb_build_object('ok', false, 'reason', 'exhausted'); end if;
  end if;

  if c.max_uses_per_user is not null then
    select count(*) into mine
      from public.promo_redemptions r left join public.orders o on o.id = r.order_id
     where r.promo_id = p_promo
       and ((r.order_id is null and r.created_at > now() - interval '10 minutes') or (o.id is not null and o.status <> 'cancelled'))
       and ((p_user is not null and r.user_id = p_user) or (p_phone is not null and r.phone = p_phone));
    if mine >= c.max_uses_per_user then return jsonb_build_object('ok', false, 'reason', 'per_user_limit'); end if;
  end if;

  insert into public.promo_redemptions (promo_id, user_id, phone, amount)
  values (p_promo, p_user, p_phone, greatest(0, coalesce(p_amount, 0)))
  returning id into rid;
  return jsonb_build_object('ok', true, 'redemption_id', rid);
end $$;

revoke all on function public.promo_redeem(bigint, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.promo_redeem(bigint, uuid, text, integer) to service_role;
