-- Fix sale trigger enum assignment.
-- The CASE expression must return public.item_status, not text.

alter table public.sales
  alter column currency_code set default 'GEL';

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
