-- App-level settings for public shop contact details.

create table if not exists public.app_settings (
  id text primary key default 'global',
  shop_name text not null default 'VeloHub',
  currency text not null default 'GEL',
  messenger_url text not null default '',
  public_contact_info text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by_actor_id uuid,
  constraint app_settings_singleton check (id = 'global')
);

insert into public.app_settings (id)
values ('global')
on conflict (id) do nothing;

drop trigger if exists trg_app_settings_set_updated_at on public.app_settings;
create trigger trg_app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

grant select on public.app_settings to anon, authenticated;
grant insert, update on public.app_settings to authenticated;

alter table public.app_settings enable row level security;

drop policy if exists app_settings_select_policy on public.app_settings;
drop policy if exists app_settings_insert_policy on public.app_settings;
drop policy if exists app_settings_update_policy on public.app_settings;

create policy app_settings_select_policy
on public.app_settings
for select
to anon, authenticated
using (true);

create policy app_settings_insert_policy
on public.app_settings
for insert
to authenticated
with check (public.is_admin());

create policy app_settings_update_policy
on public.app_settings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
