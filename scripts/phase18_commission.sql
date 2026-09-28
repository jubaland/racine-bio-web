-- =====================================================================
-- PHASE 18 — Formule « Commission » pour les marchands (28/09/2026)
-- Deux formules au choix du marchand :
--   • abonnement : période payée d'avance (merchant_plans / merchant_subscriptions), 0 % de commission ;
--   • commission : rien à payer d'avance, Hornafresh retient un pourcentage des ventes livrées.
-- Aucun chiffre en dur dans le code. Réglages (admin › Marchands › Plans) :
--   app_settings.merchant.commission_enabled (1/0) : formule proposée aux marchands ou non
--   app_settings.merchant.commission_rate          : taux général, en pourcentage
--   merchant_formulas.commission_rate              : taux particulier d'un marchand (admin)
-- La formule commission vit dans app_settings et non dans merchant_plans : cette table ne contient
-- que des plans d'abonnement (tout plan actif y est proposé au paiement).
-- Le taux appliqué est photographié sur chaque ligne de commande : un changement de taux ne
-- modifie jamais les ventes passées. Le prix payé par le client ne change pas.
-- Point de retour : sauvegarde avant-commission.
-- =====================================================================
insert into public.app_settings (key, value_num) values ('merchant.commission_enabled', 1), ('merchant.commission_rate', 10)
on conflict (key) do nothing;   -- valeurs de départ, modifiables dans l'admin

-- ── Formule de chaque marchand ───────────────────────────────────────
-- Table à part (et non merchant_profiles, que le marchand peut modifier lui-même) : écritures
-- réservées au serveur, pour qu'un marchand ne puisse pas changer son propre taux.
create table if not exists public.merchant_formulas (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  kind            text not null default 'subscription' check (kind in ('subscription','commission')),
  commission_rate numeric check (commission_rate is null or (commission_rate >= 0 and commission_rate <= 100)), -- taux particulier
  status          text not null default 'active' check (status in ('active','suspended')),
  pending_kind    text check (pending_kind in ('subscription','commission')),      -- changement demandé, appliqué à l'échéance
  since           date not null default current_date,
  note            text,
  updated_at      timestamptz not null default now()
);
alter table public.merchant_formulas enable row level security;
drop policy if exists mform_read on public.merchant_formulas;
create policy mform_read on public.merchant_formulas for select
  using (user_id = auth.uid() or public.is_admin_or_perm('merchants','view'));

-- ── Visibilité : abonnement actif OU formule commission active ────────
create or replace function public.merchant_is_active(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and (
    exists (select 1 from merchant_subscriptions s
            where s.user_id = p_user and s.status = 'active' and s.ends_at >= current_date)
    or exists (select 1 from merchant_formulas f
               where f.user_id = p_user and f.kind = 'commission' and f.status = 'active')
  );
$$;

-- Taux de commission applicable à un marchand aujourd'hui (0 s'il est en abonnement)
create or replace function public.merchant_commission_rate(p_user uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((
    select coalesce(f.commission_rate, (select value_num from app_settings where key = 'merchant.commission_rate'), 0)
    from merchant_formulas f
    where f.user_id = p_user and f.kind = 'commission'
  ), 0);
$$;

-- ── Commandes : taux photographié ; reversements : brut, commission, net ─────────────
alter table public.order_items add column if not exists commission_rate numeric
  check (commission_rate is null or (commission_rate >= 0 and commission_rate <= 100));
alter table public.merchant_payouts add column if not exists gross_amount      numeric;
alter table public.merchant_payouts add column if not exists commission_amount numeric not null default 0;
update public.merchant_payouts set gross_amount = amount where gross_amount is null;

-- =====================================================================
-- ROLLBACK
-- (rétablir d'abord merchant_is_active() de scripts/phase1_merchant_subscriptions.sql)
-- drop function if exists public.merchant_commission_rate(uuid);
-- drop table if exists public.merchant_formulas;
-- alter table public.merchant_payouts drop column if exists commission_amount, drop column if exists gross_amount;
-- alter table public.order_items drop column if exists commission_rate;
-- delete from public.app_settings where key like 'merchant.commission%';
