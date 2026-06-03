create table if not exists push_subscriptions (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  is_admin   boolean default false,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;
create policy "service role full access" on push_subscriptions using (true) with check (true);
