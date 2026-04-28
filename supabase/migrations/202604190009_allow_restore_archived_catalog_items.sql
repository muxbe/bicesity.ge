-- Allow admin restore from deleted/archived state.
-- Hard delete is still blocked by trg_catalog_items_no_delete.

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

    if old.status = 'archived' and new.status not in ('archived', 'active', 'sold') then
      raise exception 'invalid status transition from % to %', old.status, new.status;
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
