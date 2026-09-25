-- =====================================================================
-- PHASE 4 — Onboarding « Devenir marchand » (25/09/2026)
-- producer_requests : téléphone (obligatoire côté formulaire), motif admin, date de traitement.
-- Insertion : compte connecté uniquement (e-mail du jeton ou user_id), comme avant.
-- Point de retour : sauvegarde 2026-09-25-avant-onboarding-marchand.
-- =====================================================================
alter table public.producer_requests
  add column if not exists phone       text,
  add column if not exists admin_note  text,
  add column if not exists resolved_at timestamptz;

drop policy if exists pr_insert on public.producer_requests;
create policy pr_insert on public.producer_requests for insert
  with check (email = (auth.jwt() ->> 'email') or user_id = auth.uid());

-- ROLLBACK
-- alter table public.producer_requests drop column if exists phone, drop column if exists admin_note, drop column if exists resolved_at;
-- drop policy if exists pr_insert on public.producer_requests;
-- create policy pr_insert on public.producer_requests for insert with check (email = (auth.jwt() ->> 'email'));
