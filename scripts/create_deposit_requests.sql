-- Demandes de recharge de cagnotte (self-service client, validées par l'admin).
-- À exécuter dans Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS deposit_requests (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount      numeric not null,
  reference   text,
  status      text not null default 'pending',   -- pending | approved | rejected
  note        text,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);
ALTER TABLE deposit_requests ENABLE ROW LEVEL SECURITY;

-- Client : créer ses demandes + lire les siennes
DROP POLICY IF EXISTS deposit_req_insert_own ON deposit_requests;
CREATE POLICY deposit_req_insert_own ON deposit_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS deposit_req_select_own ON deposit_requests;
CREATE POLICY deposit_req_select_own ON deposit_requests FOR SELECT USING (auth.uid() = user_id);
-- Validation/refus (UPDATE) : service role uniquement (aucune policy update).
