-- =====================================================================
-- PHASE 11b — Paniers composés : garde-fou « un panier est un produit Hornafresh » (25/09/2026)
-- Incident : depuis l'ancien formulaire produit générique, un produit MARCHAND (owner_id non nul)
-- a pu être coché « panier composé ». Le reversement marchand (100 % du prix par product_id)
-- est incompatible avec un prix panier : on l'interdit au niveau de la base.
-- =====================================================================
alter table public.products drop constraint if exists products_bundle_hornafresh_only;
alter table public.products add constraint products_bundle_hornafresh_only
  check (not is_bundle or owner_id is null);

-- Le trigger de composition refuse aussi un conteneur marchand (ceinture + bretelles)
create or replace function public.bundle_items_check()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_comp record; v_bundle record;
begin
  select is_bundle, owner_id into v_comp   from public.products where id = new.product_id;
  select is_bundle, owner_id into v_bundle from public.products where id = new.bundle_id;
  if v_bundle is null or not v_bundle.is_bundle then raise exception 'bundle_not_bundle'; end if;
  if v_bundle.owner_id is not null then raise exception 'bundle_is_merchant_product'; end if;
  if v_comp is null then raise exception 'component_not_found'; end if;
  if v_comp.is_bundle then raise exception 'component_is_bundle'; end if;
  if v_comp.owner_id is not null then raise exception 'component_is_merchant_product'; end if;
  if new.bundle_id = new.product_id then raise exception 'component_is_self'; end if;
  return new;
end $$;

-- ROLLBACK
-- alter table public.products drop constraint if exists products_bundle_hornafresh_only;
