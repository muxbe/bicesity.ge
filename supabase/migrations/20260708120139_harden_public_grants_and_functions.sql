-- Harden public grants and function exposure before final domain launch.
--
-- This migration intentionally keeps existing RLS policies in place.
-- It changes privilege boundaries and function execution posture without
-- changing application routes or table shapes.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.current_app_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  with claims as (
    select auth.jwt() as jwt
  ),
  amr_methods as (
    select lower(
      case
        when jsonb_typeof(entry.value) = 'string' then trim(both '"' from entry.value::text)
        else entry.value ->> 'method'
      end
    ) as method
    from claims,
    jsonb_array_elements(
      case
        when jsonb_typeof(jwt -> 'amr') = 'array' then jwt -> 'amr'
        when jwt ? 'amr' then jsonb_build_array(jwt -> 'amr')
        else '[]'::jsonb
      end
    ) as entry(value)
  )
  select
    case
      when exists (select 1 from amr_methods where method = 'password') then
        lower(
          coalesce(
            (
              select case when p.is_active then p.role::text else 'user' end
              from public.profiles p
              where p.user_id = auth.uid()
              limit 1
            ),
            nullif(auth.jwt() ->> 'app_role', ''),
            nullif(auth.jwt() -> 'app_metadata' ->> 'app_role', ''),
            'user'
          )
        )
      else 'user'
    end;
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = private, public, auth
as $$
  select private.current_app_role() = 'admin';
$$;

create or replace function private.is_seller_or_admin()
returns boolean
language sql
stable
security definer
set search_path = private, public, auth
as $$
  select private.current_app_role() in ('admin', 'seller');
$$;

revoke all on function private.current_app_role() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.is_seller_or_admin() from public;
grant execute on function private.current_app_role() to anon, authenticated, service_role;
grant execute on function private.is_admin() to anon, authenticated, service_role;
grant execute on function private.is_seller_or_admin() to anon, authenticated, service_role;

create or replace function public.current_app_role()
returns text
language sql
stable
security invoker
set search_path = private, public, auth
as $$
  select private.current_app_role();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = private, public, auth
as $$
  select private.is_admin();
$$;

create or replace function public.is_seller_or_admin()
returns boolean
language sql
stable
security invoker
set search_path = private, public, auth
as $$
  select private.is_seller_or_admin();
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_seller_or_admin() from public;
grant execute on function public.current_app_role() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_seller_or_admin() to anon, authenticated, service_role;

alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.ensure_bicycle_parent_type() set search_path = public, pg_temp;
alter function public.ensure_part_parent_type() set search_path = public, pg_temp;
alter function public.ensure_attribute_value_category_match() set search_path = public, pg_temp;
alter function public.enforce_catalog_item_status_transition() set search_path = public, pg_temp;
alter function public.prevent_hard_delete_catalog_items() set search_path = public, pg_temp;
alter function public.prevent_hard_delete_attributes() set search_path = public, pg_temp;
alter function public.enforce_reservation_state() set search_path = public, pg_temp;
alter function public.sync_item_status_from_reservation() set search_path = public, pg_temp;
alter function public.apply_sale_effects() set search_path = public, pg_temp;
alter function public.enforce_sales_edit_window() set search_path = public, pg_temp;
alter function public.log_sale_correction() set search_path = public, pg_temp;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.ensure_bicycle_parent_type() from public, anon, authenticated;
revoke all on function public.ensure_part_parent_type() from public, anon, authenticated;
revoke all on function public.ensure_attribute_value_category_match() from public, anon, authenticated;
revoke all on function public.enforce_catalog_item_status_transition() from public, anon, authenticated;
revoke all on function public.prevent_hard_delete_catalog_items() from public, anon, authenticated;
revoke all on function public.prevent_hard_delete_attributes() from public, anon, authenticated;
revoke all on function public.enforce_reservation_state() from public, anon, authenticated;
revoke all on function public.sync_item_status_from_reservation() from public, anon, authenticated;
revoke all on function public.apply_sale_effects() from public, anon, authenticated;
revoke all on function public.enforce_sales_edit_window() from public, anon, authenticated;
revoke all on function public.log_sale_correction() from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
revoke all on function public.clear_archived_catalog_item(uuid) from public, anon, authenticated;
grant execute on function public.clear_archived_catalog_item(uuid) to service_role;

do $$
declare
  app_table text;
begin
  foreach app_table in array array[
    'app_settings',
    'attribute_options',
    'attributes',
    'audit_logs',
    'bicycles',
    'catalog_items',
    'item_attribute_values',
    'parts',
    'product_images',
    'profiles',
    'reservations',
    'sales'
  ]
  loop
    execute format(
      'revoke all privileges on table public.%I from public, anon, authenticated',
      app_table
    );
  end loop;
end
$$;

grant select on public.app_settings to anon, authenticated;
grant select on public.attribute_options to anon, authenticated;
grant select on public.attributes to anon, authenticated;
grant select on public.bicycles to anon, authenticated;
grant select on public.catalog_items to anon, authenticated;
grant select on public.item_attribute_values to anon, authenticated;
grant select on public.parts to anon, authenticated;
grant select on public.product_images to anon, authenticated;

grant select on public.audit_logs to authenticated;
grant select on public.profiles to authenticated;
grant select on public.reservations to authenticated;
grant select on public.sales to authenticated;

grant insert, update on public.app_settings to authenticated;
grant insert, update on public.attribute_options to authenticated;
grant insert, update on public.attributes to authenticated;
grant insert, update on public.audit_logs to authenticated;
grant insert, update on public.bicycles to authenticated;
grant insert, update on public.catalog_items to authenticated;
grant insert, update on public.item_attribute_values to authenticated;
grant insert, update on public.parts to authenticated;
grant insert, update on public.product_images to authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update on public.reservations to authenticated;
grant insert, update on public.sales to authenticated;

notify pgrst, 'reload schema';