-- =====================================================================
-- PHASE 0-c — Durcissement RLS hors catalogue (25/09/2026)
-- Audit : politiques `using (true)` / `with check (true)` ouvertes à tous (anon compris).
-- Principe : le site n'accède à ces tables que via les API service role (qui contournent RLS)
-- ou avec une session admin (is_admin_or_perm). Aucun code client ne lit/écrit ces tables
-- directement (vérifié par grep) — sauf lectures publiques des traductions, conservées.
-- Point de retour : sauvegarde 2026-09-24-avant-cron-marchands (schema.sql contient les
-- anciennes politiques) + section ROLLBACK ci-dessous.
-- =====================================================================

-- 1. push_subscriptions : « service role full access » était accordé à PUBLIC (lecture des
--    endpoints/clés et suppression possibles par n'importe qui). Le service role contourne RLS :
--    aucune politique n'est nécessaire.
drop policy if exists "service role full access" on public.push_subscriptions;

-- 2. profiles (id, full_name, email…) : lecture/màj de son propre profil ou admin (module users).
--    L'insertion est faite par le trigger handle_new_user (SECURITY DEFINER) → pas de politique.
drop policy if exists "Lecture profiles" on public.profiles;
drop policy if exists "Insert profiles"  on public.profiles;
drop policy if exists "Update profiles"  on public.profiles;
create policy profiles_read   on public.profiles for select using (id = auth.uid() or public.is_admin_or_perm('users','view'));
create policy profiles_update on public.profiles for update using (id = auth.uid() or public.is_admin_or_perm('users','edit')) with check (id = auth.uid() or public.is_admin_or_perm('users','edit'));

-- 3. admins (user_id, email) : n'importe qui pouvait s'y INSÉRER. Table non utilisée par le code
--    (les droits sont dans user_metadata) → admin seulement.
drop policy if exists "Lecture admins" on public.admins;
drop policy if exists "Insert admins"  on public.admins;
drop policy if exists "Delete admins"  on public.admins;
create policy admins_admin on public.admins for all using (public.is_admin_or_perm('users','edit')) with check (public.is_admin_or_perm('users','edit'));

-- 4. producer_accounts : table héritée, non utilisée par le code → admin seulement.
drop policy if exists "Lecture admin producer_accounts" on public.producer_accounts;
drop policy if exists "Lecture producer_accounts"       on public.producer_accounts;
drop policy if exists "Insert producer_accounts"        on public.producer_accounts;
drop policy if exists "Update admin producer_accounts"  on public.producer_accounts;
drop policy if exists "Update producer_accounts"        on public.producer_accounts;
create policy producer_accounts_admin on public.producer_accounts for all using (public.is_admin_or_perm('merchants','edit')) with check (public.is_admin_or_perm('merchants','edit'));

-- 5. order_tracking : non utilisée (0 ligne) → admin seulement.
drop policy if exists "Lecture suivi commande" on public.order_tracking;
drop policy if exists "Insert suivi commande"  on public.order_tracking;
create policy order_tracking_admin on public.order_tracking for all using (public.is_admin_or_perm('orders','view')) with check (public.is_admin_or_perm('orders','edit'));

-- 6. Traductions catégories / promos / producteurs : lecture publique conservée, écriture admin.
--    (product_translations avait déjà été durci en Phase 0.)
drop policy if exists "Insert category_translations" on public.category_translations;
drop policy if exists "Update category_translations" on public.category_translations;
drop policy if exists "Delete category_translations" on public.category_translations;
create policy ct_write on public.category_translations for all using (public.is_admin_or_perm('categories','edit')) with check (public.is_admin_or_perm('categories','edit'));

drop policy if exists "Insert promo_translations" on public.promo_translations;
drop policy if exists "Update promo_translations" on public.promo_translations;
drop policy if exists "Delete promo_translations" on public.promo_translations;
create policy prt_write on public.promo_translations for all using (public.is_admin_or_perm('promos','edit')) with check (public.is_admin_or_perm('promos','edit'));

drop policy if exists "Insert producer_translations" on public.producer_translations;
drop policy if exists "Update producer_translations" on public.producer_translations;
drop policy if exists "Delete producer_translations" on public.producer_translations;
create policy pdt_write on public.producer_translations for all using (public.is_admin_or_perm('producers','edit')) with check (public.is_admin_or_perm('producers','edit'));

-- 7. orders : l'insertion passe par /api/orders (service role) → plus d'insertion directe.
drop policy if exists "Insertion commandes" on public.orders;

-- =====================================================================
-- ROLLBACK (restaure les politiques ouvertes d'origine)
-- create policy "service role full access" on public.push_subscriptions for all using (true) with check (true);
-- drop policy if exists profiles_read on public.profiles; drop policy if exists profiles_update on public.profiles;
-- create policy "Lecture profiles" on public.profiles for select using (true);
-- create policy "Insert profiles" on public.profiles for insert with check (true);
-- create policy "Update profiles" on public.profiles for update using (true);
-- drop policy if exists admins_admin on public.admins;
-- create policy "Lecture admins" on public.admins for select using (true);
-- create policy "Insert admins" on public.admins for insert with check (true);
-- create policy "Delete admins" on public.admins for delete using (true);
-- drop policy if exists producer_accounts_admin on public.producer_accounts;
-- create policy "Lecture producer_accounts" on public.producer_accounts for select using (true);
-- create policy "Update producer_accounts" on public.producer_accounts for update using (true);
-- create policy "Insert producer_accounts" on public.producer_accounts for insert with check (true);
-- drop policy if exists order_tracking_admin on public.order_tracking;
-- create policy "Lecture suivi commande" on public.order_tracking for select using (true);
-- create policy "Insert suivi commande" on public.order_tracking for insert with check (true);
-- drop policy if exists ct_write on public.category_translations; drop policy if exists prt_write on public.promo_translations; drop policy if exists pdt_write on public.producer_translations;
-- (+ recréer les politiques Insert/Update/Delete `true` correspondantes)
-- create policy "Insertion commandes" on public.orders for insert with check (true);
-- =====================================================================
