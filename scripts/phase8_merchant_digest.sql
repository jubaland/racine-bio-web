-- =====================================================================
-- PHASE 8 — Récapitulatif e-mail quotidien au marchand (25/09/2026)
-- merchant_profiles.email_mode : 'instant' (un e-mail par commande, comportement actuel)
--                                'daily'   (récapitulatif quotidien envoyé par le cron marchands)
-- Cloche + push restent immédiats dans les deux cas. digest_sent_at = idempotence du cron.
-- Point de retour : sauvegarde 2026-09-25-avant-recap-marchand.
-- =====================================================================
alter table public.merchant_profiles
  add column if not exists email_mode     text not null default 'instant' check (email_mode in ('instant','daily')),
  add column if not exists digest_sent_at timestamptz;

-- Le marchand peut modifier son propre mode d'e-mail (le reste est géré par l'admin / les API)
drop policy if exists mprof_self_update on public.merchant_profiles;
create policy mprof_self_update on public.merchant_profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ROLLBACK
-- drop policy if exists mprof_self_update on public.merchant_profiles;
-- alter table public.merchant_profiles drop column if exists email_mode, drop column if exists digest_sent_at;
