-- Phase 40 : frais de livraison modifiables sur une commande (admin/gestionnaire), avec les mêmes
-- garde-fous que les quantités. Le journal order_edits accueille un type d'écriture « delivery_fee »
-- (from_qty/to_qty = ancien/nouveau montant). Migration additive.
alter table public.order_edits add column if not exists kind text not null default 'quantity';
alter table public.order_edits drop constraint if exists order_edits_kind_check;
alter table public.order_edits add constraint order_edits_kind_check check (kind in ('quantity', 'delivery_fee'));
