-- PHASE 11c — Avertissement « composants limitants » dans l'éditeur de panier (fr = fallback dans le code)
insert into public.ui_translations (key, language_code, value)
select v.key, v.lang, v.value from (values
 ('admin.bundle_limit_warn','en','Component stock only allows'),('admin.bundle_limit_warn','zh','组成商品库存仅允许'),('admin.bundle_limit_warn','am','የአካላት ክምችት የሚፈቅደው'),('admin.bundle_limit_warn','so','Kaydka qaybuhu wuxuu oggol yahay kaliya'),('admin.bundle_limit_warn','aa','Kaydka qaybuhu wuxuu oggol yahay kaliya'),
 ('admin.bundle_limit_warn2','en','basket(s), not'),('admin.bundle_limit_warn2','zh','个篮子，而不是'),('admin.bundle_limit_warn2','am','ቅርጫት(ቶች) ብቻ ነው፣ እንጂ'),('admin.bundle_limit_warn2','so','dambiil, ma aha'),('admin.bundle_limit_warn2','aa','dambiil, ma aha'),
 ('admin.bundle_limit_warn3','en','The site will show this reduced availability. Limiting component(s):'),('admin.bundle_limit_warn3','zh','网站将显示此减少的可用量。限制组成商品：'),('admin.bundle_limit_warn3','am','ድህረ-ገጹ ይህን የቀነሰ ተገኝነት ያሳያል። ገዳቢ አካል(ላት)፦'),('admin.bundle_limit_warn3','so','Boggu wuxuu muujin doonaa helitaankan la yareeyay. Qayb(o) xaddidaya:'),('admin.bundle_limit_warn3','aa','Boggu wuxuu muujin doonaa helitaankan la yareeyay. Qayb(o) xaddidaya:')
) as v(key, lang, value)
where not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);
