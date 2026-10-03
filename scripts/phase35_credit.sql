-- Phase 35 : crédit client (« carnet ») — ligne de crédit par client ou société, relevé à l'échéance,
-- paiements affectés aux commandes les plus anciennes, rappels et suspension automatiques.
-- Migration additive. Accès serveur uniquement (RLS sans politique).

create table if not exists public.credit_accounts (
  id               bigint generated always as identity primary key,
  holder_type      text not null check (holder_type in ('user', 'company')),
  user_id          uuid references auth.users(id) on delete cascade,
  company_id       bigint references public.companies(id) on delete cascade,
  credit_limit     integer not null check (credit_limit >= 0),              -- plafond (Fdj)
  term             text not null default 'month_end' check (term in ('month_end', 'days')),
  term_days        integer check (term_days is null or term_days > 0),      -- échéance : N jours après la commande
  status           text not null default 'active' check (status in ('active', 'suspended')),
  auto_suspended   boolean not null default false,                          -- suspendu par le système (retard) : réactivé au règlement
  suspended_at     timestamptz,
  suspended_reason text,
  note             text,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check ((holder_type = 'user' and user_id is not null and company_id is null) or (holder_type = 'company' and company_id is not null and user_id is null))
);
create unique index if not exists credit_accounts_user_idx    on public.credit_accounts (user_id)    where user_id is not null;
create unique index if not exists credit_accounts_company_idx on public.credit_accounts (company_id) where company_id is not null;

-- Écritures : charge (commande), paiement, remboursement (annulation / remise), ajustement
create table if not exists public.credit_entries (
  id          bigint generated always as identity primary key,
  account_id  bigint not null references public.credit_accounts(id) on delete cascade,
  type        text not null check (type in ('charge', 'payment', 'refund', 'adjustment')),
  amount      integer not null check (amount > 0),            -- toujours positif ; le sens dépend du type
  order_id    bigint references public.orders(id) on delete set null,
  due_at      date,                                            -- charges : date limite de règlement
  paid_amount integer not null default 0 check (paid_amount >= 0),  -- charges : part déjà réglée (affectation des paiements)
  method      text,                                            -- paiements : cash | waafi | dmoney | other
  note        text,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists credit_entries_account_idx on public.credit_entries (account_id, created_at);
create index if not exists credit_entries_order_idx   on public.credit_entries (order_id);

-- Rappels envoyés (une fois par échéance et par type)
create table if not exists public.credit_reminders (
  id         bigint generated always as identity primary key,
  account_id bigint not null references public.credit_accounts(id) on delete cascade,
  kind       text not null check (kind in ('before', 'statement', 'overdue', 'suspended')),
  due_at     date not null,
  sent_at    timestamptz not null default now(),
  unique (account_id, kind, due_at)
);

alter table public.credit_accounts  enable row level security;
alter table public.credit_entries   enable row level security;
alter table public.credit_reminders enable row level security;

-- Paiement reçu : affecté aux charges les plus anciennes (verrou sur le compte, atomique).
-- Un éventuel excédent est gardé en paiement non affecté (il réduit l'encours).
create or replace function public.credit_pay(p_account bigint, p_amount integer, p_method text, p_note text, p_by uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  acc  public.credit_accounts;
  rest integer := p_amount;
  c    record;
  take integer;
  pid  bigint;
begin
  if p_amount is null or p_amount <= 0 then return jsonb_build_object('ok', false, 'reason', 'amount_invalid'); end if;
  select * into acc from public.credit_accounts where id = p_account for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'account_not_found'); end if;
  for c in select id, amount, paid_amount from public.credit_entries
           where account_id = p_account and type = 'charge' and paid_amount < amount
           order by coalesce(due_at, created_at::date), created_at, id
  loop
    exit when rest <= 0;
    take := least(rest, c.amount - c.paid_amount);
    update public.credit_entries set paid_amount = paid_amount + take where id = c.id;
    rest := rest - take;
  end loop;
  insert into public.credit_entries (account_id, type, amount, method, note, created_by)
  values (p_account, 'payment', p_amount, p_method, p_note, p_by) returning id into pid;
  return jsonb_build_object('ok', true, 'payment_id', pid, 'unallocated', rest);
end $$;
revoke all on function public.credit_pay(bigint, integer, text, text, uuid) from public, anon, authenticated;
grant execute on function public.credit_pay(bigint, integer, text, text, uuid) to service_role;

-- Remboursement sur une commande à crédit (annulation, remise) : la charge est réduite ; une part déjà
-- réglée qui dépasserait la nouvelle charge est réaffectée aux autres charges ouvertes (les plus
-- anciennes d'abord). Écriture « refund » conservée pour le journal (hors calcul de l'encours).
create or replace function public.credit_refund(p_order bigint, p_amount integer, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ch     public.credit_entries;
  newamt integer;
  excess integer;
  c      record;
  take   integer;
begin
  if p_amount is null or p_amount <= 0 then return jsonb_build_object('ok', false, 'reason', 'amount_invalid'); end if;
  select * into ch from public.credit_entries where order_id = p_order and type = 'charge' order by id limit 1 for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'charge_not_found'); end if;
  perform 1 from public.credit_accounts where id = ch.account_id for update;
  newamt := greatest(0, ch.amount - p_amount);
  excess := greatest(0, ch.paid_amount - newamt);
  update public.credit_entries set amount = greatest(1, newamt), paid_amount = least(ch.paid_amount, greatest(1, newamt)) where id = ch.id;
  if newamt = 0 then
    -- charge entièrement remboursée : on la garde à 1 Fdj réglé ? non — on la supprime et on réaffecte tout
    excess := ch.paid_amount;
    delete from public.credit_entries where id = ch.id;
  end if;
  for c in select id, amount, paid_amount from public.credit_entries
           where account_id = ch.account_id and type = 'charge' and paid_amount < amount and id <> ch.id
           order by coalesce(due_at, created_at::date), created_at, id
  loop
    exit when excess <= 0;
    take := least(excess, c.amount - c.paid_amount);
    update public.credit_entries set paid_amount = paid_amount + take where id = c.id;
    excess := excess - take;
  end loop;
  insert into public.credit_entries (account_id, type, amount, order_id, note) values (ch.account_id, 'refund', p_amount, p_order, p_note);
  return jsonb_build_object('ok', true, 'account_id', ch.account_id, 'unallocated', excess);
end $$;
revoke all on function public.credit_refund(bigint, integer, text) from public, anon, authenticated;
grant execute on function public.credit_refund(bigint, integer, text) to service_role;
