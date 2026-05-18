-- Align live database contract with Git/app expectations.
--
-- This migration records the narrow schema repair manually reviewed and
-- applied to the live bicesity.ge Supabase project on 2026-05-18.
--
-- It intentionally does not modify public.rls_auto_enable() or the
-- ensure_rls event trigger.

alter table public.attributes
  add column if not exists input_mode text not null default 'free_text';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'attributes_input_mode_check'
      and conrelid = 'public.attributes'::regclass
  ) then
    alter table public.attributes
      add constraint attributes_input_mode_check
      check (input_mode in ('free_text', 'single_select'));
  end if;
end
$$;

alter table public.attributes
  add column if not exists display_name_translations jsonb not null default '{}'::jsonb;

update public.attributes
set display_name_translations = jsonb_build_object('en', display_name)
where display_name_translations = '{}'::jsonb
   or display_name_translations is null;

create table if not exists public.attribute_options (
  id uuid primary key default gen_random_uuid(),
  attribute_id uuid not null references public.attributes(id) on delete cascade,
  label text not null,
  value text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attribute_id, value)
);

alter table public.attribute_options enable row level security;

grant select on public.attribute_options to anon, authenticated;
grant insert, update on public.attribute_options to authenticated;

drop policy if exists attribute_options_public_read on public.attribute_options;
drop policy if exists attribute_options_staff_insert on public.attribute_options;
drop policy if exists attribute_options_staff_update on public.attribute_options;
drop policy if exists attribute_options_admin_insert on public.attribute_options;
drop policy if exists attribute_options_admin_update on public.attribute_options;

create policy attribute_options_public_read
on public.attribute_options
for select
to anon, authenticated
using (
  (
    is_active = true
    and exists (
      select 1
      from public.attributes a
      where a.id = attribute_options.attribute_id
        and a.archived_at is null
        and a.is_public = true
    )
  )
  or public.is_admin()
);

create policy attribute_options_admin_insert
on public.attribute_options
for insert
to authenticated
with check (public.is_admin());

create policy attribute_options_admin_update
on public.attribute_options
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.sales
  alter column currency_code set default 'GEL';

notify pgrst, 'reload schema';
