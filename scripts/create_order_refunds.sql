-- Journal des remboursements liés aux modifications/annulations de commande.
-- cagnotte = effectué automatiquement ; Waafi/manuel = à effectuer (puis marqué fait).
-- À exécuter dans Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS order_refunds (
  id         bigint generated always as identity primary key,
  order_id   bigint NOT NULL,
  amount     numeric NOT NULL,
  method     text    NOT NULL,                 -- 'wallet' | 'manual'
  reason     text,
  status     text    NOT NULL DEFAULT 'pending', -- 'pending' | 'done'
  created_at timestamptz NOT NULL DEFAULT now(),
  done_at    timestamptz
);

CREATE INDEX IF NOT EXISTS order_refunds_status_idx ON order_refunds (status, created_at DESC);

-- Écritures et lectures via l'API (service role) ; pas d'accès direct client.
ALTER TABLE order_refunds ENABLE ROW LEVEL SECURITY;
