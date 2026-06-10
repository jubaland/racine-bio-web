-- Centre de notifications client : historique par utilisateur (cloche dans le header).
-- À exécuter dans Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS user_notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid NOT NULL,
  title      text NOT NULL,
  body       text,
  url        text,
  read       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_notifications_user_idx
  ON user_notifications (user_id, created_at DESC);

-- RLS : chaque utilisateur lit et marque comme lues SES propres notifications.
-- Les insertions passent par le service role (API), donc pas de policy d'insertion.
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS un_select ON user_notifications;
CREATE POLICY un_select ON user_notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS un_update ON user_notifications;
CREATE POLICY un_update ON user_notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Temps réel (cloche qui s'incrémente sans rechargement)
ALTER PUBLICATION supabase_realtime ADD TABLE user_notifications;
