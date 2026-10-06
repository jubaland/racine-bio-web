-- Traductions d'interface générées par scripts/i18n_import.mjs (4 clés × 5 langues ; fr = fallback dans le code)
insert into public.ui_translations (key, language_code, value)
select v.key, v.lang, v.value from (values
 ('fin.discounts_hint2','en','Promo codes and admin discounts, already deducted from the net margin'),
 ('fin.margin_net','en','Net margin'),
 ('fin.margin_net_hint','en','Gross margin − granted discounts'),
 ('fin.margin_net_neg','en','Costs and discounts exceed sales on this selection.'),
 ('fin.discounts_hint2','zh','优惠码和管理员折扣，已从净利润中扣除'),
 ('fin.margin_net','zh','净利润'),
 ('fin.margin_net_hint','zh','毛利 − 已给予的折扣'),
 ('fin.margin_net_neg','zh','在当前选择范围内，成本和折扣超过了销售额。'),
 ('fin.discounts_hint2','am','የቅናሽ ኮዶች እና የአስተዳዳሪ ቅናሾች፣ ከተጣራው ትርፍ ተቀንሰዋል'),
 ('fin.margin_net','am','የተጣራ ትርፍ'),
 ('fin.margin_net_hint','am','ጠቅላላ ትርፍ − የተሰጡ ቅናሾች'),
 ('fin.margin_net_neg','am','በዚህ ምርጫ ላይ ወጪዎችና ቅናሾች ከሽያጩ በልጠዋል።'),
 ('fin.discounts_hint2','so','Koodhadhka dhimista iyo dhimisyada maamulka, horey ayaa looga jaray faa''iidada saafiga ah'),
 ('fin.discounts_hint2','aa','Koodhadhka dhimista iyo dhimisyada maamulka, horey ayaa looga jaray faa''iidada saafiga ah'),
 ('fin.margin_net','so','Faa''iidada saafiga ah'),
 ('fin.margin_net','aa','Faa''iidada saafiga ah'),
 ('fin.margin_net_hint','so','Faa''iidada guud − dhimisyada la siiyay'),
 ('fin.margin_net_hint','aa','Faa''iidada guud − dhimisyada la siiyay'),
 ('fin.margin_net_neg','so','Xulashadan kharashyada iyo dhimisyadu waxay dhaafeen iibka.'),
 ('fin.margin_net_neg','aa','Xulashadan kharashyada iyo dhimisyadu waxay dhaafeen iibka.')
) as v(key, lang, value)
where not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);
