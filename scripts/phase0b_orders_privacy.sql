-- =====================================================================
-- PHASE 0-b — Confidentialité des commandes (25/09/2026)
-- Constat : la politique « Lecture commandes » de public.orders était `using (true)` :
-- n'importe qui (même anonyme) pouvait lire noms, téléphones, adresses et e-mails.
-- Règle : lecture réservée à l'admin / gestionnaire (droit orders:view) et au client
-- propriétaire (user_id = auth.uid()). Les commandes invités (user_id null) restent
-- accessibles uniquement via les API service role (/api/orders/mine, admin).
-- Aucun client ne lit `orders` directement (le profil passe par /api/orders/mine) ;
-- les composants admin lisent avec la session admin → is_admin_or_perm.
-- =====================================================================

drop policy if exists "Lecture commandes" on public.orders;
create policy orders_read on public.orders for select using (
  public.is_admin_or_perm('orders', 'view')
  or (auth.uid() is not null and user_id = auth.uid())
);

-- order_items : RLS actif sans politique de lecture (= aucun accès client) — inchangé, c'est voulu.

-- ROLLBACK
-- drop policy if exists orders_read on public.orders;
-- create policy "Lecture commandes" on public.orders for select using (true);
