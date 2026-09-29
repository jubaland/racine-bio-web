-- =====================================================================
-- PHASE 24 — Langue de la commande (28/09/2026)
-- orders.lang : langue choisie au moment de la commande. Sert aux e-mails de confirmation et de suivi,
-- y compris pour les invités (qui n'ont pas de compte où enregistrer leur langue).
-- Absente = langue du compte, sinon français. Sauvegarde : avant-emails-traduits.
-- =====================================================================
alter table public.orders add column if not exists lang text
  check (lang is null or lang in ('fr','en','zh','am','so','aa'));

-- ROLLBACK
-- alter table public.orders drop column if exists lang;
