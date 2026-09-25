-- =====================================================================
-- PHASE 5 — Photos multiples par produit (25/09/2026)
-- products.images : tableau ordonné d'URL (jsonb). image_url reste la photo principale (= images[0])
-- pour toutes les cartes, snapshots de commande et e-mails existants. Reprise : images = [image_url].
-- Modération marchand : un changement de photos (images) est sensible, comme image_url.
-- Point de retour : sauvegarde 2026-09-25-avant-photos-multiples.
-- =====================================================================
alter table public.products add column if not exists images jsonb not null default '[]'::jsonb;
update public.products set images = jsonb_build_array(image_url)
 where image_url is not null and image_url <> '' and images = '[]'::jsonb;

create or replace function public.products_moderation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_admin boolean;
begin
  if new.owner_id is null then return new; end if;
  v_admin := auth.role() = 'service_role'
          or coalesce(auth.jwt(), '{}'::jsonb) = '{}'::jsonb
          or public.is_admin_or_perm('products','edit');
  if v_admin then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'pending_review'; new.review_note := null; new.reviewed_at := null;
  else
    new.owner_id := old.owner_id;
    if new.name        is distinct from old.name        or new.price    is distinct from old.price
    or new.description is distinct from old.description or new.image_url is distinct from old.image_url
    or new.images      is distinct from old.images
    or new.category    is distinct from old.category    or new.unit     is distinct from old.unit then
      new.status := 'pending_review'; new.review_note := null; new.reviewed_at := null;
    elsif new.status = 'published' and old.status is distinct from 'published' then
      new.status := old.status;
    end if;
  end if;
  return new;
end $$;

-- ROLLBACK
-- (restaurer la fonction products_moderation de scripts/phase1_merchant_subscriptions.sql)
-- alter table public.products drop column if exists images;
