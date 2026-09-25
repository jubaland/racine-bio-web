-- =====================================================================
-- Nettoyage des données de la campagne de tests du 25/09/2026 (compte Zak + admin)
-- Produits de test 35/36/37, commandes 121 et 123 et tout ce qui en découle,
-- renouvellement d'abonnement fictif (ligne 15). Remet le stock d'Orange de Somali-Land.
-- Les améliorations issues des tests (merchant_profiles, unités normalisées, RLS) sont conservées.
-- =====================================================================
begin;

-- Commandes de test et dépendances
delete from public.order_refunds          where order_id in (121, 123);
delete from public.order_change_requests  where order_id in (121, 123);
delete from public.order_cancel_requests  where order_id in (121, 123);
delete from public.order_items            where order_id in (121, 123);
delete from public.orders                 where id in (121, 123);

-- Likes et produits de test du marchand
delete from public.product_likes where product_id in (35, 36, 37);
delete from public.product_translations where product_id in (35, 36, 37);
delete from public.products where id in (35, 36, 37) and owner_id = '62f9913f-7356-49fd-ae88-048b6dc41883';

-- Renouvellement fictif de l'abonnement de Zak (période 24/10 → 22/11)
delete from public.merchant_subscriptions where id = 15 and payment_reference = 'WF-TEST-20260925-001';

-- Stock : Orange de Somali-Land (id 15) — 1 kg vendu par la commande 121 de test
update public.products set stock_qty = stock_qty + 1 where id = 15;

-- Notifications générées par les tests (client wil, marchand Zak, admin)
delete from public.user_notifications where user_id in ('a5db3fa6-dc67-4ecb-b1ac-a6d5195d5b4f','62f9913f-7356-49fd-ae88-048b6dc41883')
  and created_at >= '2026-09-25T02:30:00Z' and (title like '%#121%' or title like '%#123%' or title like '%(test)%' or title like '%Paiement déclaré%' or title like '%Abonnement activé%' or title like '%Commande confirmée%' or title like '%Remboursement%');
delete from public.admin_notifications where created_at >= '2026-09-25T02:30:00Z' and (body like '%#121%' or body like '%#123%' or body like '%WF-TEST%');

commit;

select (select count(*) from public.products where id in (35,36,37)) as prods_left,
       (select count(*) from public.orders where id in (121,123)) as orders_left,
       (select count(*) from public.merchant_subscriptions where id = 15) as sub15_left,
       (select stock_qty from public.products where id = 15) as stock_orange;
