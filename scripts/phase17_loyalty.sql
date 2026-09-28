-- =====================================================================
-- PHASE 17 — Fidélité : carte à tampons (28/09/2026)
-- Chaque commande LIVRÉE d'un particulier donne un tampon ; au bout de N tampons, une récompense
-- est créditée sur sa cagnotte. Tout est paramétrable dans l'admin (app_settings) :
--   loyalty.enabled (1/0), loyalty.orders_required, loyalty.reward_amount, loyalty.min_order
-- Garde-fous : un tampon par commande, un seul tampon par jour et par client (pas de découpage),
-- commande au moins égale au minimum, comptes entreprise exclus, tampon retiré si la commande
-- est annulée avant d'avoir servi à une récompense.
-- Point de retour : sauvegarde avant-fidelite.
-- =====================================================================
insert into public.app_settings (key, value_num) values
  ('loyalty.enabled', 1), ('loyalty.orders_required', 10), ('loyalty.reward_amount', 1000), ('loyalty.min_order', 1000)
on conflict (key) do nothing;

create table if not exists public.loyalty_rewards (
  id          bigint generated always as identity primary key,
  user_id     uuid   not null references auth.users(id) on delete cascade,
  amount      numeric not null check (amount >= 0),
  stamps_used int    not null,
  created_at  timestamptz not null default now()
);
create index if not exists loyalty_rewards_user_idx on public.loyalty_rewards (user_id, created_at desc);

create table if not exists public.loyalty_stamps (
  id         bigint generated always as identity primary key,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  order_id   bigint not null references public.orders(id) on delete cascade,
  stamp_date date   not null default current_date,
  reward_id  bigint references public.loyalty_rewards(id) on delete set null,   -- tampon déjà converti en récompense
  created_at timestamptz not null default now(),
  unique (order_id),
  unique (user_id, stamp_date)
);
create index if not exists loyalty_stamps_open_idx on public.loyalty_stamps (user_id) where reward_id is null;

alter table public.loyalty_stamps  enable row level security;
alter table public.loyalty_rewards enable row level security;
drop policy if exists loyalty_stamps_read  on public.loyalty_stamps;
drop policy if exists loyalty_rewards_read on public.loyalty_rewards;
-- Lecture : le client voit sa carte ; admin / gestionnaire « loyalty ». Écritures : serveur uniquement.
create policy loyalty_stamps_read  on public.loyalty_stamps  for select using (user_id = auth.uid() or public.is_admin_or_perm('loyalty','view'));
create policy loyalty_rewards_read on public.loyalty_rewards for select using (user_id = auth.uid() or public.is_admin_or_perm('loyalty','view'));

-- Attribution atomique : pose le tampon et, si le compte est atteint, crée la récompense, marque les
-- tampons utilisés et crédite la cagnotte — le tout dans une transaction, carte du client verrouillée.
create or replace function public.loyalty_award(p_user uuid, p_order bigint, p_required int, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_stamp bigint; v_open int; v_reward bigint; v_balance numeric;
begin
  perform pg_advisory_xact_lock(hashtext('loyalty:' || p_user::text));
  insert into public.loyalty_stamps (user_id, order_id) values (p_user, p_order)
  on conflict do nothing returning id into v_stamp;
  if v_stamp is null then
    select count(*) into v_open from public.loyalty_stamps where user_id = p_user and reward_id is null;
    return jsonb_build_object('stamped', false, 'open', v_open, 'rewarded', false);
  end if;
  select count(*) into v_open from public.loyalty_stamps where user_id = p_user and reward_id is null;
  if p_required > 0 and v_open >= p_required then
    insert into public.loyalty_rewards (user_id, amount, stamps_used) values (p_user, p_amount, p_required) returning id into v_reward;
    update public.loyalty_stamps set reward_id = v_reward
     where id in (select id from public.loyalty_stamps where user_id = p_user and reward_id is null order by created_at, id limit p_required);
    if p_amount > 0 then
      v_balance := public.wallet_adjust(p_user, p_amount, 'loyalty', p_order, 'Récompense fidélité');
    end if;
    return jsonb_build_object('stamped', true, 'open', v_open - p_required, 'rewarded', true, 'reward_id', v_reward, 'amount', p_amount, 'balance', v_balance);
  end if;
  return jsonb_build_object('stamped', true, 'open', v_open, 'rewarded', false);
end $$;
revoke all on function public.loyalty_award(uuid, bigint, int, numeric) from public, anon, authenticated;
grant execute on function public.loyalty_award(uuid, bigint, int, numeric) to service_role;

-- =====================================================================
-- ROLLBACK
-- drop function if exists public.loyalty_award(uuid, bigint, int, numeric);
-- drop table if exists public.loyalty_stamps, public.loyalty_rewards;
-- delete from public.app_settings where key like 'loyalty.%';
