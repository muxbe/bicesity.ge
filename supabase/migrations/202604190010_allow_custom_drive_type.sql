-- Allow admin-configured bicycle drive type values.
-- Existing values remain compatible: manual -> Manual, electrical -> Electrical in the app.

alter table public.bicycles
  alter column drive_type drop default;

alter table public.bicycles
  alter column drive_type type text using drive_type::text;

alter table public.bicycles
  alter column drive_type set default 'manual';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bicycles_drive_type_not_blank'
      and conrelid = 'public.bicycles'::regclass
  ) then
    alter table public.bicycles
      add constraint bicycles_drive_type_not_blank
      check (length(trim(drive_type)) > 0);
  end if;
end
$$;
