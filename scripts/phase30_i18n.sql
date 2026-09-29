-- Traductions d'interface générées par scripts/i18n_import.mjs (11 clés × 5 langues ; fr = fallback dans le code)
insert into public.ui_translations (key, language_code, value)
select v.key, v.lang, v.value from (values
 ('tr.busy','en','Translating…'),
 ('tr.button','en','Translate automatically'),
 ('tr.done','en','Translations suggested. Review them before saving.'),
 ('tr.err_long','en','The text is too long for automatic translation.'),
 ('tr.err_quota','en','The free quota of the translation service has been reached for today. Try again tomorrow or enter the translation yourself.'),
 ('tr.err_unavailable','en','The translation service is not responding. Try again in a moment.'),
 ('tr.hint','en','Translated by an online service, to be reviewed: it may contain errors.'),
 ('tr.no_source','en','Enter the French text first.'),
 ('tr.nothing','en','All fields were already filled in: nothing was changed.'),
 ('tr.partial','en','language(s) not translated: try again.'),
 ('tr.replace_confirm','en','Some translations are already filled in.

OK: replace them with the automatic translation.
Cancel: only fill in the empty fields.'),
 ('tr.busy','zh','正在翻译…'),
 ('tr.button','zh','自动翻译'),
 ('tr.done','zh','已提供翻译建议，请在保存前检查。'),
 ('tr.err_long','zh','文本太长，无法自动翻译。'),
 ('tr.err_quota','zh','翻译服务今天的免费额度已用完。请明天再试，或手动输入翻译。'),
 ('tr.err_unavailable','zh','翻译服务没有响应，请稍后再试。'),
 ('tr.hint','zh','由在线服务翻译，需要检查：可能存在错误。'),
 ('tr.no_source','zh','请先输入法语文本。'),
 ('tr.nothing','zh','所有字段均已填写：未做任何修改。'),
 ('tr.partial','zh','种语言未翻译：请重试。'),
 ('tr.replace_confirm','zh','部分翻译已填写。

确定：用自动翻译替换。
取消：仅填写空白字段。'),
 ('tr.busy','am','በመተርጎም ላይ…'),
 ('tr.button','am','በራስ-ሰር ተርጉም'),
 ('tr.done','am','ትርጉሞች ቀርበዋል። ከማስቀመጥዎ በፊት ያረጋግጡ።'),
 ('tr.err_long','am','ጽሑፉ ለራስ-ሰር ትርጉም በጣም ረጅም ነው።'),
 ('tr.err_quota','am','የትርጉም አገልግሎቱ የዛሬ ነፃ ገደብ አልቋል። ነገ እንደገና ይሞክሩ ወይም ትርጉሙን ያስገቡ።'),
 ('tr.err_unavailable','am','የትርጉም አገልግሎቱ ምላሽ እየሰጠ አይደለም። ከጥቂት ጊዜ በኋላ ይሞክሩ።'),
 ('tr.hint','am','በኦንላይን አገልግሎት የተተረጎመ፣ መታየት ያለበት፦ ስህተቶች ሊኖሩት ይችላል።'),
 ('tr.no_source','am','መጀመሪያ የፈረንሳይኛውን ጽሑፍ ያስገቡ።'),
 ('tr.nothing','am','ሁሉም መስኮች አስቀድመው ተሞልተዋል፦ ምንም አልተለወጠም።'),
 ('tr.partial','am','ቋንቋ(ዎች) አልተተረጎሙም፦ እንደገና ይሞክሩ።'),
 ('tr.replace_confirm','am','አንዳንድ ትርጉሞች አስቀድመው ተሞልተዋል።

እሺ፦ በራስ-ሰር ትርጉም ይተኩ።
ሰርዝ፦ ባዶ መስኮችን ብቻ ይሙሉ።'),
 ('tr.busy','so','Waa la tarjumayaa…'),
 ('tr.busy','aa','Waa la tarjumayaa…'),
 ('tr.button','so','Si toos ah u tarjun'),
 ('tr.button','aa','Si toos ah u tarjun'),
 ('tr.done','so','Tarjumaadaha waa la soo jeediyay. Dib u eeg ka hor intaadan kaydin.'),
 ('tr.done','aa','Tarjumaadaha waa la soo jeediyay. Dib u eeg ka hor intaadan kaydin.'),
 ('tr.err_long','so','Qoraalku aad buu ugu dheer yahay tarjumaadda tooska ah.'),
 ('tr.err_long','aa','Qoraalku aad buu ugu dheer yahay tarjumaadda tooska ah.'),
 ('tr.err_quota','so','Xadka bilaashka ah ee adeegga tarjumaadda ayaa maanta dhammaaday. Berri isku day ama geli tarjumaadda.'),
 ('tr.err_quota','aa','Xadka bilaashka ah ee adeegga tarjumaadda ayaa maanta dhammaaday. Berri isku day ama geli tarjumaadda.'),
 ('tr.err_unavailable','so','Adeegga tarjumaaddu ma jawaabayo. Wax yar kadib isku day.'),
 ('tr.err_unavailable','aa','Adeegga tarjumaaddu ma jawaabayo. Wax yar kadib isku day.'),
 ('tr.hint','so','Waxaa tarjumay adeeg online ah, waa in dib loo eego: khaladaad ayaa ku jiri kara.'),
 ('tr.hint','aa','Waxaa tarjumay adeeg online ah, waa in dib loo eego: khaladaad ayaa ku jiri kara.'),
 ('tr.no_source','so','Marka hore geli qoraalka Faransiiska.'),
 ('tr.no_source','aa','Marka hore geli qoraalka Faransiiska.'),
 ('tr.nothing','so','Dhammaan meelaha horeba waa la buuxiyay: waxba lama beddelin.'),
 ('tr.nothing','aa','Dhammaan meelaha horeba waa la buuxiyay: waxba lama beddelin.'),
 ('tr.partial','so','luqad(o) lama tarjumin: mar kale isku day.'),
 ('tr.partial','aa','luqad(o) lama tarjumin: mar kale isku day.'),
 ('tr.replace_confirm','so','Tarjumaadaha qaarkood horeba waa la buuxiyay.

OK: ku beddel tarjumaadda tooska ah.
Jooji: buuxi oo keliya meelaha bannaan.'),
 ('tr.replace_confirm','aa','Tarjumaadaha qaarkood horeba waa la buuxiyay.

OK: ku beddel tarjumaadda tooska ah.
Jooji: buuxi oo keliya meelaha bannaan.')
) as v(key, lang, value)
where not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);
