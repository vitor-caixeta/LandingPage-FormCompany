create table if not exists public.app_data (
  section text primary key check (section in ('clients', 'accounts', 'entries')),
  value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

drop policy if exists "admin manages app data" on public.app_data;
create policy "admin manages app data"
on public.app_data for all to authenticated
using (public.is_form_admin())
with check (public.is_form_admin());

grant select, insert, update, delete on public.app_data to authenticated;
revoke all on public.app_data from anon;
