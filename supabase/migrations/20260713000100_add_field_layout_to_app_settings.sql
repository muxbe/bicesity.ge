-- Add one shared, versioned authority for core field layout and visibility.
-- The application keeps this migration unapplied until the Phase 1 rollout is approved.

alter table public.app_settings
add column if not exists field_layout_config jsonb not null default jsonb_build_object(
  'version', 1,
  'configured', false,
  'order', jsonb_build_object(),
  'coreVisibility', jsonb_build_object(
    'Bicycle', jsonb_build_object(
      'category', false,
      'name', true,
      'drive_type', true,
      'serial', false,
      'price', true,
      'discount', true,
      'stock_count', false,
      'image', true,
      'description', true,
      'rating', false
    ),
    'Parts', jsonb_build_object(
      'category', false,
      'name', true,
      'serial', false,
      'price', true,
      'discount', true,
      'stock_count', false,
      'image', true,
      'description', true,
      'rating', false
    )
  ),
  'coreLabels', jsonb_build_object(),
  'coreOptions', jsonb_build_object()
);

update public.app_settings
set field_layout_config = jsonb_build_object(
  'version', 1,
  'configured', false,
  'order', jsonb_build_object(),
  'coreVisibility', jsonb_build_object(
    'Bicycle', jsonb_build_object(
      'category', false,
      'name', true,
      'drive_type', true,
      'serial', false,
      'price', true,
      'discount', true,
      'stock_count', false,
      'image', true,
      'description', true,
      'rating', false
    ),
    'Parts', jsonb_build_object(
      'category', false,
      'name', true,
      'serial', false,
      'price', true,
      'discount', true,
      'stock_count', false,
      'image', true,
      'description', true,
      'rating', false
    )
  ),
  'coreLabels', jsonb_build_object(),
  'coreOptions', jsonb_build_object()
)
where field_layout_config is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_settings_field_layout_config_shape'
      and conrelid = 'public.app_settings'::regclass
  ) then
    alter table public.app_settings
    add constraint app_settings_field_layout_config_shape check (
      jsonb_typeof(field_layout_config) = 'object'
      and field_layout_config ->> 'version' = '1'
      and jsonb_typeof(field_layout_config -> 'order') = 'object'
      and jsonb_typeof(field_layout_config -> 'coreVisibility') = 'object'
      and jsonb_typeof(field_layout_config -> 'coreLabels') = 'object'
      and jsonb_typeof(field_layout_config -> 'coreOptions') = 'object'
    );
  end if;
end
$$;

comment on column public.app_settings.field_layout_config is
  'Versioned shared core field layout. Only verified administrators update it through the application API.';

notify pgrst, 'reload schema';
