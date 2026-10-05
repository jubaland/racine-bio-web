-- Traductions d'interface générées par scripts/i18n_import.mjs (4 clés × 5 langues ; fr = fallback dans le code)
insert into public.ui_translations (key, language_code, value)
select v.key, v.lang, v.value from (values
 ('admin.edit_done','en','Change applied.'),
 ('admin.edit_refunded_wallet','en','credited back to the wallet'),
 ('admin.qty_reason_ph','en','Reason (required) — e.g. the customer only took 10 kg'),
 ('admin.remove_confirm_btn','en','Confirm removal'),
 ('admin.edit_done','zh','修改已生效。'),
 ('admin.edit_refunded_wallet','zh','已退回钱包'),
 ('admin.qty_reason_ph','zh','原因（必填）——例如：客户只拿了 10 公斤'),
 ('admin.remove_confirm_btn','zh','确认移除'),
 ('admin.edit_done','am','ለውጡ ተተግብሯል።'),
 ('admin.edit_refunded_wallet','am','ወደ የገንዘብ ቦርሳ ተመልሷል'),
 ('admin.qty_reason_ph','am','ምክንያት (ግዴታ) — ምሳሌ፦ ደንበኛው 10 ኪግ ብቻ ወስዷል'),
 ('admin.remove_confirm_btn','am','መወገዱን አረጋግጥ'),
 ('admin.edit_done','so','Beddelka waa la dabaqay.'),
 ('admin.edit_done','aa','Beddelka waa la dabaqay.'),
 ('admin.edit_refunded_wallet','so','dib loogu celiyay boorsada'),
 ('admin.edit_refunded_wallet','aa','dib loogu celiyay boorsada'),
 ('admin.qty_reason_ph','so','Sabab (qasab) — tusaale: macmiilku wuxuu qaatay 10 kg oo keliya'),
 ('admin.qty_reason_ph','aa','Sabab (qasab) — tusaale: macmiilku wuxuu qaatay 10 kg oo keliya'),
 ('admin.remove_confirm_btn','so','Xaqiiji ka-saarista'),
 ('admin.remove_confirm_btn','aa','Xaqiiji ka-saarista')
) as v(key, lang, value)
where not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);
