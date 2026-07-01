-- Preserve audit notes and reason metadata on expired reservations.
--
-- The original reservation state trigger treated expired reservations like
-- completed reservations and cleared cancellation metadata on every update.
-- That wiped automatic expiry notes and staff resolution notes.

alter table public.reservations
  drop constraint if exists reservations_terminal_state_check;

do $$
declare
  v_constraint_name text;
begin
  for v_constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.reservations'::regclass
      and contype = 'c'
      and (
        (
          pg_get_constraintdef(oid) ilike '%cancellation_reason_code%'
          and pg_get_constraintdef(oid) ilike '%cancelled_at%'
        )
        or (
          pg_get_constraintdef(oid) ilike '%completed_at%'
          and pg_get_constraintdef(oid) ilike '%completed%'
        )
        or (
          pg_get_constraintdef(oid) ilike '%expired_at%'
          and pg_get_constraintdef(oid) ilike '%expired%'
        )
      )
  loop
    execute format('alter table public.reservations drop constraint %I', v_constraint_name);
  end loop;
end
$$;

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
    new.cancellation_reason_code := coalesce(
      new.cancellation_reason_code,
      'expired'::public.reservation_cancel_reason
    );
  end if;

  return new;
end;
$$;

update public.reservations
set
  cancellation_reason_code = coalesce(
    cancellation_reason_code,
    'expired'::public.reservation_cancel_reason
  ),
  cancellation_note = coalesce(cancellation_note, 'Automatically expired.')
where status = 'expired';

alter table public.reservations
  add constraint reservations_terminal_state_check
  check (
    (
      status = 'active'
      and completed_at is null
      and cancelled_at is null
      and expired_at is null
      and cancellation_reason_code is null
      and cancellation_note is null
    )
    or
    (
      status = 'completed'
      and completed_at is not null
      and cancelled_at is null
      and expired_at is null
      and cancellation_reason_code is null
      and cancellation_note is null
    )
    or
    (
      status = 'cancelled'
      and completed_at is null
      and cancelled_at is not null
      and expired_at is null
      and cancellation_reason_code is not null
    )
    or
    (
      status = 'expired'
      and completed_at is null
      and cancelled_at is null
      and expired_at is not null
      and cancellation_reason_code = 'expired'
    )
  );

notify pgrst, 'reload schema';
