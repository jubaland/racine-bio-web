-- Phase 45 — commande créée « pour le compte de » (copie de commande par le gestionnaire)
-- Traçabilité : qui a créé la commande (équipe) et depuis quelle commande d'origine.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS copied_from bigint;
COMMENT ON COLUMN orders.created_by  IS 'Membre de l''équipe ayant créé la commande pour le client (null = commande passée par le client lui-même)';
COMMENT ON COLUMN orders.copied_from IS 'Commande d''origine quand celle-ci a été créée par copie';
