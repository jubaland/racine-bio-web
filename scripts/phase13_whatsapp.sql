-- =====================================================================
-- PHASE 13 — WhatsApp « cliquer pour discuter » (26/09/2026)
-- Numéro WhatsApp public du marchand (optionnel, rempli par lui dans son tableau de bord) :
-- affiché sur sa vitrine et ses fiches produit. Lecture publique (merchant_profiles est déjà
-- lisible par tous), écriture par le marchand (mprof_self_update) ou l'admin.
-- =====================================================================
alter table public.merchant_profiles add column if not exists whatsapp text; -- international sans « + » (253…)

-- ROLLBACK
-- alter table public.merchant_profiles drop column if exists whatsapp;
