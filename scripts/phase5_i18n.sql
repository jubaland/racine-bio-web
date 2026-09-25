-- PHASE 5 — photos multiples : textes (fr = valeur par défaut dans le code)
insert into public.ui_translations (key, language_code, value)
select v.key, v.lang, v.value from (values
 ('admin.field_images','en','Photos'),('admin.field_images','zh','照片'),('admin.field_images','am','ፎቶዎች'),('admin.field_images','so','Sawirro'),('admin.field_images','aa','Sawirro'),
 ('img.cover','en','Main'),('img.cover','zh','主图'),('img.cover','am','ዋና'),('img.cover','so','Ugu weyn'),('img.cover','aa','Ugu weyn'),
 ('img.set_cover','en','Set as main photo'),('img.set_cover','zh','设为主图'),('img.set_cover','am','እንደ ዋና ፎቶ አዘጋጅ'),('img.set_cover','so','Ka dhig sawirka ugu weyn'),('img.set_cover','aa','Ka dhig sawirka ugu weyn'),
 ('img.left','en','Move forward'),('img.left','zh','前移'),('img.left','am','ወደ ፊት አንቀሳቅስ'),('img.left','so','Hore u dhaqaaji'),('img.left','aa','Hore u dhaqaaji'),
 ('img.right','en','Move back'),('img.right','zh','后移'),('img.right','am','ወደ ኋላ አንቀሳቅስ'),('img.right','so','Dib u dhaqaaji'),('img.right','aa','Dib u dhaqaaji'),
 ('img.remove','en','Remove'),('img.remove','zh','移除'),('img.remove','am','አስወግድ'),('img.remove','so','Ka saar'),('img.remove','aa','Ka saar'),
 ('img.add','en','Add photos'),('img.add','zh','添加照片'),('img.add','am','ፎቶዎችን ጨምር'),('img.add','so','Ku dar sawirro'),('img.add','aa','Ku dar sawirro'),
 ('img.max','en','Maximum'),('img.max','zh','最多'),('img.max','am','ከፍተኛ'),('img.max','so','Ugu badnaan'),('img.max','aa','Ugu badnaan'),
 ('img.photos','en','photos'),('img.photos','zh','张照片'),('img.photos','am','ፎቶዎች'),('img.photos','so','sawirro'),('img.photos','aa','sawirro'),
 ('img.too_big','en','file too large (8 MB max)'),('img.too_big','zh','文件过大（最大 8 MB）'),('img.too_big','am','ፋይል በጣም ትልቅ ነው (ከፍተኛ 8 ሜባ)'),('img.too_big','so','fayl aad u weyn (8 MB ugu badnaan)'),('img.too_big','aa','fayl aad u weyn (8 MB ugu badnaan)'),
 ('img.url_ph','en','or paste a URL https://… then Enter'),('img.url_ph','zh','或粘贴 URL https://… 然后按回车'),('img.url_ph','am','ወይም URL https://… ይለጥፉ ከዚያ Enter'),('img.url_ph','so','ama dheji URL https://… ka dibna Enter'),('img.url_ph','aa','ama dheji URL https://… ka dibna Enter'),
 ('img.hint','en','The first photo is the one shown on cards and orders. Square format recommended, 5 photos maximum.'),('img.hint','zh','第一张照片用于卡片和订单。建议方形，最多 5 张。'),('img.hint','am','የመጀመሪያው ፎቶ በካርዶች እና ትዕዛዞች ላይ የሚታየው ነው። ካሬ ቅርጽ ይመከራል፣ ከፍተኛ 5 ፎቶዎች።'),('img.hint','so','Sawirka koowaad ayaa ka muuqda kaadhadhka iyo dalabyada. Qaab afargees ayaa lagula talinayaa, 5 sawir ugu badnaan.'),('img.hint','aa','Sawirka koowaad ayaa ka muuqda kaadhadhka iyo dalabyada. Qaab afargees ayaa lagula talinayaa, 5 sawir ugu badnaan.')
) as v(key, lang, value)
where not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);
select count(*) from public.ui_translations where key like 'img.%' or key = 'admin.field_images';
