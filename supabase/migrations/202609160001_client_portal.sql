create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.client_kind as enum ('recurring', 'one_off');
create type public.media_kind as enum ('video', 'photo');
create type public.media_source as enum ('instagram', 'youtube', 'upload', 'external');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trade_name text,
  document text,
  kind public.client_kind not null default 'one_off',
  status text not null default 'active' check (status in ('active', 'inactive')),
  accent_color text not null default '#b50000',
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  username citext not null unique,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  description text,
  event_date date,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  cover_url text,
  created_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  kind public.media_kind not null,
  source public.media_source not null,
  title text not null,
  description text,
  published_url text,
  storage_path text,
  thumbnail_url text,
  published_at timestamptz,
  allow_download boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (published_url is not null or storage_path is not null)
);

create table public.media_metrics (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media_assets(id) on delete cascade,
  captured_on date not null default current_date,
  views bigint not null default 0 check (views >= 0),
  reach bigint not null default 0 check (reach >= 0),
  likes bigint not null default 0 check (likes >= 0),
  comments bigint not null default 0 check (comments >= 0),
  shares bigint not null default 0 check (shares >= 0),
  saves bigint not null default 0 check (saves >= 0),
  source text not null default 'manual' check (source in ('manual', 'youtube_api', 'instagram_api')),
  unique (media_id, captured_on)
);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  token_hash text not null unique,
  title text not null,
  allow_download boolean not null default false,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index clients_kind_status_idx on public.clients(kind, status);
create index projects_client_idx on public.projects(client_id, created_at desc);
create index media_assets_client_kind_idx on public.media_assets(client_id, kind, sort_order, created_at desc);
create index media_assets_project_idx on public.media_assets(project_id);
create index media_metrics_media_date_idx on public.media_metrics(media_id, captured_on desc);

create or replace function public.is_form_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'email') = 'admin@formcompany.com', false)
$$;

create or replace function public.current_client_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select client_id from public.client_access where user_id = auth.uid()
$$;

alter table public.clients enable row level security;
alter table public.client_access enable row level security;
alter table public.projects enable row level security;
alter table public.media_assets enable row level security;
alter table public.media_metrics enable row level security;
alter table public.share_links enable row level security;

create policy "admin manages clients" on public.clients for all to authenticated using (public.is_form_admin()) with check (public.is_form_admin());
create policy "client reads own profile" on public.clients for select to authenticated using (id = public.current_client_id() and status = 'active');
create policy "admin manages access" on public.client_access for all to authenticated using (public.is_form_admin()) with check (public.is_form_admin());
create policy "client reads own access" on public.client_access for select to authenticated using (user_id = auth.uid());
create policy "admin manages projects" on public.projects for all to authenticated using (public.is_form_admin()) with check (public.is_form_admin());
create policy "client reads own projects" on public.projects for select to authenticated using (client_id = public.current_client_id() and status = 'published');
create policy "admin manages media" on public.media_assets for all to authenticated using (public.is_form_admin()) with check (public.is_form_admin());
create policy "client reads own media" on public.media_assets for select to authenticated using (client_id = public.current_client_id());
create policy "admin manages metrics" on public.media_metrics for all to authenticated using (public.is_form_admin()) with check (public.is_form_admin());
create policy "client reads own metrics" on public.media_metrics for select to authenticated using (exists (select 1 from public.media_assets m where m.id = media_id and m.client_id = public.current_client_id()));
create policy "admin manages shares" on public.share_links for all to authenticated using (public.is_form_admin()) with check (public.is_form_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-media', 'client-media', false, 2147483648, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'])
on conflict (id) do nothing;

create policy "admin manages client media" on storage.objects for all to authenticated
using (bucket_id = 'client-media' and public.is_form_admin())
with check (bucket_id = 'client-media' and public.is_form_admin());

create policy "client reads own storage" on storage.objects for select to authenticated
using (bucket_id = 'client-media' and (storage.foldername(name))[1] = public.current_client_id()::text);

grant usage on schema public to authenticated;
grant select on public.clients, public.client_access, public.projects, public.media_assets, public.media_metrics, public.share_links to authenticated;
grant insert, update, delete on public.clients, public.client_access, public.projects, public.media_assets, public.media_metrics, public.share_links to authenticated;
revoke all on public.clients, public.client_access, public.projects, public.media_assets, public.media_metrics, public.share_links from anon;
