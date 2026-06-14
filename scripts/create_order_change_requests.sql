-- Demandes de modification de commande (client demande → admin valide).
-- À exécuter dans Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS order_change_requests (
  id               bigint generated always as identity primary key,
  order_id         bigint NOT NULL,
  item_id          bigint NOT NULL,             -- order_items.id concerné
  user_id          uuid   NOT NULL,             -- demandeur
  product_name     text,                        -- snapshot pour affichage
  unit             text,
  type             text   NOT NULL,             -- 'remove' | 'reduce'
  current_quantity integer,
  new_quantity     integer NOT NULL DEFAULT 0,  -- 0 = retrait total
  refund_amount    numeric,                     -- estimation au moment de la demande
  status           text   NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  created_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz
);

CREATE INDEX IF NOT EXISTS ocr_status_idx ON order_change_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS ocr_user_idx   ON order_change_requests (user_id, status);

-- Le client lit SES demandes ; les écritures passent par l'API (service role).
ALTER TABLE order_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ocr_select_own ON order_change_requests;
CREATE POLICY ocr_select_own ON order_change_requests FOR SELECT USING (auth.uid() = user_id);
