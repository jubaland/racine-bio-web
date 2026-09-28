-- =====================================================================
-- PHASE 20 — Traductions de la page d'accueil (28/09/2026)
-- 1. Bandeau d'annonce traduisible : announcements.translations = { en: { title, body }, … }
-- 2. Annonce active (#13) traduite
-- 3. Produit marchand #32 « Orange Egypte » : noms traduits (aucune traduction jusque-là)
-- 4. Bloc « Marchands partenaires » : traductions alignées sur le texte français actuel
-- 5. Nouvelles clés d'interface
-- L'afar (aa) reprend le somali en attendant la relecture native (langue masquée).
-- Sauvegarde : avant-traductions-accueil.
-- =====================================================================
alter table public.announcements add column if not exists translations jsonb;

update public.announcements set translations = jsonb_build_object(
  'en', jsonb_build_object('title', '🌿 Hornafresh is back — and so are the oranges from Somalia!',
                           'body',  'The break is over! Fresh, organic and local fruits and vegetables are available again, and our organic oranges from Somalia have just arrived 🍊 Thank you for your loyalty — order now, limited stock.'),
  'zh', jsonb_build_object('title', '🌿 Hornafresh 回来了 — 索马里橙子也到了！',
                           'body',  '休息结束！新鲜、有机、本地的水果和蔬菜重新上架，我们的索马里有机橙子刚刚到货 🍊 感谢您的支持 — 立即下单，数量有限。'),
  'am', jsonb_build_object('title', '🌿 Hornafresh ተመልሷል — የሶማሊያ ብርቱካንም እንዲሁ!',
                           'body',  'እረፍቱ አብቅቷል! ትኩስ፣ ኦርጋኒክ እና የአካባቢ ፍራፍሬዎችና አትክልቶች እንደገና ይገኛሉ፤ የሶማሊያ ኦርጋኒክ ብርቱካናችንም አሁን ደርሷል 🍊 ስለ ታማኝነትዎ እናመሰግናለን — አሁኑኑ ይዘዙ፣ ክምችቱ ውስን ነው።'),
  'so', jsonb_build_object('title', '🌿 Hornafresh waa soo noqotay — liinta Soomaaliyana sidoo kale!',
                           'body',  'Nasashadii way dhammaatay! Khudaar iyo miro cusub, dabiici ah oo maxalli ah ayaa mar kale la heli karaa, liinteena dabiiciga ah ee Soomaaliyana hadda ayay timid 🍊 Waad ku mahadsan tahay daacadnimadaada — hadda dalbo, tiradu way xaddidan tahay.'),
  'aa', jsonb_build_object('title', '🌿 Hornafresh waa soo noqotay — liinta Soomaaliyana sidoo kale!',
                           'body',  'Nasashadii way dhammaatay! Khudaar iyo miro cusub, dabiici ah oo maxalli ah ayaa mar kale la heli karaa, liinteena dabiiciga ah ee Soomaaliyana hadda ayay timid 🍊 Waad ku mahadsan tahay daacadnimadaada — hadda dalbo, tiradu way xaddidan tahay.')
) where id = 13 and translations is null;

-- Produit marchand #32 : mêmes noms que le produit Hornafresh #16 « Orange Egypte » (description vide)
insert into public.product_translations (product_id, language_code, name, description)
select 32, t.language_code, t.name, ''
from public.product_translations t
where t.product_id = 16
  and exists (select 1 from public.products p where p.id = 32)
  and not exists (select 1 from public.product_translations x where x.product_id = 32 and x.language_code = t.language_code);

-- Bloc « Marchands partenaires » : anciennes traductions (« Espace producteur… ») remplacées
update public.ui_translations u set value = v.value
from (values
 ('producerSpaceTag','en','Partner merchants'), ('producerSpaceTag','zh','合作商家'), ('producerSpaceTag','am','አጋር ነጋዴዎች'), ('producerSpaceTag','so','Ganacsatada la shaqaysa'), ('producerSpaceTag','aa','Ganacsatada la shaqaysa'),
 ('producerSpaceTitle','en','Do you grow or sell fresh produce?'), ('producerSpaceTitle','zh','您种植或销售生鲜产品吗？'), ('producerSpaceTitle','am','ትኩስ ምርት ያመርታሉ ወይም ይሸጣሉ?'), ('producerSpaceTitle','so','Ma beertaa mise waad iibisaa alaab cusub?'), ('producerSpaceTitle','aa','Ma beertaa mise waad iibisaa alaab cusub?'),
 ('producerSpaceTitle2','en','Sell on Hornafresh'), ('producerSpaceTitle2','zh','在 Hornafresh 上销售'), ('producerSpaceTitle2','am','በ Hornafresh ላይ ይሽጡ'), ('producerSpaceTitle2','so','Ku iibi Hornafresh'), ('producerSpaceTitle2','aa','Ku iibi Hornafresh'),
 ('producerSpaceCta','en','Become a merchant'), ('producerSpaceCta','zh','成为商家'), ('producerSpaceCta','am','ነጋዴ ይሁኑ'), ('producerSpaceCta','so','Noqo ganacsade'), ('producerSpaceCta','aa','Noqo ganacsade')
) as v(key, lang, value)
where u.key = v.key and u.language_code = v.lang;

-- Nouvelles clés
insert into public.ui_translations (key, language_code, value)
select v.key, v.lang, v.value from (values
 ('product.stock_low_short','en','Only'), ('product.stock_low_short','zh','仅剩'), ('product.stock_low_short','am','የቀረው'), ('product.stock_low_short','so','Waxaa hadhay'), ('product.stock_low_short','aa','Waxaa hadhay'),
 ('fav.add','en','Add to favorites'), ('fav.add','zh','加入收藏'), ('fav.add','am','ወደ ተወዳጆች አክል'), ('fav.add','so','Ku dar kuwa aad jeceshahay'), ('fav.add','aa','Ku dar kuwa aad jeceshahay'),
 ('admin.bc_tr_title','en','Banner translations (optional)'), ('admin.bc_tr_title','zh','横幅翻译（可选）'), ('admin.bc_tr_title','am','የማስታወቂያ ትርጉሞች (አማራጭ)'), ('admin.bc_tr_title','so','Tarjumaadaha ogeysiiska (ikhtiyaari)'), ('admin.bc_tr_title','aa','Tarjumaadaha ogeysiiska (ikhtiyaari)'),
 ('admin.bc_tr_hint','en','Without a translation, the banner is shown in French in that language. The notification is always sent in French.'),
 ('admin.bc_tr_hint','zh','如果没有翻译，该语言下横幅将以法语显示。通知始终以法语发送。'),
 ('admin.bc_tr_hint','am','ትርጉም ከሌለ በዚያ ቋንቋ ማስታወቂያው በፈረንሳይኛ ይታያል። ማሳወቂያው ሁልጊዜ በፈረንሳይኛ ይላካል።'),
 ('admin.bc_tr_hint','so','Tarjumaad la''aan, ogeysiisku wuxuu luqaddaas ugu muuqdaa Faransiis. Ogeysiiska riixitaanka had iyo jeer waxaa lagu diraa Faransiis.'),
 ('admin.bc_tr_hint','aa','Tarjumaad la''aan, ogeysiisku wuxuu luqaddaas ugu muuqdaa Faransiis. Ogeysiiska riixitaanka had iyo jeer waxaa lagu diraa Faransiis.')
) as v(key, lang, value)
where not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);

select (select count(*) from product_translations where product_id = 32) as p32,
       (select translations is not null from announcements where id = 13) as ann13;

-- ROLLBACK
-- alter table public.announcements drop column if exists translations;
-- delete from public.product_translations where product_id = 32;
-- delete from public.ui_translations where key in ('product.stock_low_short','fav.add','admin.bc_tr_title','admin.bc_tr_hint');
-- (anciennes valeurs de producerSpace* : sauvegarde avant-traductions-accueil)
update ui_translations a set value = s.value from ui_translations s where a.key='profile.tab_wallet' and a.language_code='aa' and s.key=a.key and s.language_code='so' returning a.value;
