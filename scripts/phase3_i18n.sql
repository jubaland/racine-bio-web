-- PHASE 3 — textes d'interface (fr = valeur par défaut dans le code)
insert into public.ui_translations (key, language_code, value)
select v.key, v.lang, v.value from (values
 ('shop.open','en','View the shop'),('shop.open','zh','查看店铺'),('shop.open','am','ሱቁን ይመልከቱ'),('shop.open','so','Eeg dukaanka'),('shop.open','aa','Eeg dukaanka'),
 ('shop.back','en','Back to the market'),('shop.back','zh','返回市场'),('shop.back','am','ወደ ገበያው ተመለስ'),('shop.back','so','Ku noqo suuqa'),('shop.back','aa','Ku noqo suuqa'),
 ('shop.merchant_on','en','Partner merchant on Hornafresh'),('shop.merchant_on','zh','Hornafresh 合作商户'),('shop.merchant_on','am','በHornafresh ላይ አጋር ነጋዴ'),('shop.merchant_on','so','Ganacsade wadaag ah Hornafresh'),('shop.merchant_on','aa','Ganacsade wadaag ah Hornafresh'),
 ('shop.products','en','product(s)'),('shop.products','zh','件产品'),('shop.products','am','ምርት(ቶች)'),('shop.products','so','alaab'),('shop.products','aa','alaab'),
 ('shop.in_stock','en','in stock'),('shop.in_stock','zh','有货'),('shop.in_stock','am','በክምችት'),('shop.in_stock','so','kayd ku jira'),('shop.in_stock','aa','kayd ku jira'),
 ('shop.hub_note','en','You order and pay on Hornafresh; we prepare and deliver your order with this merchant''s products.'),('shop.hub_note','zh','您在 Hornafresh 下单并付款；我们用该商户的产品为您备货并配送。'),('shop.hub_note','am','በHornafresh ላይ ያዛሉ እና ይከፍላሉ፤ የዚህን ነጋዴ ምርቶች በመጠቀም ትዕዛዝዎን እናዘጋጃለን እናደርሳለን።'),('shop.hub_note','so','Waxaad ka dalbataa oo bixisaa Hornafresh; annagaa diyaarinna oo gaarsiinna dalabkaaga alaabta ganacsadahan.'),('shop.hub_note','aa','Waxaad ka dalbataa oo bixisaa Hornafresh; annagaa diyaarinna oo gaarsiinna dalabkaaga alaabta ganacsadahan.'),
 ('shop.empty','en','This shop has no product available right now.'),('shop.empty','zh','该店铺目前没有可售产品。'),('shop.empty','am','ይህ ሱቅ አሁን ምንም ምርት የለውም።'),('shop.empty','so','Dukaankan hadda alaab la heli karo ma laha.'),('shop.empty','aa','Dukaankan hadda alaab la heli karo ma laha.'),
 ('product.out_of_stock','en','Out of stock'),('product.out_of_stock','zh','缺货'),('product.out_of_stock','am','ከክምችት ውጪ'),('product.out_of_stock','so','Kayd ma jiro'),('product.out_of_stock','aa','Kayd ma jiro'),
 ('product.stock_left','en','Only'),('product.stock_left','zh','仅剩'),('product.stock_left','am','ብቻ ቀርተዋል'),('product.stock_left','so','Kaliya'),('product.stock_left','aa','Kaliya'),
 ('producer.stats_title','en','My sales by product'),('producer.stats_title','zh','我的产品销售'),('producer.stats_title','am','ሽያጮቼ በምርት'),('producer.stats_title','so','Iibkayga alaab kasta'),('producer.stats_title','aa','Iibkayga alaab kasta'),
 ('producer.period_30d','en','30 days'),('producer.period_30d','zh','30 天'),('producer.period_30d','am','30 ቀናት'),('producer.period_30d','so','30 maalmood'),('producer.period_30d','aa','30 maalmood'),
 ('producer.period_month','en','This month'),('producer.period_month','zh','本月'),('producer.period_month','am','በዚህ ወር'),('producer.period_month','so','Bishan'),('producer.period_month','aa','Bishan'),
 ('producer.period_year','en','This year'),('producer.period_year','zh','今年'),('producer.period_year','am','በዚህ ዓመት'),('producer.period_year','so','Sanadkan'),('producer.period_year','aa','Sanadkan'),
 ('producer.period_all','en','All'),('producer.period_all','zh','全部'),('producer.period_all','am','ሁሉም'),('producer.period_all','so','Dhammaan'),('producer.period_all','aa','Dhammaan'),
 ('producer.stats_revenue','en','Sales'),('producer.stats_revenue','zh','销售额'),('producer.stats_revenue','am','ሽያጭ'),('producer.stats_revenue','so','Iib'),('producer.stats_revenue','aa','Iib'),
 ('producer.stats_orders','en','order(s)'),('producer.stats_orders','zh','个订单'),('producer.stats_orders','am','ትዕዛዝ(ዞች)'),('producer.stats_orders','so','dalab'),('producer.stats_orders','aa','dalab'),
 ('producer.stats_delivered','en','Delivered'),('producer.stats_delivered','zh','已送达'),('producer.stats_delivered','am','ተደርሷል'),('producer.stats_delivered','so','La gaarsiiyay'),('producer.stats_delivered','aa','La gaarsiiyay'),
 ('producer.stats_top','en','Best seller'),('producer.stats_top','zh','最畅销'),('producer.stats_top','am','ምርጥ ሽያጭ'),('producer.stats_top','so','Iibka ugu fiican'),('producer.stats_top','aa','Iibka ugu fiican'),
 ('producer.stats_empty','en','No product yet.'),('producer.stats_empty','zh','暂无产品。'),('producer.stats_empty','am','እስካሁን ምንም ምርት የለም።'),('producer.stats_empty','so','Weli alaab ma jirto.'),('producer.stats_empty','aa','Weli alaab ma jirto.'),
 ('producer.stats_sold','en','Sold'),('producer.stats_sold','zh','已售'),('producer.stats_sold','am','ተሽጧል'),('producer.stats_sold','so','La iibiyay'),('producer.stats_sold','aa','La iibiyay'),
 ('producer.status_pending','en','pending review'),('producer.status_pending','zh','待审核'),('producer.status_pending','am','ለመፈተሽ'),('producer.status_pending','so','la ansixinayo'),('producer.status_pending','aa','la ansixinayo'),
 ('producer.status_rejected','en','rejected'),('producer.status_rejected','zh','已拒绝'),('producer.status_rejected','am','ውድቅ ተደርጓል'),('producer.status_rejected','so','la diiday'),('producer.status_rejected','aa','la diiday')
) as v(key, lang, value)
where not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);
select count(*) from public.ui_translations where key like 'shop.%' or key like 'producer.stats_%' or key like 'producer.period_%';
