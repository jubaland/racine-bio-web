-- PHASE 10 — avis clients par marchand : textes (fr = valeur par défaut dans le code)
insert into public.ui_translations (key, language_code, value)
select v.key, v.lang, v.value from (values
 ('mer.tab_reviews','en','Reviews'),('mer.tab_reviews','zh','评价'),('mer.tab_reviews','am','ግምገማዎች'),('mer.tab_reviews','so','Faallooyin'),('mer.tab_reviews','aa','Faallooyin'),
 ('rev.title','en','Customer reviews'),('rev.title','zh','客户评价'),('rev.title','am','የደንበኛ ግምገማዎች'),('rev.title','so','Faallooyinka macaamiisha'),('rev.title','aa','Faallooyinka macaamiisha'),
 ('rev.count','en','review(s)'),('rev.count','zh','条评价'),('rev.count','am','ግምገማ(ዎች)'),('rev.count','so','faallo'),('rev.count','aa','faallo'),
 ('rev.none','en','No review yet.'),('rev.none','zh','暂无评价。'),('rev.none','am','እስካሁን ግምገማ የለም።'),('rev.none','so','Weli faallo ma jirto.'),('rev.none','aa','Weli faallo ma jirto.'),
 ('rev.none_merchant','en','No review yet: they appear after your first deliveries.'),('rev.none_merchant','zh','暂无评价：首次送达后将显示。'),('rev.none_merchant','am','እስካሁን ግምገማ የለም፦ ከመጀመሪያ ማድረሶችዎ በኋላ ይታያሉ።'),('rev.none_merchant','so','Weli faallo ma jirto: waxay soo muuqdaan gaarsiintaada koowaad ka dib.'),('rev.none_merchant','aa','Weli faallo ma jirto: waxay soo muuqdaan gaarsiintaada koowaad ka dib.'),
 ('rev.form_title','en','Your review of'),('rev.form_title','zh','您对以下商户的评价：'),('rev.form_title','am','የእርስዎ ግምገማ ስለ'),('rev.form_title','so','Faalladaada ku saabsan'),('rev.form_title','aa','Faalladaada ku saabsan'),
 ('rev.edit_title','en','Edit my review'),('rev.edit_title','zh','修改我的评价'),('rev.edit_title','am','ግምገማዬን አርትዕ'),('rev.edit_title','so','Wax ka beddel faalladayda'),('rev.edit_title','aa','Wax ka beddel faalladayda'),
 ('rev.comment_ph','en','e.g. very fresh products, fast delivery'),('rev.comment_ph','zh','例如：产品非常新鲜，配送快'),('rev.comment_ph','am','ምሳሌ፦ በጣም ትኩስ ምርቶች፣ ፈጣን ማድረስ'),('rev.comment_ph','so','Tusaale: alaab aad u cusub, gaarsiin degdeg ah'),('rev.comment_ph','aa','Tusaale: alaab aad u cusub, gaarsiin degdeg ah'),
 ('rev.send','en','Publish my review'),('rev.send','zh','发布我的评价'),('rev.send','am','ግምገማዬን አትም'),('rev.send','so','Daabac faalladayda'),('rev.send','aa','Daabac faalladayda'),
 ('rev.update','en','Update'),('rev.update','zh','更新'),('rev.update','am','አዘምን'),('rev.update','so','Cusboonaysii'),('rev.update','aa','Cusboonaysii'),
 ('rev.pick_rating','en','Choose a rating.'),('rev.pick_rating','zh','请选择评分。'),('rev.pick_rating','am','ደረጃ ይምረጡ።'),('rev.pick_rating','so','Dooro qiimayn.'),('rev.pick_rating','aa','Dooro qiimayn.'),
 ('rev.thanks','en','Thank you for your review!'),('rev.thanks','zh','感谢您的评价！'),('rev.thanks','am','ለግምገማዎ እናመሰግናለን!'),('rev.thanks','so','Waad ku mahadsan tahay faalladaada!'),('rev.thanks','aa','Waad ku mahadsan tahay faalladaada!'),
 ('rev.updated','en','Review updated, thank you!'),('rev.updated','zh','评价已更新，谢谢！'),('rev.updated','am','ግምገማ ተዘምኗል፣ እናመሰግናለን!'),('rev.updated','so','Faallada waa la cusboonaysiiyay, mahadsanid!'),('rev.updated','aa','Faallada waa la cusboonaysiiyay, mahadsanid!'),
 ('rev.not_eligible','en','You can rate this merchant after receiving an order containing their products.'),('rev.not_eligible','zh','收到包含该商户产品的订单后即可评价。'),('rev.not_eligible','am','የዚህን ነጋዴ ምርቶች የያዘ ትዕዛዝ ከተቀበሉ በኋላ መገምገም ይችላሉ።'),('rev.not_eligible','so','Waxaad qiimayn kartaa ganacsadahan ka dib markaad hesho dalab alaabtiisa ku jirto.'),('rev.not_eligible','aa','Waxaad qiimayn kartaa ganacsadahan ka dib markaad hesho dalab alaabtiisa ku jirto.'),
 ('rev.login_hint','en','Sign in after a delivered order to leave a review.'),('rev.login_hint','zh','订单送达后登录即可留下评价。'),('rev.login_hint','am','ግምገማ ለመተው ከተደረሰ ትዕዛዝ በኋላ ይግቡ።'),('rev.login_hint','so','Gal ka dib dalab la gaarsiiyay si aad faallo u dhiibto.'),('rev.login_hint','aa','Gal ka dib dalab la gaarsiiyay si aad faallo u dhiibto.'),
 ('rev.hidden_note','en','Your review has been hidden by Hornafresh.'),('rev.hidden_note','zh','您的评价已被 Hornafresh 隐藏。'),('rev.hidden_note','am','ግምገማዎ በHornafresh ተደብቋል።'),('rev.hidden_note','so','Faalladaada waxaa qariyay Hornafresh.'),('rev.hidden_note','aa','Faalladaada waxaa qariyay Hornafresh.'),
 ('rev.admin_avg','en','Average ratings'),('rev.admin_avg','zh','平均评分'),('rev.admin_avg','am','አማካይ ደረጃዎች'),('rev.admin_avg','so','Qiimaynta celceliska'),('rev.admin_avg','aa','Qiimaynta celceliska'),
 ('rev.admin_none','en','No review yet.'),('rev.admin_none','zh','暂无评价。'),('rev.admin_none','am','እስካሁን ግምገማ የለም።'),('rev.admin_none','so','Weli faallo ma jirto.'),('rev.admin_none','aa','Weli faallo ma jirto.'),
 ('rev.admin_list','en','Reviews'),('rev.admin_list','zh','评价'),('rev.admin_list','am','ግምገማዎች'),('rev.admin_list','so','Faallooyin'),('rev.admin_list','aa','Faallooyin'),
 ('rev.hidden','en','Hidden'),('rev.hidden','zh','已隐藏'),('rev.hidden','am','ተደብቋል'),('rev.hidden','so','La qariyay'),('rev.hidden','aa','La qariyay'),
 ('rev.hide','en','Hide'),('rev.hide','zh','隐藏'),('rev.hide','am','ደብቅ'),('rev.hide','so','Qari'),('rev.hide','aa','Qari'),
 ('rev.show','en','Show again'),('rev.show','zh','重新显示'),('rev.show','am','እንደገና አሳይ'),('rev.show','so','Dib u muuji'),('rev.show','aa','Dib u muuji')
) as v(key, lang, value)
where not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);
select count(*) from public.ui_translations where key like 'rev.%' or key = 'mer.tab_reviews';
