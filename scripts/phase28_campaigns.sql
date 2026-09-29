-- =====================================================================
-- PHASE 28 — Achats groupés à l'import (29/09/2026)
-- Des clients à Djibouti précommandent, seuls ou à plusieurs, un produit d'un producteur étranger
-- (Somaliland d'abord). Hornafresh encaisse, achète au producteur, fait transporter, puis distribue.
--
--   suppliers                    producteurs étrangers (gérés par l'admin, sans compte en v1)
--   campaigns                    une campagne = un produit, un prix rendu à Djibouti, un seuil, une date limite
--   campaign_orders              réservations des clients (payées à la réservation)
--   campaign_supplier_payments   paiements au producteur (acompte, solde), en devise, taux enregistré
--
-- Cycle : draft → open → closed (seuil atteint) → ordered → in_transit → arrived → distributing → done
--         open → failed (seuil non atteint : tout le monde est remboursé) ; cancelled à tout moment avant done.
-- Aucun chiffre en dur : les valeurs par défaut de la fiche de coût sont des réglages facultatifs
-- (app_settings campaign.*), vides au départ. Sauvegarde : avant-achats-groupes.
-- =====================================================================

create table if not exists public.suppliers (
  id              bigserial primary key,
  name            text not null,
  country         text not null check (country in ('SO','ET','DJ','OTHER')),
  region          text,
  contact_name    text,
  phone           text,
  whatsapp        text,
  currency        text not null check (currency in ('USD','DJF','ETB','SOS','SLS')),
  payment_channel text,                       -- ex. Waafi, Zaad, virement, espèces
  notes           text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.campaigns (
  id                  bigserial primary key,
  supplier_id         bigint not null references public.suppliers(id),
  title               text not null,
  description         text,
  image_url           text,
  translations        jsonb,                   -- { en: { title, description, unit_label }, … }
  unit_label          text not null,           -- unité de vente : « sac de 50 kg », « cageot »
  unit_weight_kg      numeric check (unit_weight_kg is null or unit_weight_kg > 0),
  -- Fiche de coût (par unité de vente)
  currency            text not null check (currency in ('USD','DJF','ETB','SOS','SLS')),
  supplier_unit_price numeric not null check (supplier_unit_price >= 0),   -- en devise du producteur
  exchange_rate       numeric not null check (exchange_rate > 0),          -- Fdj pour 1 unité de devise
  transport_per_unit  numeric not null default 0 check (transport_per_unit >= 0),
  customs_per_unit    numeric not null default 0 check (customs_per_unit >= 0),
  other_per_unit      numeric not null default 0 check (other_per_unit >= 0),
  loss_pct            numeric not null default 0 check (loss_pct >= 0 and loss_pct < 100),
  price_djf           numeric not null check (price_djf > 0),              -- prix de vente rendu à Djibouti
  -- Règles de la campagne
  min_units           int not null check (min_units >= 1),                 -- seuil de déclenchement
  max_units           int check (max_units is null or max_units >= min_units),
  max_units_per_client int check (max_units_per_client is null or max_units_per_client >= 1),
  closes_at           timestamptz not null,
  eta_date            date,
  audience            text not null default 'all' check (audience in ('all','pro')),   -- pro : comptes entreprise seulement
  allow_delivery      boolean not null default true,
  allow_pickup        boolean not null default true,
  pickup_place        text,
  delivery_fee        numeric not null default 0 check (delivery_fee >= 0),
  supplier_deposit_pct numeric check (supplier_deposit_pct is null or (supplier_deposit_pct >= 0 and supplier_deposit_pct <= 100)),
  -- Déroulement
  status              text not null default 'draft'
                      check (status in ('draft','open','closed','failed','ordered','in_transit','arrived','distributing','done','cancelled')),
  ordered_units       int,                     -- quantité commandée au producteur (figée à la clôture)
  received_units      int,                     -- quantité reçue et contrôlée
  closed_at           timestamptz,
  status_note         text,
  created_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (allow_delivery or allow_pickup)
);
create index if not exists campaigns_status on public.campaigns (status, closes_at);

create table if not exists public.campaign_orders (
  id                bigserial primary key,
  campaign_id       bigint not null references public.campaigns(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  company_id        bigint references public.companies(id),
  group_code        text,                      -- réservations faites ensemble (lien d'invitation)
  units             int not null check (units >= 1),
  final_units       int,                       -- après contrôle à l'arrivée (prorata si manque)
  unit_price        numeric not null,          -- prix photographié à la réservation
  delivery_mode     text not null check (delivery_mode in ('delivery','pickup','group')),
  delivery_fee      numeric not null default 0,
  amount            numeric not null,          -- units × unit_price + delivery_fee
  refunded          numeric not null default 0,
  payment_method    text not null check (payment_method in ('wallet','waafi','company_wallet')),
  payment_reference text,
  status            text not null default 'pending_payment'
                    check (status in ('pending_payment','paid','cancelled','refunded','delivered')),
  customer_name     text,
  phone             text,
  address           text,
  lang              text check (lang is null or lang in ('fr','en','zh','am','so','aa')),
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  delivered_at      timestamptz
);
create index if not exists campaign_orders_campaign on public.campaign_orders (campaign_id, status);
create index if not exists campaign_orders_user on public.campaign_orders (user_id);
create index if not exists campaign_orders_group on public.campaign_orders (group_code) where group_code is not null;

create table if not exists public.campaign_supplier_payments (
  id              bigserial primary key,
  campaign_id     bigint not null references public.campaigns(id) on delete cascade,
  kind            text not null check (kind in ('deposit','balance','other')),
  amount_currency numeric not null check (amount_currency > 0),
  currency        text not null,
  exchange_rate   numeric not null check (exchange_rate > 0),
  amount_djf      numeric not null,
  method          text,
  reference       text,
  note            text,
  paid_at         timestamptz not null default now(),
  created_by      uuid
);

-- ── Accès ────────────────────────────────────────────────────────────
-- Campagnes : lecture publique dès qu'elles ne sont plus en brouillon, SANS la fiche de coût
-- (prix du producteur, marge) : la lecture passe par la vue campaigns_public et par l'API.
-- Les tables elles-mêmes sont fermées ; l'API (service role) fait les écritures.
alter table public.suppliers enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_orders enable row level security;
alter table public.campaign_supplier_payments enable row level security;

drop policy if exists campaigns_admin_read on public.campaigns;
create policy campaigns_admin_read on public.campaigns for select using (public.is_admin_or_perm('campaigns','view'));
drop policy if exists suppliers_admin_read on public.suppliers;
create policy suppliers_admin_read on public.suppliers for select using (public.is_admin_or_perm('campaigns','view'));
drop policy if exists csp_admin_read on public.campaign_supplier_payments;
create policy csp_admin_read on public.campaign_supplier_payments for select using (public.is_admin_or_perm('campaigns','view'));
drop policy if exists campaign_orders_read on public.campaign_orders;
create policy campaign_orders_read on public.campaign_orders for select
  using (user_id = auth.uid() or public.is_admin_or_perm('campaigns','view'));

-- ── Réservation atomique : capacité vérifiée sous verrou ─────────────
-- Crée la réservation en « pending_payment » ; le paiement est confirmé ensuite (campaign_order_paid).
-- Les réservations en attente de paiement comptent dans la capacité (pas de survente).
create or replace function public.campaign_reserve(
  p_campaign bigint, p_user uuid, p_company bigint, p_units int, p_delivery_mode text, p_delivery_fee numeric,
  p_payment_method text, p_payment_reference text, p_group text, p_name text, p_phone text, p_address text, p_lang text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare c campaigns; v_taken int; v_mine int; o campaign_orders;
begin
  select * into c from campaigns where id = p_campaign for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if c.status <> 'open' or c.closes_at <= now() then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  if p_units is null or p_units < 1 then return jsonb_build_object('ok', false, 'error', 'invalid_units'); end if;
  select coalesce(sum(units), 0) into v_taken from campaign_orders where campaign_id = p_campaign and status in ('pending_payment','paid');
  if c.max_units is not null and v_taken + p_units > c.max_units then
    return jsonb_build_object('ok', false, 'error', 'full', 'available', greatest(c.max_units - v_taken, 0));
  end if;
  if c.max_units_per_client is not null then
    select coalesce(sum(units), 0) into v_mine from campaign_orders
      where campaign_id = p_campaign and status in ('pending_payment','paid')
        and ((p_company is not null and company_id = p_company) or (p_company is null and user_id = p_user and company_id is null));
    if v_mine + p_units > c.max_units_per_client then
      return jsonb_build_object('ok', false, 'error', 'client_limit', 'available', greatest(c.max_units_per_client - v_mine, 0));
    end if;
  end if;
  insert into campaign_orders (campaign_id, user_id, company_id, group_code, units, unit_price, delivery_mode, delivery_fee, amount,
                               payment_method, payment_reference, customer_name, phone, address, lang)
  values (p_campaign, p_user, p_company, p_group, p_units, c.price_djf, p_delivery_mode, coalesce(p_delivery_fee, 0),
          p_units * c.price_djf + coalesce(p_delivery_fee, 0), p_payment_method, p_payment_reference, p_name, p_phone, p_address, p_lang)
  returning * into o;
  return jsonb_build_object('ok', true, 'order_id', o.id, 'amount', o.amount, 'unit_price', o.unit_price);
end $$;

-- Débit de cagnotte refusé si le solde est insuffisant (wallet_adjust, lui, laisse passer un solde négatif)
create or replace function public.wallet_debit_strict(p_user uuid, p_amount numeric, p_note text)
returns numeric language plpgsql security definer set search_path = public as $$
declare v numeric;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  update wallets set balance = balance - p_amount, updated_at = now() where user_id = p_user and balance >= p_amount returning balance into v;
  if not found then raise exception 'insufficient'; end if;
  insert into wallet_transactions (user_id, type, amount, order_id, note) values (p_user, 'debit', -p_amount, null, p_note);
  return v;
end $$;

revoke all on function public.campaign_reserve(bigint,uuid,bigint,int,text,numeric,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.campaign_reserve(bigint,uuid,bigint,int,text,numeric,text,text,text,text,text,text,text) to service_role;
revoke all on function public.wallet_debit_strict(uuid,numeric,text) from public, anon, authenticated;
grant execute on function public.wallet_debit_strict(uuid,numeric,text) to service_role;

-- =====================================================================
-- ROLLBACK
-- drop function if exists public.wallet_debit_strict(uuid,numeric,text);
-- drop function if exists public.campaign_reserve(bigint,uuid,bigint,int,text,numeric,text,text,text,text,text,text,text);
-- drop table if exists public.campaign_supplier_payments;
-- drop table if exists public.campaign_orders;
-- drop table if exists public.campaigns;
-- drop table if exists public.suppliers;
-- delete from public.app_settings where key like 'campaign.%';
