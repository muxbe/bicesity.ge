-- Step 3 verification script
-- Run after applying migrations 001-003.
-- This script performs negative/edge checks and ends with ROLLBACK.

begin;

do $$
declare
  v_item_id uuid;
  v_sale_id uuid;
  v_reservation_id uuid;
begin
  -- Scratch item for validation.
  insert into public.catalog_items (
    item_type,
    name,
    serial_number,
    price_cents,
    stock_count,
    status,
    description
  )
  values (
    'bicycle',
    'Step3 Validation Bicycle',
    'STEP3-VALIDATION-001',
    100000,
    2,
    'active',
    'Scratch row for migration verification'
  )
  returning id into v_item_id;

  insert into public.bicycles (catalog_item_id, drive_type)
  values (v_item_id, 'manual');

  -- 1) Non-negative stock check.
  begin
    update public.catalog_items
    set stock_count = -1
    where id = v_item_id;
    raise exception 'Expected stock check violation was not raised';
  exception
    when check_violation then
      null;
  end;

  -- 2) One active reservation per item.
  insert into public.reservations (
    catalog_item_id,
    status,
    reserved_for_at,
    expires_at
  )
  values (
    v_item_id,
    'active',
    timezone('utc', now()) + interval '2 hours',
    timezone('utc', now()) + interval '2 hours'
  )
  returning id into v_reservation_id;

  begin
    insert into public.reservations (
      catalog_item_id,
      status,
      reserved_for_at,
      expires_at
    )
    values (
      v_item_id,
      'active',
      timezone('utc', now()) + interval '3 hours',
      timezone('utc', now()) + interval '3 hours'
    );
    raise exception 'Expected unique violation for second active reservation was not raised';
  exception
    when unique_violation then
      null;
  end;

  -- Put reservation in terminal state, then sell item.
  update public.reservations
  set
    status = 'cancelled',
    cancellation_reason_code = 'customer_cancelled',
    cancellation_note = 'verification cancel'
  where id = v_reservation_id;

  -- 3) Sale insert should decrement stock and keep invariants.
  insert into public.sales (
    catalog_item_id,
    quantity,
    sale_channel,
    sale_price_cents,
    sold_at
  )
  values (
    v_item_id,
    1,
    'online',
    100000,
    timezone('utc', now()) - interval '8 days'
  )
  returning id into v_sale_id;

  -- 4) Sold-edit window: update beyond 1 week should fail.
  begin
    update public.sales
    set
      sale_price_cents = 101000,
      audit_note = 'late correction attempt'
    where id = v_sale_id;
    raise exception 'Expected sold edit-window violation was not raised';
  exception
    when others then
      if sqlstate <> 'P0001' then
        raise;
      end if;
  end;

  -- 5) Archived status should be terminal.
  update public.catalog_items
  set status = 'archived'
  where id = v_item_id;

  begin
    update public.catalog_items
    set status = 'active'
    where id = v_item_id;
    raise exception 'Expected archived terminal transition violation was not raised';
  exception
    when others then
      if sqlstate <> 'P0001' then
        raise;
      end if;
  end;
end
$$;

rollback;

