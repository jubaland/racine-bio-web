-- =====================================================================
-- PHASE 22 — Traductions des produits marchands (28/09/2026)
-- Les traductions sont saisies par l'admin (admin › Produits, et Marchands › À traiter) ; à la
-- validation, les langues vides reprennent le nom d'un produit homonyme du catalogue.
-- Garde-fou : si un marchand renomme son produit ou change sa description, les anciennes
-- traductions ne correspondent plus → nom renommé = traductions supprimées, description modifiée =
-- descriptions traduites vidées. Le produit repasse de toute façon en validation (trigger existant).
-- Les produits Hornafresh ne sont pas concernés (une correction d'orthographe ne doit rien effacer).
-- Sauvegarde : avant-langue-client.
-- =====================================================================
create or replace function public.products_translations_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is null then return new; end if;
  if lower(btrim(coalesce(new.name, ''))) is distinct from lower(btrim(coalesce(old.name, ''))) then
    delete from product_translations where product_id = new.id;
  elsif btrim(coalesce(new.description, '')) is distinct from btrim(coalesce(old.description, '')) then
    update product_translations set description = '' where product_id = new.id and coalesce(description, '') <> '';
  end if;
  return new;
end $$;
drop trigger if exists products_translations_guard on public.products;
create trigger products_translations_guard after update of name, description on public.products
  for each row execute function public.products_translations_guard();

-- ROLLBACK
-- drop trigger if exists products_translations_guard on public.products;
-- drop function if exists public.products_translations_guard();
