-- Allow the app's Clear button to permanently remove archived catalog items.
-- Normal hard deletes remain blocked; the controlled RPC below only clears
-- items that are already status = 'archived'.

create or replace function public.prevent_hard_delete_catalog_items()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.allow_catalog_item_hard_delete', true) = 'on'
     and old.status = 'archived' then
    return old;
  end if;

  raise exception 'hard delete disabled for catalog_items; use status = archived';
end;
$$;

create or replace function public.clear_archived_catalog_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.item_status;
begin
  select status
    into v_status
  from public.catalog_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Product not found.';
  end if;

  if v_status <> 'archived' then
    raise exception 'Only deleted products can be cleared.';
  end if;

  perform set_config('app.allow_catalog_item_hard_delete', 'on', true);

  delete from public.sales
  where catalog_item_id = p_item_id;

  delete from public.reservations
  where catalog_item_id = p_item_id;

  delete from public.bicycles
  where catalog_item_id = p_item_id;

  delete from public.parts
  where catalog_item_id = p_item_id;

  delete from public.item_attribute_values
  where catalog_item_id = p_item_id;

  delete from public.product_images
  where catalog_item_id = p_item_id;

  delete from public.catalog_items
  where id = p_item_id
    and status = 'archived';
end;
$$;

revoke all on function public.clear_archived_catalog_item(uuid) from public;
revoke all on function public.clear_archived_catalog_item(uuid) from anon;
revoke all on function public.clear_archived_catalog_item(uuid) from authenticated;
grant execute on function public.clear_archived_catalog_item(uuid) to service_role;

notify pgrst, 'reload schema';
