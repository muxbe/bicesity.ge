-- Stop using user-editable user_metadata for role resolution.

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  with claims as (
    select auth.jwt() as jwt
  ),
  amr_methods as (
    select lower(
      case
        when jsonb_typeof(entry.value) = 'string' then trim(both '"' from entry.value::text)
        else entry.value ->> 'method'
      end
    ) as method
    from claims,
    jsonb_array_elements(
      case
        when jsonb_typeof(jwt -> 'amr') = 'array' then jwt -> 'amr'
        when jwt ? 'amr' then jsonb_build_array(jwt -> 'amr')
        else '[]'::jsonb
      end
    ) as entry(value)
  )
  select
    case
      when exists (select 1 from amr_methods where method = 'password') then
        lower(
          coalesce(
            (
              select case when p.is_active then p.role::text else 'user' end
              from public.profiles p
              where p.user_id = auth.uid()
              limit 1
            ),
            nullif(auth.jwt() ->> 'app_role', ''),
            nullif(auth.jwt() -> 'app_metadata' ->> 'app_role', ''),
            'user'
          )
        )
      else 'user'
    end;
$$;

grant execute on function public.current_app_role() to anon, authenticated;
