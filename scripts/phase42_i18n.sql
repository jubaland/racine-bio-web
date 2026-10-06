-- Traductions d'interface générées par scripts/i18n_import.mjs (5 clés × 5 langues ; fr = fallback dans le code)
insert into public.ui_translations (key, language_code, value)
select v.key, v.lang, v.value from (values
 ('fin.from','en','From'),
 ('fin.period_custom','en','Dates…'),
 ('fin.range_err','en','Pick two dates, the first before the second.'),
 ('fin.range_hint','en','Dates included.'),
 ('fin.to','en','to'),
 ('fin.from','zh','从'),
 ('fin.period_custom','zh','自定义日期…'),
 ('fin.range_err','zh','请选择两个日期，起始日期需早于结束日期。'),
 ('fin.range_hint','zh','含首尾两日。'),
 ('fin.to','zh','至'),
 ('fin.from','am','ከ'),
 ('fin.period_custom','am','ቀናት…'),
 ('fin.range_err','am','ሁለት ቀናት ይምረጡ፣ የመጀመሪያው ከሁለተኛው በፊት።'),
 ('fin.range_hint','am','ቀናቱ ተካትተዋል።'),
 ('fin.to','am','እስከ'),
 ('fin.from','so','Laga'),
 ('fin.from','aa','Laga'),
 ('fin.period_custom','so','Taariikho…'),
 ('fin.period_custom','aa','Taariikho…'),
 ('fin.range_err','so','Dooro laba taariikhood, tan hore ka hor tan labaad.'),
 ('fin.range_err','aa','Dooro laba taariikhood, tan hore ka hor tan labaad.'),
 ('fin.range_hint','so','Taariikhaha waa lagu daray.'),
 ('fin.range_hint','aa','Taariikhaha waa lagu daray.'),
 ('fin.to','so','ilaa'),
 ('fin.to','aa','ilaa')
) as v(key, lang, value)
where not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);
