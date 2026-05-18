-- Draft: align live Supabase database contract with Git/app expectations.
-- Date: 2026-05-18
-- Project: bicesity.ge / blfjalavufthhsouifhq
--
-- Review status:
-- - Do not run until approved.
-- - Intended first narrow repair only.
-- - Does not drop tables, columns, functions, or data.
-- - Replaces only named attribute_options policies and the profiles updated_at trigger.
-- - Does not modify rls_auto_enable() or the ensure_rls event trigger.
--
-- Why this exists:
-- - Live has public.attribute_options, but Git migrations do not recreate it.
-- - Live has public.attributes.input_mode, but Git migrations do not recreate it.
-- - Git/app expect public.attributes.display_name_translations, but live is missing it.
-- - Git expects trg_profiles_set_updated_at, but live is missing it.
-- - Git/app use GEL, but live sales.currency_code default is USD.

begin;

-- 1. Preserve/recreate app-required field input mode.
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

-- 2. Add multilingual field labels expected by app code.
alter table public.attributes
  add column if not exists display_name_translations jsonb not null default '{}'::jsonb;

update public.attributes
set display_name_translations = jsonb_build_object('en', display_name)
where display_name_translations = '{}'::jsonb
   or display_name_translations is null;

-- 3. Preserve/recreate live select-option table for custom fields.
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

-- Public storefront can read active options only for public, unarchived fields.
-- Admins can also read all option rows; this keeps UPDATE usable for
-- authenticated admin clients because Postgres RLS UPDATE requires row visibility.
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

-- 4. Restore profile updated_at trigger expected by Git migrations.
drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- 5. Align sale currency default with the shop/app default.
alter table public.sales
  alter column currency_code set default 'GEL';

-- 6. Refresh PostgREST schema cache after the schema change.
notify pgrst, 'reload schema';

commit;

-- Manual verification after approval and execution:
--
-- select table_name, column_name, data_type, udt_name, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and (
--     (table_name = 'attributes' and column_name in ('input_mode', 'display_name_translations'))
--     or table_name = 'attribute_options'
--     or (table_name = 'sales' and column_name = 'currency_code')
--   )
-- order by table_name, column_name;
--
-- select event_object_table, trigger_name, action_timing, event_manipulation, action_statement
-- from information_schema.triggers
-- where event_object_schema = 'public'
--   and event_object_table = 'profiles'
--   and trigger_name = 'trg_profiles_set_updated_at';
--
-- select schemaname, tablename, policyname, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'attribute_options'
-- order by policyname;
