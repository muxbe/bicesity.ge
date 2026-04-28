-- Bootstrap or repair staff profile roles.
-- Replace the email and role values before running.
-- Supported roles: admin, seller

insert into public.profiles (user_id, email, full_name, role, is_active)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  'admin'::public.staff_role,
  true
from auth.users u
where u.email = 'admin@example.com'
on conflict (user_id) do update
set
  email = excluded.email,
  role = excluded.role,
  is_active = true,
  updated_at = timezone('utc', now());

insert into public.profiles (user_id, email, full_name, role, is_active)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  'seller'::public.staff_role,
  true
from auth.users u
where u.email = 'seller@example.com'
on conflict (user_id) do update
set
  email = excluded.email,
  role = excluded.role,
  is_active = true,
  updated_at = timezone('utc', now());
