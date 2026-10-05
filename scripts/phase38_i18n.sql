-- Traductions d'interface générées par scripts/i18n_import.mjs (2 clés × 5 langues ; fr = fallback dans le code)
insert into public.ui_translations (key, language_code, value)
select v.key, v.lang, v.value from (values
 ('admin.qty_apply','en','Apply'),
 ('admin.qty_label','en','Quantity'),
 ('admin.qty_apply','zh','应用'),
 ('admin.qty_label','zh','数量'),
 ('admin.qty_apply','am','ተግብር'),
 ('admin.qty_label','am','ብዛት'),
 ('admin.qty_apply','so','Dabaq'),
 ('admin.qty_apply','aa','Dabaq'),
 ('admin.qty_label','so','Tiro'),
 ('admin.qty_label','aa','Tiro')
) as v(key, lang, value)
where not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);
