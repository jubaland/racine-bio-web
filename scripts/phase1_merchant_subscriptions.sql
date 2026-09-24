-- =====================================================================
-- PHASE 1 ① — Abonnement marchand : plans, abonnements, visibilité, modération
-- Modèle : Hornafresh = hub (vend/livre), abonnement seul (pas de commission),
--          produits marchands validés par l'admin.
-- Exécuté via l'API de gestion. Point de retour : sauvegarde 2026-09-22-avant-phase1.
-- =====================================================================

-- ── Plans ────────────────────────────────────────────────────────────────
create table if not exists public.merchant_plans (
  id            bigint generated always as identity primary key,
  name          text    not null,
  price_fdj     numeric not null,
  duration_days integer not null default 30,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
insert into public.merchant_plans (name, price_fdj, duration_days)
select 'Mensuel', 5000, 30 where not exists (select 1 from public.merchant_plans);

-- ── Abonnements : une ligne par période (historique) ─────────────────────
create table if not exists public.merchant_subscriptions (
  id                bigint generated always as identity primary key,
  user_id           uuid    not null references auth.users(id) on delete cascade,
  plan_id           bigint  references public.merchant_plans(id),
  amount            numeric not null default 0,
  starts_at         date,
  ends_at           date,
  status            text    not null default 'pending_payment', -- pending_payment | active | expired | suspended | cancelled | rejected
  payment_method    text    default 'waafi',
  payment_reference text,
  paid_at           timestamptz,
  confirmed_by      uuid,
  notes             text,
  created_at        timestamptz not null default now()
);
create index if not exists ms_user_status_idx on public.merchant_subscriptions (user_id, status);
create index if not exists ms_ends_idx        on public.merchant_subscriptions (ends_at);

-- Montant = prix du plan à la création (le marchand ne choisit pas le montant)
create or replace function public.ms_set_amount()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.plan_id is not null then
    select price_fdj into new.amount from merchant_plans where id = new.plan_id;
  end if;
  return new;
end $$;
drop trigger if exists ms_set_amount_trg on public.merchant_subscriptions;
create trigger ms_set_amount_trg before insert on public.merchant_subscriptions
  for each row execute function public.ms_set_amount();

-- Marchand actif = abonnement actif non échu
create or replace function public.merchant_is_active(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and exists (
    select 1 from merchant_subscriptions s
    where s.user_id = p_user and s.status = 'active' and s.ends_at >= current_date
  );
$$;

-- ── RLS des nouvelles tables ─────────────────────────────────────────────
alter table public.merchant_plans enable row level security;
drop policy if exists mp_read  on public.merchant_plans;
drop policy if exists mp_write on public.merchant_plans;
create policy mp_read  on public.merchant_plans for select using (true);
create policy mp_write on public.merchant_plans for all
  using (public.is_admin_or_perm('merchants','edit')) with check (public.is_admin_or_perm('merchants','edit'));

alter table public.merchant_subscriptions enable row level security;
drop policy if exists ms_read   on public.merchant_subscriptions;
drop policy if exists ms_insert on public.merchant_subscriptions;
drop policy if exists ms_update on public.merchant_subscriptions;
drop policy if exists ms_delete on public.merchant_subscriptions;
create policy ms_read   on public.merchant_subscriptions for select
  using (user_id = auth.uid() or public.is_admin_or_perm('merchants','view'));
create policy ms_insert on public.merchant_subscriptions for insert
  with check (user_id = auth.uid() and status = 'pending_payment');   -- le marchand ne fait que demander
create policy ms_update on public.merchant_subscriptions for update
  using (public.is_admin_or_perm('merchants','edit')) with check (public.is_admin_or_perm('merchants','edit'));
create policy ms_delete on public.merchant_subscriptions for delete
  using (public.is_admin_or_perm('merchants','edit'));

-- ── Produits : modération ────────────────────────────────────────────────
alter table public.products add column if not exists review_note text;       -- motif de refus
alter table public.products add column if not exists reviewed_at timestamptz;

-- Visibilité publique : publié ET (produit Hornafresh OU marchand actif)
drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (
  (status = 'published' and (owner_id is null or public.merchant_is_active(owner_id)))
  or public.is_admin_or_perm('products','view') or public.is_owner(owner_id)
);

-- Un marchand : création → à valider ; modif sensible → à valider ; ne publie jamais lui-même ;
-- ne transfère pas la propriété. Admin / gestionnaire / API (service role) : libres.
create or replace function public.products_moderation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_admin boolean;
begin
  if new.owner_id is null then return new; end if;
  v_admin := auth.role() = 'service_role'
          or coalesce(auth.jwt(), '{}'::jsonb) = '{}'::jsonb
          or public.is_admin_or_perm('products','edit');
  if v_admin then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'pending_review'; new.review_note := null; new.reviewed_at := null;
  else
    new.owner_id := old.owner_id;
    if new.name        is distinct from old.name        or new.price    is distinct from old.price
    or new.description is distinct from old.description or new.image_url is distinct from old.image_url
    or new.category    is distinct from old.category    or new.unit     is distinct from old.unit then
      new.status := 'pending_review'; new.review_note := null; new.reviewed_at := null;
    elsif new.status = 'published' and old.status is distinct from 'published' then
      new.status := old.status;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists products_moderation_trg on public.products;
create trigger products_moderation_trg before insert or update on public.products
  for each row execute function public.products_moderation();

-- ── Correctif (24/09) : colonne de présentation obligatoire sans défaut → défaut ──
-- (le formulaire marchand ne la renseigne pas ; toutes les fiches existantes valent '#ecf4d5')
alter table public.products alter column bg_color set default '#ecf4d5';

-- =====================================================================
-- ROLLBACK ①
-- drop trigger if exists products_moderation_trg on public.products;
-- drop function if exists public.products_moderation();
-- drop policy if exists products_read on public.products;
-- create policy products_read on public.products for select using (
--   status = 'published' or public.is_admin_or_perm('products','view') or public.is_owner(owner_id));
-- alter table public.products drop column if exists review_note, drop column if exists reviewed_at;
-- drop function if exists public.merchant_is_active(uuid);
-- drop table if exists public.merchant_subscriptions;
-- drop function if exists public.ms_set_amount();
-- drop table if exists public.merchant_plans;
-- =====================================================================
