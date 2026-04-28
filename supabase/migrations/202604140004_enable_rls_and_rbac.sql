-- Step 4 / Migration 004
-- Enable RLS and RBAC policies for admin/seller/user access.
--
-- Role source:
-- 1) auth.jwt() ->> 'app_role'
-- 2) auth.jwt() -> 'app_metadata' ->> 'app_role'
-- 3) auth.jwt() -> 'user_metadata' ->> 'app_role'
-- Fallback role: user

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select lower(
    coalesce(
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
as $$
  select public.current_app_role() = 'admin';
$$;

create or replace function public.is_seller_or_admin()
returns boolean
language sql
stable
as $$
  select public.current_app_role() in ('admin', 'seller');
$$;

grant execute on function public.current_app_role() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_seller_or_admin() to anon, authenticated;

grant select on public.catalog_items to anon, authenticated;
grant select on public.bicycles to anon, authenticated;
grant select on public.parts to anon, authenticated;
grant select on public.attributes to anon, authenticated;
grant select on public.item_attribute_values to anon, authenticated;
grant select on public.product_images to anon, authenticated;

grant select on public.reservations to authenticated;
grant select on public.sales to authenticated;
grant select on public.audit_logs to authenticated;

grant insert, update on public.catalog_items to authenticated;
grant insert, update on public.bicycles to authenticated;
grant insert, update on public.parts to authenticated;
grant insert, update on public.attributes to authenticated;
grant insert, update on public.item_attribute_values to authenticated;
grant insert, update on public.product_images to authenticated;
grant insert, update on public.reservations to authenticated;
grant insert, update on public.sales to authenticated;
grant insert, update on public.audit_logs to authenticated;

alter table public.catalog_items enable row level security;
alter table public.bicycles enable row level security;
alter table public.parts enable row level security;
alter table public.attributes enable row level security;
alter table public.item_attribute_values enable row level security;
alter table public.product_images enable row level security;
alter table public.reservations enable row level security;
alter table public.sales enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists catalog_items_select_policy on public.catalog_items;
drop policy if exists catalog_items_insert_policy on public.catalog_items;
drop policy if exists catalog_items_update_policy on public.catalog_items;

create policy catalog_items_select_policy
on public.catalog_items
for select
to anon, authenticated
using (
  status <> 'archived'
  or public.is_seller_or_admin()
);

create policy catalog_items_insert_policy
on public.catalog_items
for insert
to authenticated
with check (public.is_seller_or_admin());

create policy catalog_items_update_policy
on public.catalog_items
for update
to authenticated
using (public.is_seller_or_admin())
with check (public.is_seller_or_admin());

drop policy if exists bicycles_select_policy on public.bicycles;
drop policy if exists bicycles_insert_policy on public.bicycles;
drop policy if exists bicycles_update_policy on public.bicycles;

create policy bicycles_select_policy
on public.bicycles
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.catalog_items ci
    where ci.id = bicycles.catalog_item_id
      and (ci.status <> 'archived' or public.is_seller_or_admin())
  )
);

create policy bicycles_insert_policy
on public.bicycles
for insert
to authenticated
with check (public.is_seller_or_admin());

create policy bicycles_update_policy
on public.bicycles
for update
to authenticated
using (public.is_seller_or_admin())
with check (public.is_seller_or_admin());

drop policy if exists parts_select_policy on public.parts;
drop policy if exists parts_insert_policy on public.parts;
drop policy if exists parts_update_policy on public.parts;

create policy parts_select_policy
on public.parts
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.catalog_items ci
    where ci.id = parts.catalog_item_id
      and (ci.status <> 'archived' or public.is_seller_or_admin())
  )
);

create policy parts_insert_policy
on public.parts
for insert
to authenticated
with check (public.is_seller_or_admin());

create policy parts_update_policy
on public.parts
for update
to authenticated
using (public.is_seller_or_admin())
with check (public.is_seller_or_admin());

drop policy if exists attributes_select_policy on public.attributes;
drop policy if exists attributes_insert_policy on public.attributes;
drop policy if exists attributes_update_policy on public.attributes;

create policy attributes_select_policy
on public.attributes
for select
to anon, authenticated
using (
  archived_at is null
  and (
    is_public
    or public.is_seller_or_admin()
  )
);

create policy attributes_insert_policy
on public.attributes
for insert
to authenticated
with check (public.is_admin());

create policy attributes_update_policy
on public.attributes
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists item_attribute_values_select_policy on public.item_attribute_values;
drop policy if exists item_attribute_values_insert_policy on public.item_attribute_values;
drop policy if exists item_attribute_values_update_policy on public.item_attribute_values;

create policy item_attribute_values_select_policy
on public.item_attribute_values
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.catalog_items ci
    join public.attributes a
      on a.id = item_attribute_values.attribute_id
    where ci.id = item_attribute_values.catalog_item_id
      and ci.status <> 'archived'
      and a.archived_at is null
      and (
        a.is_public
        or public.is_seller_or_admin()
      )
  )
  or public.is_seller_or_admin()
);

create policy item_attribute_values_insert_policy
on public.item_attribute_values
for insert
to authenticated
with check (public.is_seller_or_admin());

create policy item_attribute_values_update_policy
on public.item_attribute_values
for update
to authenticated
using (public.is_seller_or_admin())
with check (public.is_seller_or_admin());

drop policy if exists product_images_select_policy on public.product_images;
drop policy if exists product_images_insert_policy on public.product_images;
drop policy if exists product_images_update_policy on public.product_images;

create policy product_images_select_policy
on public.product_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.catalog_items ci
    where ci.id = product_images.catalog_item_id
      and (ci.status <> 'archived' or public.is_seller_or_admin())
  )
);

create policy product_images_insert_policy
on public.product_images
for insert
to authenticated
with check (public.is_seller_or_admin());

create policy product_images_update_policy
on public.product_images
for update
to authenticated
using (public.is_seller_or_admin())
with check (public.is_seller_or_admin());

drop policy if exists reservations_select_policy on public.reservations;
drop policy if exists reservations_insert_policy on public.reservations;
drop policy if exists reservations_update_policy on public.reservations;

create policy reservations_select_policy
on public.reservations
for select
to authenticated
using (public.is_seller_or_admin());

create policy reservations_insert_policy
on public.reservations
for insert
to authenticated
with check (public.is_seller_or_admin());

create policy reservations_update_policy
on public.reservations
for update
to authenticated
using (public.is_seller_or_admin())
with check (public.is_seller_or_admin());

drop policy if exists sales_select_policy on public.sales;
drop policy if exists sales_insert_policy on public.sales;
drop policy if exists sales_update_policy on public.sales;

create policy sales_select_policy
on public.sales
for select
to authenticated
using (public.is_admin());

create policy sales_insert_policy
on public.sales
for insert
to authenticated
with check (public.is_seller_or_admin());

create policy sales_update_policy
on public.sales
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists audit_logs_select_policy on public.audit_logs;
drop policy if exists audit_logs_insert_policy on public.audit_logs;

create policy audit_logs_select_policy
on public.audit_logs
for select
to authenticated
using (public.is_admin());

create policy audit_logs_insert_policy
on public.audit_logs
for insert
to authenticated
with check (public.is_seller_or_admin());

