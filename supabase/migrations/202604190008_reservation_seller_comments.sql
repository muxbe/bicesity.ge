-- Reservation-level seller/admin comments.

alter table public.reservations
add column if not exists seller_comment text not null default '';
