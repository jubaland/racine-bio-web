-- Traductions d'interface générées par scripts/i18n_import.mjs (3 clés × 5 langues ; fr = fallback dans le code)
insert into public.ui_translations (key, language_code, value)
select v.key, v.lang, v.value from (values
 ('dlg.cancel','en','Cancel'),
 ('dlg.confirm','en','Confirm'),
 ('tr.replace_confirm2','en','Some translations are already filled in.

Confirm: replace them with the automatic translation.
Cancel: only fill the empty fields.'),
 ('dlg.cancel','zh','取消'),
 ('dlg.confirm','zh','确认'),
 ('tr.replace_confirm2','zh','部分翻译已填写。

确认：用自动翻译替换它们。
取消：只填写空白字段。'),
 ('dlg.cancel','am','ይቅር'),
 ('dlg.confirm','am','አረጋግጥ'),
 ('tr.replace_confirm2','am','አንዳንድ ትርጉሞች አስቀድመው ተሞልተዋል።

አረጋግጥ፦ በራስ-ሰር ትርጉም ይተኩ።
ይቅር፦ ባዶ መስኮችን ብቻ ሙላ።'),
 ('dlg.cancel','so','Ka noqo'),
 ('dlg.cancel','aa','Ka noqo'),
 ('dlg.confirm','so','Xaqiiji'),
 ('dlg.confirm','aa','Xaqiiji'),
 ('tr.replace_confirm2','so','Qaar ka mid ah tarjumaadaha ayaa horey loo buuxiyay.

Xaqiiji: ku beddel tarjumaadda tooska ah.
Ka noqo: buuxi kaliya meelaha bannaan.'),
 ('tr.replace_confirm2','aa','Qaar ka mid ah tarjumaadaha ayaa horey loo buuxiyay.

Xaqiiji: ku beddel tarjumaadda tooska ah.
Ka noqo: buuxi kaliya meelaha bannaan.')
) as v(key, lang, value)
where not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);
