-- Step 3 / Migration 003
-- Deterministic baseline import from current mock dataset.

insert into public.catalog_items (
  id,
  item_type,
  name,
  serial_number,
  price_cents,
  stock_count,
  status,
  description,
  rating
)
values
  (
    '00000000-0000-0000-0002-000000000001',
    'bicycle',
    'S-Works Turbo Levo',
    'SPEC-7721-EV',
    1249900,
    1,
    'active',
    'The ultimate e-MTB. Powered by a custom Specialized motor with seamless integration into a full-carbon frame.',
    4.9
  ),
  (
    '00000000-0000-0000-0002-000000000002',
    'bicycle',
    'Trek Emonda SLR 9',
    'TRK-RD-990',
    985000,
    1,
    'active',
    'The lightest production road bike ever made. Born for climbing, built for racing.',
    4.8
  ),
  (
    '00000000-0000-0000-0002-000000000003',
    'bicycle',
    'Specialized Sirrus X 4.0',
    'SPEC-CITY-22',
    185000,
    1,
    'active',
    'A summer-long of trail-ready performance. Perfect hybrid for city commuting and weekend adventures.',
    4.6
  ),
  (
    '00000000-0000-0000-0002-000000000004',
    'bicycle',
    'Canyon Aeroad CF SLX',
    'CAN-AERO-88',
    849900,
    1,
    'active',
    'The most aerodynamic bike in Canyon''s lineup. Wind-tunnel proven performance.',
    4.7
  ),
  (
    '00000000-0000-0000-0002-000000000005',
    'bicycle',
    'Giant Revolt Advanced Pro',
    'GNT-GRV-PRO',
    420000,
    0,
    'active',
    'Gravel racing machine with D-Fuse technology for all-day comfort on mixed terrain.',
    4.5
  ),
  (
    '00000000-0000-0000-0002-000000000006',
    'bicycle',
    'Riese & Muller Supercharger2',
    'RM-SC2-GT',
    699000,
    1,
    'active',
    'Premium touring e-bike with dual battery system. Up to 250km range for the ultimate adventure.',
    4.4
  ),
  (
    '00000000-0000-0000-0002-000000000007',
    'part',
    'Shimano Ultegra Chain CN-HG701',
    'SH-ULT-CH-701',
    6500,
    1,
    'active',
    'Smooth shifting and exceptionally durable 11-speed chain with SIL-TEC coating.',
    4.7
  ),
  (
    '00000000-0000-0000-0002-000000000008',
    'part',
    'Continental GP5000 S TR',
    'CON-GP5K-28',
    7500,
    1,
    'active',
    'The benchmark road tire. Tubeless-ready with BlackChili compound for ultimate grip.',
    4.9
  ),
  (
    '00000000-0000-0000-0002-000000000009',
    'part',
    'SRAM Red AXS Rear Derailleur',
    'SR-RED-RD-AXS',
    58000,
    1,
    'active',
    'Wireless electronic shifting with instant, precise gear changes. Race-proven reliability.',
    4.8
  ),
  (
    '00000000-0000-0000-0002-00000000000a',
    'part',
    'Zipp 404 Firecrest Disc',
    'ZP-404-FC-D',
    210000,
    0,
    'active',
    'Deep-section carbon wheelset with Total System Efficiency. Faster in real-world conditions.',
    4.6
  ),
  (
    '00000000-0000-0000-0002-00000000000b',
    'part',
    'PRO Stealth Saddle',
    'PRO-STL-152',
    19900,
    1,
    'active',
    'Ergonomic racing saddle with pressure-relieving cutout. Used by WorldTour professionals.',
    4.5
  ),
  (
    '00000000-0000-0000-0002-00000000000c',
    'part',
    'Shimano Dura-Ace BR-R9270 Calipers',
    'SH-DA-BR-9270',
    43000,
    1,
    'active',
    'Top-tier hydraulic disc brake calipers with Servo Wave technology for unmatched stopping power.',
    4.9
  )
on conflict (id) do nothing;

insert into public.bicycles (catalog_item_id, drive_type)
values
  ('00000000-0000-0000-0002-000000000001', 'electrical'),
  ('00000000-0000-0000-0002-000000000002', 'manual'),
  ('00000000-0000-0000-0002-000000000003', 'manual'),
  ('00000000-0000-0000-0002-000000000004', 'manual'),
  ('00000000-0000-0000-0002-000000000005', 'manual'),
  ('00000000-0000-0000-0002-000000000006', 'electrical')
on conflict (catalog_item_id) do nothing;

insert into public.parts (catalog_item_id, part_kind)
values
  ('00000000-0000-0000-0002-000000000007', 'chain'),
  ('00000000-0000-0000-0002-000000000008', 'tire'),
  ('00000000-0000-0000-0002-000000000009', 'rear_derailleur'),
  ('00000000-0000-0000-0002-00000000000a', 'wheelset'),
  ('00000000-0000-0000-0002-00000000000b', 'saddle'),
  ('00000000-0000-0000-0002-00000000000c', 'brake_caliper')
on conflict (catalog_item_id) do nothing;

insert into public.attributes (
  id,
  category,
  field_key,
  display_name,
  data_type,
  is_public,
  sort_order
)
values
  (
    '00000000-0000-0000-0001-000000000001',
    'bicycle',
    'frame_material',
    'Frame Material',
    'text',
    true,
    1
  ),
  (
    '00000000-0000-0000-0001-000000000002',
    'bicycle',
    'weight',
    'Weight',
    'text',
    true,
    2
  ),
  (
    '00000000-0000-0000-0001-000000000003',
    'bicycle',
    'groupset',
    'Groupset',
    'text',
    true,
    3
  ),
  (
    '00000000-0000-0000-0001-000000000004',
    'bicycle',
    'battery_range',
    'Battery Range',
    'text',
    true,
    4
  ),
  (
    '00000000-0000-0000-0001-000000000005',
    'bicycle',
    'wheel_size',
    'Wheel Size',
    'text',
    true,
    5
  ),
  (
    '00000000-0000-0000-0001-000000000006',
    'bicycle',
    'internal_dealer_note',
    'Internal Dealer Note',
    'text',
    false,
    6
  ),
  (
    '00000000-0000-0000-0001-000000000007',
    'part',
    'compatibility',
    'Compatibility',
    'text',
    true,
    1
  ),
  (
    '00000000-0000-0000-0001-000000000008',
    'part',
    'material',
    'Material',
    'text',
    true,
    2
  ),
  (
    '00000000-0000-0000-0001-000000000009',
    'part',
    'weight',
    'Weight',
    'text',
    true,
    3
  ),
  (
    '00000000-0000-0000-0001-00000000000a',
    'part',
    'supplier_code',
    'Supplier Code',
    'text',
    false,
    4
  )
on conflict (id) do nothing;

insert into public.item_attribute_values (catalog_item_id, attribute_id, value_text)
values
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001', 'Fact 11m Carbon'),
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000002', '22.1 kg'),
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000003', 'SRAM XX1 Eagle AXS'),
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000004', '5-7 Hours / 700Wh'),
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000005', '29"'),
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000006', 'Incoming from Berlin warehouse'),

  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000001', '800 Series OCLV Carbon'),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000002', '6.75 kg'),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000003', 'Shimano Dura-Ace Di2'),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000005', '700c'),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000006', 'Needs pedal installation'),

  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000001', 'A1 Premium Aluminum'),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000002', '10.5 kg'),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000003', 'Shimano Deore'),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000005', '700c'),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000006', 'Floor model - 5% discount possible'),

  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000001', 'CF SLX Carbon'),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000002', '7.2 kg'),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000003', 'Shimano Ultegra Di2'),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000005', '700c'),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000006', 'Display model, full warranty'),

  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0001-000000000001', 'Advanced-Grade Composite'),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0001-000000000002', '8.9 kg'),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0001-000000000003', 'Shimano GRX Di2'),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0001-000000000005', '700c'),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0001-000000000006', 'Popular model - restock weekly'),

  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000001', '6061 Aluminum'),
  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000002', '28.5 kg'),
  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000003', 'Shimano Deore XT'),
  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000004', '10-14 Hours / 1125Wh Dual'),
  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000005', '27.5"'),
  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000006', 'Requires assembly - frame only in stock'),

  ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0001-000000000007', '11-Speed Shimano / SRAM'),
  ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0001-000000000008', 'Nickel-Plated Steel'),
  ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0001-000000000009', '257g'),
  ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0001-00000000000a', 'SH-CN-701-B'),

  ('00000000-0000-0000-0002-000000000008', '00000000-0000-0000-0001-000000000007', '700c x 25-32mm'),
  ('00000000-0000-0000-0002-000000000008', '00000000-0000-0000-0001-000000000008', 'BlackChili Rubber Compound'),
  ('00000000-0000-0000-0002-000000000008', '00000000-0000-0000-0001-000000000009', '235g (28mm)'),
  ('00000000-0000-0000-0002-000000000008', '00000000-0000-0000-0001-00000000000a', 'CON-GP5-TR-28'),

  ('00000000-0000-0000-0002-000000000009', '00000000-0000-0000-0001-000000000007', '12-Speed SRAM AXS'),
  ('00000000-0000-0000-0002-000000000009', '00000000-0000-0000-0001-000000000008', 'Carbon Fiber / Titanium'),
  ('00000000-0000-0000-0002-000000000009', '00000000-0000-0000-0001-000000000009', '215g'),
  ('00000000-0000-0000-0002-000000000009', '00000000-0000-0000-0001-00000000000a', 'SR-RD-RED-AXS-12'),

  ('00000000-0000-0000-0002-00000000000a', '00000000-0000-0000-0001-000000000007', 'Disc Brake, Centerlock'),
  ('00000000-0000-0000-0002-00000000000a', '00000000-0000-0000-0001-000000000008', 'Full Carbon Fiber'),
  ('00000000-0000-0000-0002-00000000000a', '00000000-0000-0000-0001-000000000009', '1,510g (pair)'),
  ('00000000-0000-0000-0002-00000000000a', '00000000-0000-0000-0001-00000000000a', 'ZP-404-FC-DB-PR'),

  ('00000000-0000-0000-0002-00000000000b', '00000000-0000-0000-0001-000000000007', 'Universal Rail Mount (7x7mm)'),
  ('00000000-0000-0000-0002-00000000000b', '00000000-0000-0000-0001-000000000008', 'Carbon Base / Stainless Rails'),
  ('00000000-0000-0000-0002-00000000000b', '00000000-0000-0000-0001-000000000009', '190g'),
  ('00000000-0000-0000-0002-00000000000b', '00000000-0000-0000-0001-00000000000a', 'PRO-SDL-STL-152'),

  ('00000000-0000-0000-0002-00000000000c', '00000000-0000-0000-0001-000000000007', 'Shimano Flat Mount'),
  ('00000000-0000-0000-0002-00000000000c', '00000000-0000-0000-0001-000000000008', 'Forged Aluminum'),
  ('00000000-0000-0000-0002-00000000000c', '00000000-0000-0000-0001-000000000009', '116g per caliper'),
  ('00000000-0000-0000-0002-00000000000c', '00000000-0000-0000-0001-00000000000a', 'SH-BR-R9270-F/R')
on conflict (catalog_item_id, attribute_id) do update
set
  value_text = excluded.value_text,
  updated_at = timezone('utc', now());

insert into public.product_images (
  id,
  catalog_item_id,
  external_url,
  alt_text,
  sort_order,
  is_primary
)
values
  (
    '00000000-0000-0000-0003-000000000001',
    '00000000-0000-0000-0002-000000000001',
    'https://images.unsplash.com/photo-1593761713314-44874730c421?q=80&w=1000&auto=format&fit=crop',
    'S-Works Turbo Levo',
    0,
    true
  ),
  (
    '00000000-0000-0000-0003-000000000002',
    '00000000-0000-0000-0002-000000000002',
    'https://images.unsplash.com/photo-1485965120184-e220f721d03e?q=80&w=1000&auto=format&fit=crop',
    'Trek Emonda SLR 9',
    0,
    true
  ),
  (
    '00000000-0000-0000-0003-000000000003',
    '00000000-0000-0000-0002-000000000003',
    'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?q=80&w=1000&auto=format&fit=crop',
    'Specialized Sirrus X 4.0',
    0,
    true
  ),
  (
    '00000000-0000-0000-0003-000000000004',
    '00000000-0000-0000-0002-000000000004',
    'https://images.unsplash.com/photo-1532298229144-0ee05051da69?q=80&w=1000&auto=format&fit=crop',
    'Canyon Aeroad CF SLX',
    0,
    true
  ),
  (
    '00000000-0000-0000-0003-000000000005',
    '00000000-0000-0000-0002-000000000005',
    'https://images.unsplash.com/photo-1571068316344-75bc76f77890?q=80&w=1000&auto=format&fit=crop',
    'Giant Revolt Advanced Pro',
    0,
    true
  ),
  (
    '00000000-0000-0000-0003-000000000006',
    '00000000-0000-0000-0002-000000000006',
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?q=80&w=1000&auto=format&fit=crop',
    'Riese & Muller Supercharger2',
    0,
    true
  ),
  (
    '00000000-0000-0000-0003-000000000007',
    '00000000-0000-0000-0002-000000000007',
    'https://images.unsplash.com/photo-1544133782-96420be44061?q=80&w=1000&auto=format&fit=crop',
    'Shimano Ultegra Chain CN-HG701',
    0,
    true
  ),
  (
    '00000000-0000-0000-0003-000000000008',
    '00000000-0000-0000-0002-000000000008',
    'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?q=80&w=1000&auto=format&fit=crop',
    'Continental GP5000 S TR',
    0,
    true
  ),
  (
    '00000000-0000-0000-0003-000000000009',
    '00000000-0000-0000-0002-000000000009',
    'https://images.unsplash.com/photo-1511994298241-608e28f14fde?q=80&w=1000&auto=format&fit=crop',
    'SRAM Red AXS Rear Derailleur',
    0,
    true
  ),
  (
    '00000000-0000-0000-0003-00000000000a',
    '00000000-0000-0000-0002-00000000000a',
    'https://images.unsplash.com/photo-1596738901637-3cc0c26624a1?q=80&w=1000&auto=format&fit=crop',
    'Zipp 404 Firecrest Disc',
    0,
    true
  ),
  (
    '00000000-0000-0000-0003-00000000000b',
    '00000000-0000-0000-0002-00000000000b',
    'https://images.unsplash.com/photo-1605965963892-1f0e2f2b8a01?q=80&w=1000&auto=format&fit=crop',
    'PRO Stealth Saddle',
    0,
    true
  ),
  (
    '00000000-0000-0000-0003-00000000000c',
    '00000000-0000-0000-0002-00000000000c',
    'https://images.unsplash.com/photo-1565278799737-b1e01a6dd5f5?q=80&w=1000&auto=format&fit=crop',
    'Shimano Dura-Ace BR-R9270 Calipers',
    0,
    true
  )
on conflict (id) do nothing;

