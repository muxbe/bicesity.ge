-- Catalog discounts for admin-managed sale pricing.

begin;

alter table public.catalog_items
  add column if not exists discount_type text,
  add column if not exists discount_amount_cents integer,
  add column if not exists discount_percent_bps integer,
  add column if not exists discount_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_items_discount_type_check'
      and conrelid = 'public.catalog_items'::regclass
  ) then
    alter table public.catalog_items
      add constraint catalog_items_discount_type_check
      check (
        discount_type is null
        or discount_type in ('amount', 'percent')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_items_discount_shape_check'
      and conrelid = 'public.catalog_items'::regclass
  ) then
    alter table public.catalog_items
      add constraint catalog_items_discount_shape_check
      check (
        (
          discount_type is null
          and discount_amount_cents is null
          and discount_percent_bps is null
        )
        or
        (
          discount_type = 'amount'
          and discount_amount_cents is not null
          and discount_percent_bps is null
        )
        or
        (
          discount_type = 'percent'
          and discount_percent_bps is not null
          and discount_amount_cents is null
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_items_discount_amount_check'
      and conrelid = 'public.catalog_items'::regclass
  ) then
    alter table public.catalog_items
      add constraint catalog_items_discount_amount_check
      check (
        discount_amount_cents is null
        or (
          discount_amount_cents > 0
          and discount_amount_cents < price_cents
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_items_discount_percent_check'
      and conrelid = 'public.catalog_items'::regclass
  ) then
    alter table public.catalog_items
      add constraint catalog_items_discount_percent_check
      check (
        discount_percent_bps is null
        or (
          discount_percent_bps > 0
          and discount_percent_bps < 10000
        )
      );
  end if;
end
$$;

comment on column public.catalog_items.discount_type is
  'Discount mode: amount means fixed GEL discount, percent means percentage discount.';

comment on column public.catalog_items.discount_amount_cents is
  'Fixed discount amount in tetri. Example: 100 GEL discount = 10000.';

comment on column public.catalog_items.discount_percent_bps is
  'Percentage discount in basis points. Example: 20% = 2000.';

comment on column public.catalog_items.discount_reason is
  'Optional admin reason for the discount.';

commit;
