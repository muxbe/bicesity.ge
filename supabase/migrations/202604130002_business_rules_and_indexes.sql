-- Step 3 / Migration 002
-- Business constraints, status transition rules, and v1 indexes.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_catalog_items_set_updated_at on public.catalog_items;
create trigger trg_catalog_items_set_updated_at
before update on public.catalog_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_attributes_set_updated_at on public.attributes;
create trigger trg_attributes_set_updated_at
before update on public.attributes
for each row execute function public.set_updated_at();

drop trigger if exists trg_item_attribute_values_set_updated_at on public.item_attribute_values;
create trigger trg_item_attribute_values_set_updated_at
before update on public.item_attribute_values
for each row execute function public.set_updated_at();

drop trigger if exists trg_product_images_set_updated_at on public.product_images;
create trigger trg_product_images_set_updated_at
before update on public.product_images
for each row execute function public.set_updated_at();

drop trigger if exists trg_reservations_set_updated_at on public.reservations;
create trigger trg_reservations_set_updated_at
before update on public.reservations
for each row execute function public.set_updated_at();

drop trigger if exists trg_sales_set_updated_at on public.sales;
create trigger trg_sales_set_updated_at
before update on public.sales
for each row execute function public.set_updated_at();

create or replace function public.ensure_bicycle_parent_type()
returns trigger
language plpgsql
as $$
declare
  v_item_type public.item_type;
begin
  select item_type
  into v_item_type
  from public.catalog_items
  where id = new.catalog_item_id;

  if v_item_type is distinct from 'bicycle' then
    raise exception 'bicycles row requires catalog_items.item_type = bicycle';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bicycles_parent_type on public.bicycles;
create trigger trg_bicycles_parent_type
before insert or update on public.bicycles
for each row execute function public.ensure_bicycle_parent_type();

create or replace function public.ensure_part_parent_type()
returns trigger
language plpgsql
as $$
declare
  v_item_type public.item_type;
begin
  select item_type
  into v_item_type
  from public.catalog_items
  where id = new.catalog_item_id;

  if v_item_type is distinct from 'part' then
    raise exception 'parts row requires catalog_items.item_type = part';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_parts_parent_type on public.parts;
create trigger trg_parts_parent_type
before insert or update on public.parts
for each row execute function public.ensure_part_parent_type();

create or replace function public.ensure_attribute_value_category_match()
returns trigger
language plpgsql
as $$
declare
  v_item_type public.item_type;
  v_attribute_category public.item_type;
begin
  select item_type
  into v_item_type
  from public.catalog_items
  where id = new.catalog_item_id;

  select category
  into v_attribute_category
  from public.attributes
  where id = new.attribute_id;

  if v_item_type is distinct from v_attribute_category then
    raise exception 'attribute category (%) does not match item type (%)', v_attribute_category, v_item_type;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_item_attribute_values_category_match on public.item_attribute_values;
create trigger trg_item_attribute_values_category_match
before insert or update on public.item_attribute_values
for each row execute function public.ensure_attribute_value_category_match();

create or replace function public.enforce_catalog_item_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'sold' and new.stock_count <> 0 then
    raise exception 'sold catalog item must have stock_count = 0';
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if old.status = 'active' and new.status not in ('active', 'reserved', 'sold', 'archived') then
      raise exception 'invalid status transition from % to %', old.status, new.status;
    end if;

    if old.status = 'reserved' and new.status not in ('reserved', 'active', 'sold', 'archived') then
      raise exception 'invalid status transition from % to %', old.status, new.status;
    end if;

    if old.status = 'sold' and new.status not in ('sold', 'archived') then
      raise exception 'invalid status transition from % to %', old.status, new.status;
    end if;

    if old.status = 'archived' and new.status <> 'archived' then
      raise exception 'archived item cannot transition back to %', new.status;
    end if;
  end if;

  if new.status = 'archived' and new.archived_at is null then
    new.archived_at := timezone('utc', now());
  end if;

  if new.status <> 'archived' then
    new.archived_at := null;
    new.archived_by_actor_id := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_catalog_item_status_transition on public.catalog_items;
create trigger trg_catalog_item_status_transition
before update on public.catalog_items
for each row execute function public.enforce_catalog_item_status_transition();

create or replace function public.prevent_hard_delete_catalog_items()
returns trigger
language plpgsql
as $$
begin
  raise exception 'hard delete disabled for catalog_items; use status = archived';
end;
$$;

drop trigger if exists trg_catalog_items_no_delete on public.catalog_items;
create trigger trg_catalog_items_no_delete
before delete on public.catalog_items
for each row execute function public.prevent_hard_delete_catalog_items();

create or replace function public.prevent_hard_delete_attributes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'hard delete disabled for attributes; set archived_at instead';
end;
$$;

drop trigger if exists trg_attributes_no_delete on public.attributes;
create trigger trg_attributes_no_delete
before delete on public.attributes
for each row execute function public.prevent_hard_delete_attributes();

create or replace function public.enforce_reservation_state()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.catalog_item_id is distinct from new.catalog_item_id then
    raise exception 'catalog_item_id cannot be changed on an existing reservation';
  end if;

  if tg_op = 'INSERT' and new.expires_at is null then
    new.expires_at := new.reserved_for_at;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if old.status = 'active' and new.status not in ('active', 'completed', 'cancelled', 'expired') then
      raise exception 'invalid reservation transition from % to %', old.status, new.status;
    end if;

    if old.status in ('completed', 'cancelled', 'expired') and new.status <> old.status then
      raise exception 'reservation in terminal status % cannot transition to %', old.status, new.status;
    end if;
  end if;

  if new.status = 'active' then
    new.completed_at := null;
    new.cancelled_at := null;
    new.expired_at := null;
    new.cancellation_reason_code := null;
    new.cancellation_note := null;
  elsif new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, timezone('utc', now()));
    new.cancelled_at := null;
    new.expired_at := null;
    new.cancellation_reason_code := null;
    new.cancellation_note := null;
  elsif new.status = 'cancelled' then
    if new.cancellation_reason_code is null then
      raise exception 'cancelled reservations require cancellation_reason_code';
    end if;
    new.cancelled_at := coalesce(new.cancelled_at, timezone('utc', now()));
    new.completed_at := null;
    new.expired_at := null;
  elsif new.status = 'expired' then
    new.expired_at := coalesce(new.expired_at, timezone('utc', now()));
    new.completed_at := null;
    new.cancelled_at := null;
    new.cancellation_reason_code := null;
    new.cancellation_note := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reservations_state on public.reservations;
create trigger trg_reservations_state
before insert or update on public.reservations
for each row execute function public.enforce_reservation_state();

create or replace function public.sync_item_status_from_reservation()
returns trigger
language plpgsql
as $$
declare
  v_item_id uuid;
  v_has_active_reservation boolean;
begin
  if tg_op = 'DELETE' then
    v_item_id := old.catalog_item_id;
  else
    v_item_id := new.catalog_item_id;
  end if;

  select exists (
    select 1
    from public.reservations r
    where r.catalog_item_id = v_item_id
      and r.status = 'active'
  )
  into v_has_active_reservation;

  if v_has_active_reservation then
    update public.catalog_items
    set status = 'reserved'
    where id = v_item_id
      and status = 'active';
  else
    update public.catalog_items
    set status = 'active'
    where id = v_item_id
      and status = 'reserved';
  end if;

  return null;
end;
$$;

drop trigger if exists trg_reservations_sync_item_status_ins_upd on public.reservations;
create trigger trg_reservations_sync_item_status_ins_upd
after insert or update on public.reservations
for each row execute function public.sync_item_status_from_reservation();

drop trigger if exists trg_reservations_sync_item_status_del on public.reservations;
create trigger trg_reservations_sync_item_status_del
after delete on public.reservations
for each row execute function public.sync_item_status_from_reservation();

create or replace function public.apply_sale_effects()
returns trigger
language plpgsql
as $$
declare
  v_current_stock integer;
  v_item_status public.item_status;
begin
  select stock_count, status
  into v_current_stock, v_item_status
  from public.catalog_items
  where id = new.catalog_item_id
  for update;

  if not found then
    raise exception 'catalog item not found for sale';
  end if;

  if v_item_status = 'archived' then
    raise exception 'cannot sell archived item';
  end if;

  if new.quantity > v_current_stock then
    raise exception 'insufficient stock: requested %, available %', new.quantity, v_current_stock;
  end if;

  if new.reservation_id is null then
    select id
    into new.reservation_id
    from public.reservations
    where catalog_item_id = new.catalog_item_id
      and status = 'active'
    order by created_at desc
    limit 1;
  end if;

  update public.catalog_items
  set
    stock_count = stock_count - new.quantity,
    status = case
      when stock_count - new.quantity = 0 then 'sold'::public.item_status
      else 'active'::public.item_status
    end,
    updated_by_actor_id = coalesce(new.updated_by_actor_id, new.created_by_actor_id, updated_by_actor_id)
  where id = new.catalog_item_id;

  update public.reservations
  set
    status = 'completed',
    completed_at = coalesce(completed_at, timezone('utc', now())),
    updated_by_actor_id = coalesce(new.updated_by_actor_id, new.created_by_actor_id, updated_by_actor_id)
  where catalog_item_id = new.catalog_item_id
    and status = 'active';

  return new;
end;
$$;

drop trigger if exists trg_sales_apply_effects on public.sales;
create trigger trg_sales_apply_effects
before insert on public.sales
for each row execute function public.apply_sale_effects();

create or replace function public.enforce_sales_edit_window()
returns trigger
language plpgsql
as $$
declare
  v_data_changed boolean;
begin
  if timezone('utc', now()) > old.sold_at + interval '7 days' then
    raise exception 'sale record is immutable after 7 days from sold_at';
  end if;

  v_data_changed :=
    new.sale_channel is distinct from old.sale_channel
    or new.sale_price_cents is distinct from old.sale_price_cents
    or new.sold_at is distinct from old.sold_at
    or new.quantity is distinct from old.quantity
    or new.currency_code is distinct from old.currency_code;

  if v_data_changed and coalesce(btrim(new.audit_note), '') = '' then
    raise exception 'audit_note is required when correcting a sold record';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sales_edit_window on public.sales;
create trigger trg_sales_edit_window
before update on public.sales
for each row execute function public.enforce_sales_edit_window();

create or replace function public.log_sale_correction()
returns trigger
language plpgsql
as $$
begin
  if
    new.sale_channel is distinct from old.sale_channel
    or new.sale_price_cents is distinct from old.sale_price_cents
    or new.sold_at is distinct from old.sold_at
    or new.quantity is distinct from old.quantity
    or new.currency_code is distinct from old.currency_code
  then
    insert into public.audit_logs (
      entity_type,
      entity_id,
      action,
      note,
      old_data,
      new_data,
      actor_id
    )
    values (
      'sale',
      new.id,
      'sale.corrected',
      new.audit_note,
      jsonb_build_object(
        'sale_channel', old.sale_channel,
        'sale_price_cents', old.sale_price_cents,
        'quantity', old.quantity,
        'currency_code', old.currency_code,
        'sold_at', old.sold_at
      ),
      jsonb_build_object(
        'sale_channel', new.sale_channel,
        'sale_price_cents', new.sale_price_cents,
        'quantity', new.quantity,
        'currency_code', new.currency_code,
        'sold_at', new.sold_at
      ),
      coalesce(new.updated_by_actor_id, new.created_by_actor_id)
    );
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sales_log_correction on public.sales;
create trigger trg_sales_log_correction
after update on public.sales
for each row execute function public.log_sale_correction();

create unique index if not exists catalog_items_serial_number_unique_idx
  on public.catalog_items (lower(serial_number));

create index if not exists catalog_items_type_status_idx
  on public.catalog_items (item_type, status);

create index if not exists catalog_items_price_idx
  on public.catalog_items (price_cents);

create index if not exists catalog_items_stock_idx
  on public.catalog_items (stock_count);

create index if not exists catalog_items_updated_at_idx
  on public.catalog_items (updated_at desc);

create unique index if not exists attributes_category_display_name_active_idx
  on public.attributes (category, lower(display_name))
  where archived_at is null;

create index if not exists attributes_category_public_sort_idx
  on public.attributes (category, is_public, sort_order);

create index if not exists item_attribute_values_attribute_idx
  on public.item_attribute_values (attribute_id);

create unique index if not exists product_images_primary_per_item_idx
  on public.product_images (catalog_item_id)
  where is_primary;

create index if not exists product_images_item_sort_idx
  on public.product_images (catalog_item_id, sort_order);

create unique index if not exists reservations_one_active_per_item_idx
  on public.reservations (catalog_item_id)
  where status = 'active';

create index if not exists reservations_status_reserved_for_idx
  on public.reservations (status, reserved_for_at);

create index if not exists reservations_item_status_idx
  on public.reservations (catalog_item_id, status);

create index if not exists sales_sold_at_idx
  on public.sales (sold_at desc);

create index if not exists sales_item_sold_at_idx
  on public.sales (catalog_item_id, sold_at desc);

create index if not exists sales_channel_sold_at_idx
  on public.sales (sale_channel, sold_at desc);

create index if not exists audit_logs_entity_created_at_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);
