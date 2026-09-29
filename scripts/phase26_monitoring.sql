-- =====================================================================
-- PHASE 26 — Surveillance des erreurs (29/09/2026)
-- Journal des erreurs du site : serveur (routes d'API), tâches planifiées (cron), navigateur des clients.
-- Une ligne par erreur NON RÉSOLUE et par empreinte (même erreur = compteur incrémenté, pas de doublon).
-- Alerte admin à la première apparition, puis au plus une fois par délai (réglage).
-- Lecture et écriture par le serveur uniquement (aucune politique RLS : la table est fermée aux clients).
-- Réglages (admin › Surveillance), tous modifiables :
--   monitor.alert_enabled        alerte admin (cloche + push)
--   monitor.alert_email          alerte par e-mail en plus
--   monitor.alert_cooldown_min   délai minimal entre deux alertes pour la même erreur (minutes)
--   monitor.alert_client         alerter aussi pour les erreurs du navigateur
--   monitor.client_enabled       enregistrer les erreurs du navigateur
--   monitor.retention_days       durée de conservation (jours)
-- Sauvegarde : avant-surveillance.
-- =====================================================================
create table if not exists public.error_logs (
  id          bigserial primary key,
  fingerprint text not null,
  source      text not null check (source in ('server','cron','client')),
  route       text,
  method      text,
  status      int,
  message     text not null,
  stack       text,
  user_id     uuid,
  context     jsonb,
  count       int not null default 1,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  alerted_at  timestamptz,
  resolved_at timestamptz,
  resolved_by uuid
);
create unique index if not exists error_logs_open_fp on public.error_logs (fingerprint) where resolved_at is null;
create index if not exists error_logs_last_seen on public.error_logs (last_seen desc);
alter table public.error_logs enable row level security;

-- Enregistre une erreur (nouvelle ligne ou compteur) et dit s'il faut alerter. Atomique.
create or replace function public.error_log_record(
  p_fingerprint text, p_source text, p_route text, p_method text, p_status int,
  p_message text, p_stack text, p_user uuid, p_context jsonb, p_cooldown_min int
) returns jsonb language plpgsql security definer set search_path = public as $$
declare r error_logs; v_new boolean := false; v_alert boolean := false;
begin
  insert into error_logs (fingerprint, source, route, method, status, message, stack, user_id, context)
  values (p_fingerprint, p_source, p_route, p_method, p_status, p_message, p_stack, p_user, p_context)
  on conflict (fingerprint) where resolved_at is null
  do update set count = error_logs.count + 1, last_seen = now(), status = coalesce(excluded.status, error_logs.status),
                user_id = coalesce(excluded.user_id, error_logs.user_id), context = coalesce(excluded.context, error_logs.context)
  returning * into r;
  v_new := (r.count = 1);
  if r.alerted_at is null or (p_cooldown_min is not null and r.alerted_at < now() - make_interval(mins => p_cooldown_min)) then
    update error_logs set alerted_at = now() where id = r.id;
    v_alert := true;
  end if;
  return jsonb_build_object('id', r.id, 'count', r.count, 'is_new', v_new, 'alert', v_alert);
end $$;
revoke all on function public.error_log_record(text,text,text,text,int,text,text,uuid,jsonb,int) from public, anon, authenticated;
grant execute on function public.error_log_record(text,text,text,text,int,text,text,uuid,jsonb,int) to service_role;

insert into public.app_settings (key, value_num) values
  ('monitor.alert_enabled', 1), ('monitor.alert_email', 0), ('monitor.alert_cooldown_min', 60),
  ('monitor.alert_client', 0), ('monitor.client_enabled', 1), ('monitor.retention_days', 30)
on conflict (key) do nothing;
select key, value_num from public.app_settings where key like 'monitor.%' order by key;

-- ROLLBACK
-- drop function if exists public.error_log_record(text,text,text,text,int,text,text,uuid,jsonb,int);
-- drop table if exists public.error_logs;
-- delete from public.app_settings where key like 'monitor.%';

-- Seuil de stock bas (tableau de bord du jour, alertes à la commande). Valeur de départ = seuil en place.
insert into public.app_settings (key, value_num) values ('stock.low_threshold', 5) on conflict (key) do nothing;
