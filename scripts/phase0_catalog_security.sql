-- =====================================================================
-- PHASE 0 — Sécurité du catalogue (préalable au chantier Marchands)
-- Remplace scripts/harden_catalog_rls.sql (rattachement par nom de ferme abandonné).
--
-- 1) products.owner_id : compte propriétaire du produit (NULL = produit Hornafresh)
-- 2) RLS sur products, product_translations, categories, promos, producers,
--    delivery_options, producer_requests + bucket product-images
-- 3) Suppression DYNAMIQUE des anciennes policies (une policy using(true) oubliée
--    garderait la porte ouverte : les policies sont cumulatives en OR)
--
-- À exécuter dans Supabase Dashboard → SQL Editor, puis TESTER (voir bas de page).
-- Point de retour : sauvegarde du 22/09/2026 + section ROLLBACK ci-dessous.
-- =====================================================================

-- ── 1) Propriétaire du produit ───────────────────────────────────────────
alter table public.products
  add column if not exists owner_id uuid references auth.users(id) on delete set null;
create index if not exists products_owner_idx on public.products (owner_id);
comment on column public.products.owner_id is 'Compte propriétaire (marchand/producteur). NULL = produit Hornafresh.';

-- ── Fonctions d'aide (SECURITY DEFINER : pas de récursion RLS) ───────────
-- Admin (role='admin' ou is_admin) ou gestionnaire ayant le droit p_module/p_action.
create or replace function public.is_admin_or_perm(p_module text, p_action text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin' then true
    when coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false) then true
    when coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'manager'
      then coalesce((auth.jwt() #> array['user_metadata','permissions',p_module]) ? p_action, false)
    else false
  end;
$$;

-- L'utilisateur connecté est-il le propriétaire ?
create or replace function public.is_owner(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_owner is not null and p_owner = auth.uid();
$$;

-- Supprime toutes les policies existantes d'une table (nettoyage des règles permissives)
create or replace function public.drop_all_policies(p_schema text, p_table text)
returns void language plpgsql security definer as $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = p_schema and tablename = p_table loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, p_schema, p_table);
  end loop;
end $$;

-- ── 2) PRODUCTS ──────────────────────────────────────────────────────────
select public.drop_all_policies('public','products');
alter table public.products enable row level security;
create policy products_read on public.products for select using (
  status = 'published' or public.is_admin_or_perm('products','view') or public.is_owner(owner_id)
);
create policy products_insert on public.products for insert with check (
  public.is_admin_or_perm('products','create') or public.is_owner(owner_id)
);
create policy products_update on public.products for update
  using      (public.is_admin_or_perm('products','edit') or public.is_owner(owner_id))
  with check (public.is_admin_or_perm('products','edit') or public.is_owner(owner_id));
create policy products_delete on public.products for delete using (
  public.is_admin_or_perm('products','delete') or public.is_owner(owner_id)
);

-- ── PRODUCT_TRANSLATIONS : lecture publique ; écriture admin/gestionnaire ─
select public.drop_all_policies('public','product_translations');
alter table public.product_translations enable row level security;
create policy pt_read  on public.product_translations for select using (true);
create policy pt_write on public.product_translations for all
  using      (public.is_admin_or_perm('products','edit') or public.is_admin_or_perm('products','create') or public.is_admin_or_perm('products','delete'))
  with check (public.is_admin_or_perm('products','edit') or public.is_admin_or_perm('products','create') or public.is_admin_or_perm('products','delete'));

-- ── CATEGORIES / PROMOS / PRODUCERS / DELIVERY_OPTIONS : lecture publique, écriture par droit ─
select public.drop_all_policies('public','categories');
alter table public.categories enable row level security;
create policy categories_read  on public.categories for select using (true);
create policy categories_write on public.categories for all
  using      (public.is_admin_or_perm('categories','edit') or public.is_admin_or_perm('categories','create') or public.is_admin_or_perm('categories','delete'))
  with check (public.is_admin_or_perm('categories','edit') or public.is_admin_or_perm('categories','create') or public.is_admin_or_perm('categories','delete'));

select public.drop_all_policies('public','promos');
alter table public.promos enable row level security;
create policy promos_read  on public.promos for select using (true);
create policy promos_write on public.promos for all
  using      (public.is_admin_or_perm('promos','edit') or public.is_admin_or_perm('promos','create') or public.is_admin_or_perm('promos','delete'))
  with check (public.is_admin_or_perm('promos','edit') or public.is_admin_or_perm('promos','create') or public.is_admin_or_perm('promos','delete'));

select public.drop_all_policies('public','producers');
alter table public.producers enable row level security;
create policy producers_read  on public.producers for select using (true);
create policy producers_write on public.producers for all
  using      (public.is_admin_or_perm('producers','edit') or public.is_admin_or_perm('producers','create') or public.is_admin_or_perm('producers','delete'))
  with check (public.is_admin_or_perm('producers','edit') or public.is_admin_or_perm('producers','create') or public.is_admin_or_perm('producers','delete'));

select public.drop_all_policies('public','delivery_options');
alter table public.delivery_options enable row level security;
create policy delivery_read  on public.delivery_options for select using (true);
create policy delivery_write on public.delivery_options for all
  using      (public.is_admin_or_perm('delivery','edit') or public.is_admin_or_perm('delivery','create') or public.is_admin_or_perm('delivery','delete'))
  with check (public.is_admin_or_perm('delivery','edit') or public.is_admin_or_perm('delivery','create') or public.is_admin_or_perm('delivery','delete'));

-- ── PRODUCER_REQUESTS : plus d'auto-approbation ──────────────────────────
-- lire : sa propre demande (par email) ou admin/gestionnaire ; créer : sa propre demande ;
-- modifier (approuver/refuser) : admin/gestionnaire uniquement.
select public.drop_all_policies('public','producer_requests');
alter table public.producer_requests enable row level security;
create policy pr_read on public.producer_requests for select using (
  email = (auth.jwt() ->> 'email') or public.is_admin_or_perm('requests','view')
);
create policy pr_insert on public.producer_requests for insert with check (
  email = (auth.jwt() ->> 'email')
);
create policy pr_update on public.producer_requests for update
  using (public.is_admin_or_perm('requests','edit')) with check (public.is_admin_or_perm('requests','edit'));
create policy pr_delete on public.producer_requests for delete using (public.is_admin_or_perm('requests','edit'));

-- ── BUCKET product-images : lecture publique ; écriture réservée aux comptes connectés ─
-- Policies héritées de la mise en place initiale (upload anonyme autorisé !) → supprimées
drop policy if exists "Upload images"  on storage.objects;
drop policy if exists "Lecture images" on storage.objects;
drop policy if exists "product-images public read"   on storage.objects;
drop policy if exists "product-images auth insert"   on storage.objects;
drop policy if exists "product-images auth update"   on storage.objects;
drop policy if exists "product-images auth delete"   on storage.objects;
create policy "product-images public read" on storage.objects for select
  using (bucket_id = 'product-images');
create policy "product-images auth insert" on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');
create policy "product-images auth update" on storage.objects for update
  using (bucket_id = 'product-images' and auth.role() = 'authenticated');
create policy "product-images auth delete" on storage.objects for delete
  using (bucket_id = 'product-images' and auth.role() = 'authenticated');

-- =====================================================================
-- TESTS (l'agent les exécute après application) :
--  - anonyme : SELECT produits publiés OK ; UPDATE produit → 0 ligne modifiée
--  - anonyme : UPDATE producer_requests / categories → 0 ligne
--  - admin (site) : Admin → Produits : créer/modifier/supprimer OK ; images OK
-- =====================================================================
-- ROLLBACK (rétablit l'accès ouvert ; la colonne owner_id peut rester) :
-- alter table public.products             disable row level security;
-- alter table public.product_translations disable row level security;
-- alter table public.categories           disable row level security;
-- alter table public.promos               disable row level security;
-- alter table public.producers            disable row level security;
-- alter table public.delivery_options     disable row level security;
-- alter table public.producer_requests    disable row level security;
-- (storage) drop policy "product-images auth insert" on storage.objects; -- etc.
-- =====================================================================
