-- Annonces diffusées à tous les clients (bandeau sur le site + push PWA).
-- À exécuter dans Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS announcements (
  id         bigint generated always as identity primary key,
  title      text NOT NULL,
  body       text,
  url        text,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Lecture publique des annonces actives (le bandeau du site doit pouvoir les lire)
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS announcements_read ON announcements;
CREATE POLICY announcements_read ON announcements FOR SELECT USING (active = true);
-- Les écritures passent par l'API admin (service role) — pas de policy d'écriture.
