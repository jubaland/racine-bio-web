-- Demandes d'annulation de commande émises par un gestionnaire, à valider par un admin.
-- À exécuter dans Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS order_cancel_requests (
  id                bigint generated always as identity primary key,
  order_id          bigint NOT NULL,
  requested_by      uuid,
  requested_by_name text,
  status            text NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  created_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz
);

CREATE INDEX IF NOT EXISTS ocxr_status_idx ON order_cancel_requests (status, created_at DESC);

-- Écritures et lectures via l'API (service role).
ALTER TABLE order_cancel_requests ENABLE ROW LEVEL SECURITY;
