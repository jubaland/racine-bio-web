-- =====================================================================
-- PHASE 12 — Réassort intelligent : rappel J-1 et reprise automatique (26/09/2026)
-- • reminder_sent_for : date d'échéance pour laquelle le rappel de la veille a été envoyé (idempotence)
-- • paused_reason     : pourquoi la commande modèle est en pause ('low_balance' | 'expired' | null = par le client)
--   → seule une pause 'low_balance' est levée automatiquement quand la cagnotte est rechargée.
-- Point de retour : sauvegarde avant-reassort.
-- =====================================================================
alter table public.subscriptions add column if not exists reminder_sent_for date;
alter table public.subscriptions add column if not exists paused_reason text
  check (paused_reason in ('low_balance','expired'));

-- ROLLBACK
-- alter table public.subscriptions drop column if exists reminder_sent_for, drop column if exists paused_reason;
