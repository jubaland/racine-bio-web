-- Réglages d'affichage du site (ex. masquer des blocs de la page d'accueil).
-- À exécuter dans Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS site_settings (
  key        text PRIMARY KEY,
  value      boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Lecture publique (la page d'accueil doit pouvoir lire les réglages)
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_settings_read ON site_settings;
CREATE POLICY site_settings_read ON site_settings FOR SELECT USING (true);
-- Les écritures passent par le service role (API admin), donc pas de policy d'écriture.
