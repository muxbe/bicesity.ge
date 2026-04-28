-- Structured customer context for manual/seller reservations.

alter table public.reservations
  add column if not exists customer_name text not null default '',
  add column if not exists customer_phone text not null default '',
  add column if not exists messenger_profile_url text not null default '',
  add column if not exists reservation_source text not null default 'manual';

alter table public.reservations
  drop constraint if exists reservations_source_check;

alter table public.reservations
  add constraint reservations_source_check
  check (reservation_source in ('manual', 'messenger', 'phone', 'walk_in', 'other'));

create index if not exists reservations_customer_name_idx
on public.reservations (customer_name);

create index if not exists reservations_customer_phone_idx
on public.reservations (customer_phone);
