-- PHASE 11d — Mosaïque des composants (fr = fallback dans le code)
insert into public.ui_translations (key, language_code, value)
select v.key, v.lang, v.value from (values
 ('admin.bundle_photo_hint','en','Optional: without a photo, the site shows a mosaic of the components'' photos.'),('admin.bundle_photo_hint','zh','可选：没有照片时，网站将显示组成商品照片的拼图。'),('admin.bundle_photo_hint','am','አማራጭ፦ ፎቶ ከሌለ ድህረ-ገጹ የአካላትን ፎቶዎች ሞዛይክ ያሳያል።'),('admin.bundle_photo_hint','so','Ikhtiyaari: sawir la''aan, boggu wuxuu muujinayaa isku-dhaf sawirrada qaybaha.'),('admin.bundle_photo_hint','aa','Ikhtiyaari: sawir la''aan, boggu wuxuu muujinayaa isku-dhaf sawirrada qaybaha.')
) as v(key, lang, value)
where not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);
