-- =====================================================================
-- Phase 3b — Durcissement RLS des tables "catalogue" écrites en direct.
-- Objectif : seuls admin / gestionnaire (selon droits) — et un producteur
-- sur SES produits — peuvent écrire. La lecture publique reste ouverte.
--
-- À exécuter dans Supabase Dashboard → SQL Editor.
-- ⚠️ TESTER IMMÉDIATEMENT APRÈS (voir bas du fichier). En cas de souci,
--    exécuter la section ROLLBACK pour rétablir l'état précédent.
-- =====================================================================

-- ── Fonctions d'aide (SECURITY DEFINER pour éviter toute récursion RLS) ──

-- admin (role='admin' ou is_admin) ; ou gestionnaire ayant le droit demandé.
create or replace function public.is_admin_or_perm(p_module text, p_action text)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin' then true
    when coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false) then true
    when coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'manager'
      then coalesce((auth.jwt() #> array['user_metadata','permissions',p_module]) ? p_action, false)
    else false
  end;
$$;

-- Le producteur connecté possède-t-il la ferme `p_farm` (demande approuvée) ?
create or replace function public.owns_farm(p_farm text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from producer_requests pr
    where pr.email = (auth.jwt() ->> 'email')
      and pr.status = 'approved'
      and pr.farm_name = p_farm
  );
$$;

-- ── PRODUCTS : lecture publique (publiés) + admin/gestionnaire + producteur ──
alter table products enable row level security;

drop policy if exists products_read   on products;
drop policy if exists products_insert  on products;
drop policy if exists products_update  on products;
drop policy if exists products_delete  on products;

create policy products_read on products for select using (
  status = 'published' or public.is_admin_or_perm('products','view') or public.owns_farm(farm)
);
create policy products_insert on products for insert with check (
  public.is_admin_or_perm('products','create') or public.owns_farm(farm)
);
create policy products_update on products for update
  using      (public.is_admin_or_perm('products','edit') or public.owns_farm(farm))
  with check (public.is_admin_or_perm('products','edit') or public.owns_farm(farm));
create policy products_delete on products for delete using (
  public.is_admin_or_perm('products','delete') or public.owns_farm(farm)
);

-- ── PRODUCT_TRANSLATIONS : lecture publique + écritures gérées avec les produits ──
alter table product_translations enable row level security;
drop policy if exists pt_read on product_translations;
drop policy if exists pt_write on product_translations;
create policy pt_read on product_translations for select using (true);
create policy pt_write on product_translations for all
  using      (public.is_admin_or_perm('products','edit') or public.is_admin_or_perm('products','create') or public.is_admin_or_perm('products','delete'))
  with check (public.is_admin_or_perm('products','edit') or public.is_admin_or_perm('products','create') or public.is_admin_or_perm('products','delete'));

-- ── CATEGORIES ──
alter table categories enable row level security;
drop policy if exists categories_read on categories;
drop policy if exists categories_write on categories;
create policy categories_read on categories for select using (true);
create policy categories_write on categories for all
  using      (public.is_admin_or_perm('categories','edit') or public.is_admin_or_perm('categories','create') or public.is_admin_or_perm('categories','delete'))
  with check (public.is_admin_or_perm('categories','edit') or public.is_admin_or_perm('categories','create') or public.is_admin_or_perm('categories','delete'));

-- ── PROMOS ──
alter table promos enable row level security;
drop policy if exists promos_read on promos;
drop policy if exists promos_write on promos;
create policy promos_read on promos for select using (true);
create policy promos_write on promos for all
  using      (public.is_admin_or_perm('promos','edit') or public.is_admin_or_perm('promos','create') or public.is_admin_or_perm('promos','delete'))
  with check (public.is_admin_or_perm('promos','edit') or public.is_admin_or_perm('promos','create') or public.is_admin_or_perm('promos','delete'));

-- ── PRODUCERS ──
alter table producers enable row level security;
drop policy if exists producers_read on producers;
drop policy if exists producers_write on producers;
create policy producers_read on producers for select using (true);
create policy producers_write on producers for all
  using      (public.is_admin_or_perm('producers','edit') or public.is_admin_or_perm('producers','create') or public.is_admin_or_perm('producers','delete'))
  with check (public.is_admin_or_perm('producers','edit') or public.is_admin_or_perm('producers','create') or public.is_admin_or_perm('producers','delete'));

-- ── DELIVERY_OPTIONS ──
alter table delivery_options enable row level security;
drop policy if exists delivery_read on delivery_options;
drop policy if exists delivery_write on delivery_options;
create policy delivery_read on delivery_options for select using (true);
create policy delivery_write on delivery_options for all
  using      (public.is_admin_or_perm('delivery','edit') or public.is_admin_or_perm('delivery','create') or public.is_admin_or_perm('delivery','delete'))
  with check (public.is_admin_or_perm('delivery','edit') or public.is_admin_or_perm('delivery','create') or public.is_admin_or_perm('delivery','delete'));

-- =====================================================================
-- ROLLBACK (en cas de problème) — désactive la RLS pour rétablir l'accès :
-- alter table products            disable row level security;
-- alter table product_translations disable row level security;
-- alter table categories          disable row level security;
-- alter table promos              disable row level security;
-- alter table producers           disable row level security;
-- alter table delivery_options    disable row level security;
-- =====================================================================
