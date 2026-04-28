-- Step 3 / Migration 001
-- Core schema for VeloHub v1 with shared base table + type extensions.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'item_type') then
    create type public.item_type as enum ('bicycle', 'part');
  end if;

  if not exists (select 1 from pg_type where typname = 'item_status') then
    create type public.item_status as enum ('active', 'reserved', 'sold', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'bicycle_drive_type') then
    create type public.bicycle_drive_type as enum ('manual', 'electrical');
  end if;

  if not exists (select 1 from pg_type where typname = 'attribute_data_type') then
    create type public.attribute_data_type as enum ('text', 'number', 'boolean', 'date', 'image', 'url');
  end if;

  if not exists (select 1 from pg_type where typname = 'reservation_status') then
    create type public.reservation_status as enum ('active', 'completed', 'cancelled', 'expired');
  end if;

  if not exists (select 1 from pg_type where typname = 'reservation_cancel_reason') then
    create type public.reservation_cancel_reason as enum (
      'customer_cancelled',
      'seller_cancelled',
      'no_show',
      'expired',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'sale_channel') then
    create type public.sale_channel as enum ('online', 'in_store', 'as_is');
  end if;

  if not exists (select 1 from pg_type where typname = 'audit_entity_type') then
    create type public.audit_entity_type as enum (
      'catalog_item',
      'attribute',
      'reservation',
      'sale',
      'product_image',
      'system'
    );
  end if;
end
$$;

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  item_type public.item_type not null,
  name text not null,
  serial_number text not null,
  price_cents integer not null check (price_cents >= 0),
  stock_count integer not null default 0 check (stock_count >= 0),
  status public.item_status not null default 'active',
  description text not null default '',
  rating numeric(2, 1),
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by_actor_id uuid,
  updated_by_actor_id uuid,
  archived_by_actor_id uuid,
  check (rating is null or (rating >= 0 and rating <= 5)),
  check ((status = 'sold' and stock_count = 0) or status <> 'sold')
);

create table if not exists public.bicycles (
  catalog_item_id uuid primary key
    references public.catalog_items(id) on update cascade on delete restrict,
  drive_type public.bicycle_drive_type not null
);

create table if not exists public.parts (
  catalog_item_id uuid primary key
    references public.catalog_items(id) on update cascade on delete restrict,
  part_kind text
);

create table if not exists public.attributes (
  id uuid primary key default gen_random_uuid(),
  category public.item_type not null,
  field_key text not null,
  display_name text not null,
  data_type public.attribute_data_type not null default 'text',
  is_public boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  validation_rules jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by_actor_id uuid,
  updated_by_actor_id uuid,
  archived_by_actor_id uuid,
  constraint attributes_category_field_key_key unique (category, field_key)
);

create table if not exists public.item_attribute_values (
  catalog_item_id uuid not null
    references public.catalog_items(id) on update cascade on delete cascade,
  attribute_id uuid not null
    references public.attributes(id) on update cascade on delete restrict,
  value_text text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by_actor_id uuid,
  updated_by_actor_id uuid,
  primary key (catalog_item_id, attribute_id)
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null
    references public.catalog_items(id) on update cascade on delete cascade,
  bucket_name text,
  object_path text,
  external_url text,
  alt_text text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by_actor_id uuid,
  updated_by_actor_id uuid,
  check (
    (
      bucket_name is not null
      and object_path is not null
      and external_url is null
    )
    or (
      bucket_name is null
      and object_path is null
      and external_url is not null
    )
  )
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null
    references public.catalog_items(id) on update cascade on delete restrict,
  status public.reservation_status not null default 'active',
  reserved_for_at timestamptz not null,
  expires_at timestamptz not null,
  note text,
  cancellation_reason_code public.reservation_cancel_reason,
  cancellation_note text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by_actor_id uuid,
  updated_by_actor_id uuid,
  check (expires_at >= reserved_for_at),
  check (
    (status = 'cancelled' and cancellation_reason_code is not null and cancelled_at is not null)
    or
    (status <> 'cancelled' and cancellation_reason_code is null and cancelled_at is null)
  ),
  check (
    (status = 'completed' and completed_at is not null)
    or
    (status <> 'completed' and completed_at is null)
  ),
  check (
    (status = 'expired' and expired_at is not null)
    or
    (status <> 'expired' and expired_at is null)
  )
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null
    references public.catalog_items(id) on update cascade on delete restrict,
  reservation_id uuid
    references public.reservations(id) on update cascade on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  sale_channel public.sale_channel not null,
  sale_price_cents integer not null check (sale_price_cents >= 0),
  currency_code char(3) not null default 'GEL',
  sold_at timestamptz not null default timezone('utc', now()),
  audit_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by_actor_id uuid,
  updated_by_actor_id uuid,
  check (char_length(currency_code) = 3)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type public.audit_entity_type not null,
  entity_id uuid not null,
  action text not null,
  note text,
  old_data jsonb,
  new_data jsonb,
  actor_id uuid,
  created_at timestamptz not null default timezone('utc', now())
);
