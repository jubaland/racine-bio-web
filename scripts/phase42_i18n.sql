-- Traductions d'interface générées par scripts/i18n_import.mjs (1 clés × 5 langues ; fr = fallback dans le code)
insert into public.ui_translations (key, language_code, value)
select v.key, v.lang, v.value from (values
 ('fin.margin_neg','en','You are selling below purchase cost on this selection.'),
 ('fin.margin_neg','zh','在当前选择范围内，您的售价低于进货成本。'),
 ('fin.margin_neg','am','በዚህ ምርጫ ላይ ከግዢ ዋጋ በታች እየሸጡ ነው።'),
 ('fin.margin_neg','so','Xulashadan waxaad ku iibinaysaa qiimo ka hooseeya qiimaha gadashada.'),
 ('fin.margin_neg','aa','Xulashadan waxaad ku iibinaysaa qiimo ka hooseeya qiimaha gadashada.')
) as v(key, lang, value)
where not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);
