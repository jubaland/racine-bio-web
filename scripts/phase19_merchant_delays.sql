-- =====================================================================
-- PHASE 19 — Délais de l'abonnement marchand paramétrables (28/09/2026)
-- Avant : 7 et 1 jours (rappels), 3 jours (alerte paiement déclaré), 7 jours (prolongation) écrits
-- dans le code. Désormais réglages de admin › Marchands › Plans ; les valeurs ci-dessous reprennent
-- le comportement en place et sont modifiables. Un réglage vide (null) désactive la fonction.
-- Sauvegarde : avant-reglages-marchands.
-- =====================================================================
insert into public.app_settings (key, value_num) values
  ('merchant.reminder_first_days', 7),
  ('merchant.reminder_last_days', 1),
  ('merchant.stale_payment_days', 3),
  ('merchant.extend_days', 7)
on conflict (key) do nothing;
select key, value_num from public.app_settings where key like 'merchant.%' order by key;

-- ROLLBACK
-- delete from public.app_settings where key in ('merchant.reminder_first_days','merchant.reminder_last_days','merchant.stale_payment_days','merchant.extend_days');
