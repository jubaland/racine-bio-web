-- Système de cagnotte (dépôt prépayé) — Phase 1.
-- À exécuter dans Supabase Dashboard → SQL Editor.

-- Solde par client
CREATE TABLE IF NOT EXISTS wallets (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  balance    numeric not null default 0,
  updated_at timestamptz not null default now()
);
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wallets_select_own ON wallets;
CREATE POLICY wallets_select_own ON wallets FOR SELECT USING (auth.uid() = user_id);
-- Écritures uniquement via service role (fonction wallet_adjust) : aucune policy d'écriture.

-- Historique des mouvements (dépôt / débit / remboursement / ajustement)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,            -- deposit | debit | refund | adjustment
  amount     numeric not null,          -- positif = crédit, négatif = débit
  order_id   bigint references orders(id) on delete set null,
  note       text,
  created_at timestamptz not null default now()
);
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wallet_tx_select_own ON wallet_transactions;
CREATE POLICY wallet_tx_select_own ON wallet_transactions FOR SELECT USING (auth.uid() = user_id);

-- Mouvement de solde atomique (crédit OU débit) + ligne d'historique.
CREATE OR REPLACE FUNCTION wallet_adjust(
  p_user   uuid,
  p_amount numeric,
  p_type   text,
  p_order  bigint default null,
  p_note   text   default null
) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_balance numeric;
BEGIN
  INSERT INTO wallets (user_id, balance) VALUES (p_user, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = wallets.balance + p_amount, updated_at = now()
  RETURNING balance INTO new_balance;

  INSERT INTO wallet_transactions (user_id, type, amount, order_id, note)
    VALUES (p_user, p_type, p_amount, p_order, p_note);

  RETURN new_balance;
END $$;
