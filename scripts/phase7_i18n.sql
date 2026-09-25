-- Export CSV des commandes marchand : textes (fr = valeur par défaut dans le code)
insert into public.ui_translations (key, language_code, value)
select v.key, v.lang, v.value from (values
 ('producer.csv_status','en','Status'),('producer.csv_status','zh','状态'),('producer.csv_status','am','ሁኔታ'),('producer.csv_status','so','Xaalad'),('producer.csv_status','aa','Xaalad'),
 ('producer.csv_customer','en','Customer'),('producer.csv_customer','zh','客户'),('producer.csv_customer','am','ደንበኛ'),('producer.csv_customer','so','Macmiil'),('producer.csv_customer','aa','Macmiil'),
 ('producer.csv_unit','en','Unit'),('producer.csv_unit','zh','单位'),('producer.csv_unit','am','መለኪያ'),('producer.csv_unit','so','Cutub'),('producer.csv_unit','aa','Cutub'),
 ('producer.csv_paid_out','en','Paid out'),('producer.csv_paid_out','zh','已转付'),('producer.csv_paid_out','am','ተከፍሏል'),('producer.csv_paid_out','so','La gudbiyay'),('producer.csv_paid_out','aa','La gudbiyay'),
 ('producer.to_pay_out','en','To pay out'),('producer.to_pay_out','zh','待转付'),('producer.to_pay_out','am','የሚከፈል'),('producer.to_pay_out','so','La gudbinayo'),('producer.to_pay_out','aa','La gudbinayo'),
 ('producer.csv_yes','en','yes'),('producer.csv_yes','zh','是'),('producer.csv_yes','am','አዎ'),('producer.csv_yes','so','haa'),('producer.csv_yes','aa','haa'),
 ('producer.csv_no','en','no'),('producer.csv_no','zh','否'),('producer.csv_no','am','አይ'),('producer.csv_no','so','maya'),('producer.csv_no','aa','maya'),
 ('producer.csv_total_label','en','Total excluding cancelled'),('producer.csv_total_label','zh','合计（不含已取消）'),('producer.csv_total_label','am','ጠቅላላ የተሰረዙትን ሳይጨምር'),('producer.csv_total_label','so','Wadarta marka laga reebo kuwa la joojiyay'),('producer.csv_total_label','aa','Wadarta marka laga reebo kuwa la joojiyay'),
 ('producer.csv_lines','en','line(s)'),('producer.csv_lines','zh','行'),('producer.csv_lines','am','መስመር(ሮች)'),('producer.csv_lines','so','khad'),('producer.csv_lines','aa','khad'),
 ('producer.period_clear','en','Whole period'),('producer.period_clear','zh','全部时间'),('producer.period_clear','am','ሙሉ ጊዜ'),('producer.period_clear','so','Muddada oo dhan'),('producer.period_clear','aa','Muddada oo dhan')
) as v(key, lang, value)
where not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);
select count(*) from public.ui_translations where key like 'producer.csv_%' or key in ('producer.to_pay_out','producer.period_clear');
