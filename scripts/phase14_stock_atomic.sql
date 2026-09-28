-- =====================================================================
-- PHASE 14 — Stock atomique (28/09/2026)
-- Avant : l'app lisait le stock puis écrivait la nouvelle valeur (deux requêtes). Deux commandes
-- simultanées sur le dernier article pouvaient passer toutes les deux (survente).
-- Maintenant : stock_apply() fait tout dans UNE transaction, lignes verrouillées (FOR UPDATE) :
--   • agrège les variations par produit, étend les paniers composés à leurs composants ;
--   • mode strict (réservation d'une commande) : si un seul produit manque, RIEN n'est modifié
--     et la liste des manques est renvoyée ;
--   • mode normal (remise en stock, abonnement) : le stock ne descend jamais sous 0.
-- Appelée uniquement par le serveur (service role). Point de retour : sauvegarde avant-stock-atomique.
-- =====================================================================
create or replace function public.stock_apply(p_lines jsonb, p_strict boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_changes jsonb := '[]'::jsonb;
  v_short   jsonb := '[]'::jsonb;
begin
  for r in
    with l as (
      select (x->>'product_id')::bigint as product_id, (x->>'delta')::numeric as delta
      from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) x
    ),
    expanded as (
      select product_id, delta from l
      union all
      select bi.product_id, l.delta * bi.quantity
      from l
      join public.products b on b.id = l.product_id and b.is_bundle
      join public.bundle_items bi on bi.bundle_id = b.id
    ),
    agg as (
      select product_id, sum(delta) as delta from expanded group by product_id having sum(delta) <> 0
    )
    select p.id, p.name, p.unit, p.owner_id, coalesce(p.stock_qty, 0) as stock_before, a.delta
    from agg a join public.products p on p.id = a.product_id
    order by p.id
    for update of p
  loop
    if p_strict and r.delta < 0 and r.stock_before + r.delta < 0 then
      v_short := v_short || jsonb_build_object('product_id', r.id, 'name', r.name, 'unit', r.unit,
                                               'available', r.stock_before, 'requested', -r.delta);
    end if;
    v_changes := v_changes || jsonb_build_object('product_id', r.id, 'name', r.name, 'unit', r.unit, 'owner_id', r.owner_id,
                                                 'before', r.stock_before, 'after', greatest(0, r.stock_before + r.delta));
  end loop;

  if jsonb_array_length(v_short) > 0 then
    return jsonb_build_object('ok', false, 'short', v_short, 'changes', '[]'::jsonb);
  end if;

  update public.products p
     set stock_qty = (c->>'after')::numeric
    from jsonb_array_elements(v_changes) c
   where p.id = (c->>'product_id')::bigint;

  return jsonb_build_object('ok', true, 'short', '[]'::jsonb, 'changes', v_changes);
end $$;

revoke all on function public.stock_apply(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.stock_apply(jsonb, boolean) to service_role;

-- ROLLBACK
-- drop function if exists public.stock_apply(jsonb, boolean);
