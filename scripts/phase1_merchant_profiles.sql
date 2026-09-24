-- =====================================================================
-- PHASE 1 ③-A bis — Enseigne du marchand (merchant_profiles)
-- Source unique du nom de boutique affiché sur les cartes produits (« 🏪 Boutique Zak »),
-- dans l'espace marchand et le module admin. Géré par l'admin (l'enseigne est validée
-- comme le reste de la fiche) ; renseigné automatiquement à l'acceptation d'une adhésion.
-- Point de retour : sauvegarde 2026-09-24-avant-enseignes.
-- =====================================================================

create table if not exists public.merchant_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  shop_name  text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.merchant_profiles enable row level security;
drop policy if exists mprof_read  on public.merchant_profiles;
drop policy if exists mprof_write on public.merchant_profiles;
-- Lecture publique : l'enseigne est une information d'affichage (pas de donnée sensible dans la table)
create policy mprof_read  on public.merchant_profiles for select using (true);
create policy mprof_write on public.merchant_profiles for all
  using (public.is_admin_or_perm('merchants','edit')) with check (public.is_admin_or_perm('merchants','edit'));

-- Reprise : chaque compte marchand existant reçoit une enseigne
-- (adhésion approuvée → nom de ferme ; sinon « Boutique <prénom> »)
insert into public.merchant_profiles (user_id, shop_name)
select u.id,
       coalesce(
         (select r.farm_name from public.producer_requests r
           where lower(r.email) = lower(u.email) and r.status = 'approved' and r.farm_name <> '' limit 1),
         'Boutique ' || coalesce(nullif(u.raw_user_meta_data->>'full_name',''), split_part(u.email,'@',1)))
from auth.users u
where u.raw_user_meta_data->>'role' = 'producer'
on conflict (user_id) do nothing;

-- Les fiches marchandes existantes portent l'enseigne dans `farm` (instantané cohérent)
update public.products p set farm = m.shop_name
from public.merchant_profiles m
where p.owner_id = m.user_id and p.farm is distinct from m.shop_name;

-- ── Textes d'interface (fr = valeur par défaut dans le code) ─────────────
insert into public.ui_translations (key, language_code, value)
select v.key, v.lang, v.value from (values
  ('product.sold_by','en','Sold by'),
  ('product.sold_by','zh','销售商'),
  ('product.sold_by','am','ሻጭ'),
  ('product.sold_by','so','Iibiyaha'),
  ('product.sold_by','aa','Iibiyaha'),
  ('producer.edit_warning','en',E'You are changing the name, price, description, photo, category or unit of a published product.\n\nIt will go back to "Pending review" by Hornafresh and will be hidden from the site until approved.\n\nContinue?'),
  ('producer.edit_warning','zh',E'您正在修改已发布产品的名称、价格、描述、照片、类别或单位。\n\n该产品将重新进入 Hornafresh 审核，审核通过前将不再在网站上显示。\n\n继续吗？'),
  ('producer.edit_warning','am',E'የታተመ ምርት ስም፣ ዋጋ፣ መግለጫ፣ ፎቶ፣ ምድብ ወይም መለኪያ እየቀየሩ ነው።\n\nወደ «ለመፈተሽ» ይመለሳል እና እስኪጸድቅ ድረስ በድረ-ገጹ ላይ አይታይም።\n\nይቀጥሉ?'),
  ('producer.edit_warning','so',E'Waxaad beddelaysaa magaca, qiimaha, sharaxaada, sawirka, qaybta ama cutubka alaab la daabacay.\n\nWaxay ku noqon doontaa « La ansixiyo » Hornafresh, mana muuqan doonto bogga ilaa la ansixiyo.\n\nSii wad?'),
  ('producer.edit_warning','aa',E'Waxaad beddelaysaa magaca, qiimaha, sharaxaada, sawirka, qaybta ama cutubka alaab la daabacay.\n\nWaxay ku noqon doontaa « La ansixiyo » Hornafresh, mana muuqan doonto bogga ilaa la ansixiyo.\n\nSii wad?'),
  ('mer.shop_name','en','Shop name'),
  ('mer.shop_name','zh','店铺名称'),
  ('mer.shop_name','am','የሱቅ ስም'),
  ('mer.shop_name','so','Magaca dukaanka'),
  ('mer.shop_name','aa','Magaca dukaanka'),
  ('mer.shop_name_ph','en','e.g. Zak''s Shop'),
  ('mer.shop_name_ph','zh','例如：Zak 商店'),
  ('mer.shop_name_ph','am','ምሳሌ፦ የዛክ ሱቅ'),
  ('mer.shop_name_ph','so','Tusaale: Dukaanka Zak'),
  ('mer.shop_name_ph','aa','Tusaale: Dukaanka Zak')
) as v(key, lang, value)
where not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);

-- =====================================================================
-- ROLLBACK
-- delete from public.ui_translations where key in ('product.sold_by','producer.edit_warning','mer.shop_name','mer.shop_name_ph');
-- drop table if exists public.merchant_profiles;
-- (products.farm : restaurer depuis la sauvegarde si nécessaire)
-- =====================================================================
