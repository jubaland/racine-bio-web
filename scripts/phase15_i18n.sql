-- PHASE 15 — Invitation « Installer l'app » compacte (fr = fallback dans le code)
insert into public.ui_translations (key, language_code, value)
select v.key, v.lang, v.value from (values
 ('install.cta_short','en','Install the app'),('install.cta_short','zh','安装应用'),('install.cta_short','am','መተግበሪያውን ጫን'),('install.cta_short','so','Rakib app-ka'),('install.cta_short','aa','Rakib app-ka')
) as v(key, lang, value)
where not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);
