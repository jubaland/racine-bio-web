-- =====================================================================
-- PHASE 11 — Paniers composés : thématiques et anti-gaspi (25/09/2026)
-- Un panier est un produit Hornafresh (owner_id null) à part entière : il passe par le panier
-- client, les favoris, les promotions, la commande et les finances sans cas particulier.
-- Sa composition vit dans bundle_items ; son stock effectif = min(stock du panier, stock des
-- composants / quantité) et il est calculé à la lecture (site) et à la commande (API).
-- À la commande : une seule ligne order_items (le panier), le stock des composants est
-- décrémenté ; la composition est photographiée dans order_items.bundle_contents pour les
-- préparateurs. Le coût snapshot = somme des coûts des composants (marge Finances correcte).
-- Point de retour : sauvegarde avant-paniers.
-- =====================================================================

-- ── Produits : marqueurs panier ───────────────────────────────────────
alter table public.products add column if not exists is_bundle      boolean not null default false;
alter table public.products add column if not exists bundle_kind    text check (bundle_kind in ('theme','rescue')); -- thématique | anti-gaspi
alter table public.products add column if not exists bundle_ends_at timestamptz;                                   -- fin de validité (anti-gaspi)
create index if not exists products_bundle_idx on public.products (is_bundle) where is_bundle;

-- ── Composition ───────────────────────────────────────────────────────
create table if not exists public.bundle_items (
  id         bigint generated always as identity primary key,
  bundle_id  bigint  not null references public.products(id) on delete cascade,
  product_id bigint  not null references public.products(id) on delete restrict,
  quantity   numeric not null check (quantity > 0),
  sort_order int     not null default 0,
  unique (bundle_id, product_id)
);
create index if not exists bundle_items_product_idx on public.bundle_items (product_id);

alter table public.bundle_items enable row level security;
drop policy if exists bi_read  on public.bundle_items;
drop policy if exists bi_write on public.bundle_items;
create policy bi_read  on public.bundle_items for select using (true);   -- le site calcule la disponibilité
create policy bi_write on public.bundle_items for all
  using (public.is_admin_or_perm('products','edit')) with check (public.is_admin_or_perm('products','edit'));

-- Règles : un composant est un produit Hornafresh (pas de produit marchand : le reversement
-- marchand se fait à 100 % du prix par product_id, incompatible avec un prix panier) et n'est
-- pas lui-même un panier ; le conteneur est bien un panier.
create or replace function public.bundle_items_check()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_comp record; v_bundle record;
begin
  select is_bundle, owner_id into v_comp   from public.products where id = new.product_id;
  select is_bundle, owner_id into v_bundle from public.products where id = new.bundle_id;
  if v_bundle is null or not v_bundle.is_bundle then raise exception 'bundle_not_bundle'; end if;
  if v_comp is null then raise exception 'component_not_found'; end if;
  if v_comp.is_bundle then raise exception 'component_is_bundle'; end if;
  if v_comp.owner_id is not null then raise exception 'component_is_merchant_product'; end if;
  if new.bundle_id = new.product_id then raise exception 'component_is_self'; end if;
  return new;
end $$;
drop trigger if exists bundle_items_check_trg on public.bundle_items;
create trigger bundle_items_check_trg before insert or update on public.bundle_items
  for each row execute function public.bundle_items_check();

-- ── Commandes : photo de la composition (préparateurs, historique) ────
alter table public.order_items add column if not exists bundle_contents jsonb; -- [{product_id,name,unit,quantity}] par panier

-- ── Accueil : bloc « Paniers » (visible par défaut) ───────────────────
insert into public.site_settings (key, value) select 'home.bundles', true
where not exists (select 1 from public.site_settings where key = 'home.bundles');

-- =====================================================================
-- ROLLBACK
-- drop trigger if exists bundle_items_check_trg on public.bundle_items;
-- drop function if exists public.bundle_items_check();
-- drop table if exists public.bundle_items;
-- alter table public.order_items drop column if exists bundle_contents;
-- alter table public.products drop column if exists bundle_ends_at, drop column if exists bundle_kind, drop column if exists is_bundle;
-- delete from public.site_settings where key = 'home.bundles';
