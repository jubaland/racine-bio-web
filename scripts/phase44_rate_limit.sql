-- Phase 44 : anti-rafale — limite d'essais par adresse (codes promo/parrainage, commandes invité).
-- Compteur à fenêtre fixe, atomique (une ligne par clé ; la clé contient une empreinte de l'adresse,
-- jamais l'adresse elle-même). Réglages dans app_settings monitor.* (admin › Surveillance), semés
-- avec des valeurs par défaut ; vide = protection désactivée. Migration additive.

create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 1
);
alter table public.rate_limits enable row level security;

create or replace function public.rate_hit(p_key text, p_limit integer, p_window_secs integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  insert into public.rate_limits as t (key, window_start, count) values (p_key, now(), 1)
  on conflict (key) do update set
    count        = case when t.window_start < now() - make_interval(secs => p_window_secs) then 1 else t.count + 1 end,
    window_start = case when t.window_start < now() - make_interval(secs => p_window_secs) then now() else t.window_start end
  returning t.count, t.window_start into r;
  return jsonb_build_object(
    'allowed', r.count <= p_limit,
    'retry_after', greatest(1, ceil(extract(epoch from (r.window_start + make_interval(secs => p_window_secs) - now()))))::int
  );
end $$;
revoke all on function public.rate_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_hit(text, integer, integer) to service_role;

-- Réglages par défaut (créés seulement s'ils n'existent pas : l'admin garde la main ensuite)
insert into public.app_settings (key, value_num, updated_at)
select v.key, v.value_num, now() from (values ('monitor.code_attempts_15min', 20), ('monitor.guest_orders_hour', 10)) as v(key, value_num)
where not exists (select 1 from public.app_settings a where a.key = v.key);
