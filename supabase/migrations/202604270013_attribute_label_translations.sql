alter table public.attributes
  add column if not exists display_name_translations jsonb not null default '{}'::jsonb;

update public.attributes
set display_name_translations = jsonb_build_object('en', display_name)
where display_name_translations = '{}'::jsonb
   or display_name_translations is null;
