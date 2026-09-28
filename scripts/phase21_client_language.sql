-- =====================================================================
-- PHASE 21 — Langue du client connue du serveur (28/09/2026)
-- Jusqu'ici la langue n'existait que dans le navigateur (localStorage) : le serveur envoyait
-- toutes les notifications en français.
--   user_prefs.lang           : langue du compte (cloche, e-mails, push des appareils sans langue)
--   push_subscriptions.lang   : langue de l'appareil abonné aux notifications
-- Écritures par le serveur uniquement (/api/lang). Langue absente = français.
-- Sauvegarde : avant-langue-client.
-- =====================================================================
create table if not exists public.user_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  lang       text check (lang is null or lang in ('fr','en','zh','am','so','aa')),
  updated_at timestamptz not null default now()
);
alter table public.user_prefs enable row level security;
drop policy if exists user_prefs_read on public.user_prefs;
create policy user_prefs_read on public.user_prefs for select using (user_id = auth.uid());

alter table public.push_subscriptions add column if not exists lang text
  check (lang is null or lang in ('fr','en','zh','am','so','aa'));

-- Titre de l'onglet du navigateur
insert into public.ui_translations (key, language_code, value)
select v.key, v.lang, v.value from (values
 ('meta.title','en','Hornafresh — The premium, fresh, organic, local and regional market of Djibouti'),
 ('meta.title','zh','Hornafresh — 吉布提优质、新鲜、有机、本地及区域市场'),
 ('meta.title','am','Hornafresh — የጅቡቲ ምርጥ፣ ትኩስ፣ ኦርጋኒክ፣ የአካባቢና የክልል ገበያ'),
 ('meta.title','so','Hornafresh — Suuqa heerka sare, cusub, dabiici, maxalli iyo gobol ee Jabuuti'),
 ('meta.title','aa','Hornafresh — Suuqa heerka sare, cusub, dabiici, maxalli iyo gobol ee Jabuuti')
) as v(key, lang, value)
where not exists (select 1 from public.ui_translations u where u.key = v.key and u.language_code = v.lang);

select (select count(*) from public.user_prefs) prefs, (select count(*) from public.push_subscriptions) subs;

-- ROLLBACK
-- drop table if exists public.user_prefs;
-- alter table public.push_subscriptions drop column if exists lang;
-- delete from public.ui_translations where key = 'meta.title';
