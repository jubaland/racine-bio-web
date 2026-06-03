create table if not exists admin_notifications (
  id         uuid default gen_random_uuid() primary key,
  title      text not null,
  body       text,
  url        text,
  read       boolean default false,
  created_at timestamptz default now()
);

alter table admin_notifications enable row level security;

-- Admins (is_admin: true dans user_metadata) peuvent lire et modifier
create policy "admin access" on admin_notifications
  for all using (
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  );

-- Activer le realtime pour les mises à jour en direct
alter publication supabase_realtime add table admin_notifications;
