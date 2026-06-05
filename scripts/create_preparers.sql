-- Table des préparateurs de commandes.
-- Reçoivent par email le bordereau de chaque nouvelle commande.
-- Emails non exposés publiquement : RLS activé sans policy publique
-- (seules les routes API serveur, via le service role, y accèdent).
-- À exécuter dans Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS preparers (
  id         bigint generated always as identity primary key,
  name       text    not null,
  email      text    not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

ALTER TABLE preparers ENABLE ROW LEVEL SECURITY;
-- Aucune policy : la table n'est accessible que via le service role (API).
