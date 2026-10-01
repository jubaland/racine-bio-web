-- Traductions d'interface générées par scripts/i18n_import.mjs (1 clés × 5 langues ; fr = fallback dans le code)
insert into public.ui_translations (key, language_code, value)
select v.key, v.lang, v.value from (values
 ('cart.pending_text','en','You have a cart waiting'),
 ('cart.pending_text','zh','您有一个待结算的购物车'),
 ('cart.pending_text','am','በመጠባበቅ ላይ ያለ ቅርጫት አለዎት'),
 ('cart.pending_text','so','Waxaad leedahay dambiil ku sugaya'),
 ('cart.pending_text','aa','Waxaad leedahay dambiil ku sugaya')
) as v(key, lang, value)
where not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);
