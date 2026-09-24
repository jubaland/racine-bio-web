-- =====================================================================
-- PHASE 1 ④ — Cron quotidien marchands : colonnes de traçage (idempotence)
-- Le cron (/api/cron/merchants) expire les abonnements échus, envoie les rappels
-- J-7 / J-1 et alerte l'admin sur les paiements déclarés non traités.
-- Ces horodatages garantissent qu'un rappel n'est envoyé qu'une seule fois,
-- même si le cron est relancé plusieurs fois dans la journée.
-- Point de retour : sauvegarde 2026-09-24-avant-cron-marchands.
-- =====================================================================

alter table public.merchant_subscriptions
  add column if not exists reminder_7_sent_at   timestamptz,
  add column if not exists reminder_1_sent_at   timestamptz,
  add column if not exists expired_notified_at  timestamptz,
  add column if not exists stale_alerted_at     timestamptz;  -- paiement en attente signalé à l'admin

-- Index partiel : le cron ne parcourt que les lignes actives / en attente
create index if not exists ms_cron_idx on public.merchant_subscriptions (status, ends_at)
  where status in ('active', 'pending_payment');

-- Textes d'interface (notifications in-app côté marchand sont en français, comme les e-mails)
-- Aucun texte UI supplémentaire : la page « Mon abonnement » affiche déjà les états.

-- =====================================================================
-- ROLLBACK
-- drop index if exists public.ms_cron_idx;
-- alter table public.merchant_subscriptions
--   drop column if exists reminder_7_sent_at, drop column if exists reminder_1_sent_at,
--   drop column if exists expired_notified_at, drop column if exists stale_alerted_at;
-- =====================================================================
