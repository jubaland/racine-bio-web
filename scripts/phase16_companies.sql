-- =====================================================================
-- PHASE 16 — Comptes entreprise, prépayés (28/09/2026)
-- Une société (restaurant, cantine, bureau, épicerie…) regroupe plusieurs utilisateurs :
--   gérant (manager)  : commande, recharge, invite, gère les sites, valide les demandes
--   acheteur (buyer)  : commande (au-delà d'un seuil éventuel : demande à valider par le gérant)
--   comptable (accountant) : consulte commandes, mouvements et relevés
-- Prépayé : la société a SA cagnotte (jamais mélangée aux cagnottes personnelles), rechargée sur
-- validation de l'admin. Mêmes prix que les particuliers. Pas de facture légale à ce stade
-- (Hornafresh n'a pas encore d'existence légale) : relevés et reçus simples.
-- Toutes les écritures passent par les API (service role) ; la lecture est ouverte aux membres (RLS).
-- Point de retour : sauvegarde avant-comptes-entreprise.
-- =====================================================================

-- ── Réglages numériques / texte (site_settings ne stocke que des booléens) ─────────────
create table if not exists public.app_settings (
  key        text primary key,
  value_num  numeric,
  value_text text,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select using (true);
insert into public.app_settings (key, value_num) values ('company.min_topup', 5000)
on conflict (key) do nothing;

-- ── Sociétés ─────────────────────────────────────────────────────────
create table if not exists public.companies (
  id                 bigint generated always as identity primary key,
  name               text not null,
  activity           text,                      -- restaurant, cantine, bureau, épicerie…
  tax_id             text,                      -- numéro d'identification : facultatif (structures naissantes)
  phone              text,
  email              text,
  address            text,
  status             text not null default 'pending' check (status in ('pending','active','rejected','suspended')),
  min_topup          numeric check (min_topup is null or min_topup >= 0),          -- recharge minimale propre (sinon réglage global)
  approval_threshold numeric check (approval_threshold is null or approval_threshold >= 0), -- au-delà : commande d'un acheteur à valider
  created_by         uuid references auth.users(id) on delete set null,
  admin_note         text,
  created_at         timestamptz not null default now(),
  resolved_at        timestamptz
);

create table if not exists public.company_members (
  company_id bigint not null references public.companies(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  role       text   not null check (role in ('manager','buyer','accountant')),
  email      text,
  full_name  text,
  created_at timestamptz not null default now(),
  primary key (company_id, user_id),
  unique (user_id)                               -- un utilisateur = une seule société (v1)
);

create table if not exists public.company_invites (
  id         bigint generated always as identity primary key,
  company_id bigint not null references public.companies(id) on delete cascade,
  email      text   not null,
  role       text   not null check (role in ('manager','buyer','accountant')),
  invited_by uuid references auth.users(id) on delete set null,
  status     text   not null default 'pending' check (status in ('pending','accepted','cancelled')),
  created_at timestamptz not null default now()
);
create unique index if not exists company_invites_pending_idx on public.company_invites (company_id, lower(email)) where status = 'pending';

create table if not exists public.company_sites (
  id             bigint generated always as identity primary key,
  company_id     bigint not null references public.companies(id) on delete cascade,
  label          text not null,
  recipient_name text not null,
  phone          text not null,
  address        text not null,
  is_default     boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists company_sites_company_idx on public.company_sites (company_id);

-- ── Cagnotte société ─────────────────────────────────────────────────
create table if not exists public.company_wallets (
  company_id bigint primary key references public.companies(id) on delete cascade,
  balance    numeric not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.company_wallet_transactions (
  id         bigint generated always as identity primary key,
  company_id bigint not null references public.companies(id) on delete cascade,
  type       text   not null,                   -- deposit | debit | refund | adjustment
  amount     numeric not null,
  order_id   bigint references public.orders(id) on delete set null,
  user_id    uuid references auth.users(id) on delete set null,   -- auteur du mouvement
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists company_wallet_tx_idx on public.company_wallet_transactions (company_id, created_at desc);

-- Ajustement atomique. Prépayé : un débit qui rendrait le solde négatif est REFUSÉ (exception),
-- deux commandes simultanées ne peuvent pas dépenser deux fois le même solde.
create or replace function public.company_wallet_adjust(p_company bigint, p_amount numeric, p_type text,
  p_order bigint default null, p_user uuid default null, p_note text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_balance numeric;
begin
  insert into public.company_wallets (company_id, balance) values (p_company, 0) on conflict (company_id) do nothing;
  select balance into v_balance from public.company_wallets where company_id = p_company for update;
  if v_balance + p_amount < 0 then raise exception 'company_wallet_insufficient'; end if;
  update public.company_wallets set balance = v_balance + p_amount, updated_at = now() where company_id = p_company;
  insert into public.company_wallet_transactions (company_id, type, amount, order_id, user_id, note)
    values (p_company, p_type, p_amount, p_order, p_user, p_note);
  return v_balance + p_amount;
end $$;
revoke all on function public.company_wallet_adjust(bigint, numeric, text, bigint, uuid, text) from public, anon, authenticated;
grant execute on function public.company_wallet_adjust(bigint, numeric, text, bigint, uuid, text) to service_role;

create table if not exists public.company_deposit_requests (
  id          bigint generated always as identity primary key,
  company_id  bigint not null references public.companies(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  amount      numeric not null check (amount > 0),
  method      text not null default 'waafi' check (method in ('waafi','cash','transfer','cheque')),
  reference   text,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  note        text,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);

-- ── Demandes de commande (acheteur au-delà du seuil → validation du gérant) ────────────
create table if not exists public.company_order_requests (
  id          bigint generated always as identity primary key,
  company_id  bigint not null references public.companies(id) on delete cascade,
  user_id     uuid   not null references auth.users(id) on delete cascade,   -- l'acheteur
  site_id     bigint references public.company_sites(id) on delete set null,
  items       jsonb  not null,                  -- lignes du panier (mêmes champs que l'API commande)
  total       numeric not null,
  delivery    jsonb,                            -- { fee, option_name, special_instructions }
  status      text   not null default 'awaiting' check (status in ('awaiting','approved','rejected','cancelled')),
  order_id    bigint references public.orders(id) on delete set null,
  decided_by  uuid references auth.users(id) on delete set null,
  decision_note text,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);

-- ── Commande récurrente de la société (une par fréquence) ─────────────
create table if not exists public.company_subscriptions (
  company_id    bigint not null references public.companies(id) on delete cascade,
  frequency     text   not null check (frequency in ('weekly','fortnightly','monthly')),
  site_id       bigint references public.company_sites(id) on delete set null,
  delivery_day  smallint not null default 1,    -- 0 = dimanche … 6 = samedi
  active        boolean not null default false,
  paused        boolean not null default false,
  paused_reason text check (paused_reason in ('low_balance','expired')),
  last_delivery date,
  reminder_sent_for date,
  delivery_fee  numeric not null default 0,
  updated_by    uuid references auth.users(id) on delete set null,
  updated_at    timestamptz not null default now(),
  primary key (company_id, frequency)
);
create table if not exists public.company_subscription_items (
  id         bigint generated always as identity primary key,
  company_id bigint not null references public.companies(id) on delete cascade,
  frequency  text   not null,
  product_id bigint not null references public.products(id) on delete cascade,
  quantity   numeric not null check (quantity > 0)
);
create index if not exists company_sub_items_idx on public.company_subscription_items (company_id, frequency);

-- ── Commandes : rattachement à la société ─────────────────────────────
alter table public.orders add column if not exists company_id      bigint references public.companies(id) on delete set null;
alter table public.orders add column if not exists company_site_id bigint references public.company_sites(id) on delete set null;
create index if not exists orders_company_idx on public.orders (company_id) where company_id is not null;

-- ── Droits de lecture (RLS) : membres de la société, ou admin / gestionnaire « companies » ─
create or replace function public.company_role(p_company bigint)
returns text language sql stable security definer set search_path = public as $$
  select role from public.company_members where company_id = p_company and user_id = auth.uid();
$$;

do $$
declare t text;
begin
  foreach t in array array['companies','company_members','company_invites','company_sites','company_wallets',
                           'company_wallet_transactions','company_deposit_requests','company_order_requests',
                           'company_subscriptions','company_subscription_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
  end loop;
end $$;

create policy companies_read on public.companies for select using (
  public.company_role(id) is not null or created_by = auth.uid() or public.is_admin_or_perm('companies','view'));
create policy company_members_read on public.company_members for select using (
  public.company_role(company_id) is not null or public.is_admin_or_perm('companies','view'));
create policy company_invites_read on public.company_invites for select using (
  public.company_role(company_id) = 'manager' or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or public.is_admin_or_perm('companies','view'));
create policy company_sites_read on public.company_sites for select using (
  public.company_role(company_id) is not null or public.is_admin_or_perm('companies','view'));
create policy company_wallets_read on public.company_wallets for select using (
  public.company_role(company_id) is not null or public.is_admin_or_perm('companies','view'));
create policy company_wallet_transactions_read on public.company_wallet_transactions for select using (
  public.company_role(company_id) in ('manager','accountant') or public.is_admin_or_perm('companies','view'));
create policy company_deposit_requests_read on public.company_deposit_requests for select using (
  public.company_role(company_id) in ('manager','accountant') or public.is_admin_or_perm('companies','view'));
create policy company_order_requests_read on public.company_order_requests for select using (
  public.company_role(company_id) in ('manager','accountant') or user_id = auth.uid()
  or public.is_admin_or_perm('companies','view'));
create policy company_subscriptions_read on public.company_subscriptions for select using (
  public.company_role(company_id) is not null or public.is_admin_or_perm('companies','view'));
create policy company_subscription_items_read on public.company_subscription_items for select using (
  public.company_role(company_id) is not null or public.is_admin_or_perm('companies','view'));

-- =====================================================================
-- ROLLBACK
-- alter table public.orders drop column if exists company_site_id, drop column if exists company_id;
-- drop table if exists public.company_subscription_items, public.company_subscriptions, public.company_order_requests,
--   public.company_deposit_requests, public.company_wallet_transactions, public.company_wallets,
--   public.company_sites, public.company_invites, public.company_members, public.companies cascade;
-- drop function if exists public.company_wallet_adjust(bigint, numeric, text, bigint, uuid, text);
-- drop function if exists public.company_role(bigint);
-- drop table if exists public.app_settings;
