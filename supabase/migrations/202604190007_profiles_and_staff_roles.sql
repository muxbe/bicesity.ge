-- Staff profiles and profile-backed roles.
-- Run this before using the website Staff page.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'staff_role') then
    create type public.staff_role as enum ('admin', 'seller');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role public.staff_role not null default 'seller',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by_actor_id uuid,
  updated_by_actor_id uuid
);

create index if not exists profiles_user_id_idx on public.profiles (user_id);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_is_active_idx on public.profiles (is_active);

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(
    coalesce(
      (
        select case when p.is_active then p.role::text else 'user' end
        from public.profiles p
        where p.user_id = auth.uid()
        limit 1
      ),
      nullif(auth.jwt() ->> 'app_role', ''),
      nullif(auth.jwt() -> 'app_metadata' ->> 'app_role', ''),
      nullif(auth.jwt() -> 'user_metadata' ->> 'app_role', ''),
      'user'
    )
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_app_role() = 'admin';
$$;

create or replace function public.is_seller_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_app_role() in ('admin', 'seller');
$$;

grant execute on function public.current_app_role() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_seller_or_admin() to anon, authenticated;

grant select on public.profiles to authenticated;
grant insert, update on public.profiles to authenticated;

alter table public.profiles enable row level security;

drop policy if exists profiles_select_policy on public.profiles;
drop policy if exists profiles_insert_policy on public.profiles;
drop policy if exists profiles_update_policy on public.profiles;

create policy profiles_select_policy
on public.profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy profiles_insert_policy
on public.profiles
for insert
to authenticated
with check (public.is_admin());

create policy profiles_update_policy
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
