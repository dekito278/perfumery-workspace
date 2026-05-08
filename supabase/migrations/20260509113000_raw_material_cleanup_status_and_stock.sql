alter table public.raw_materials
  add column if not exists stock_quantity numeric(12,3) not null default 0,
  add column if not exists minimum_stock numeric(12,3) not null default 0,
  add column if not exists low_stock_threshold numeric(12,3),
  add column if not exists data_status text not null default 'active',
  add column if not exists review_notes text,
  add column if not exists archived_at timestamptz;

alter table public.raw_materials
  drop constraint if exists raw_materials_stock_quantity_non_negative,
  drop constraint if exists raw_materials_minimum_stock_non_negative,
  drop constraint if exists raw_materials_low_stock_threshold_non_negative,
  drop constraint if exists raw_materials_data_status_check;

alter table public.raw_materials
  add constraint raw_materials_stock_quantity_non_negative check (stock_quantity >= 0),
  add constraint raw_materials_minimum_stock_non_negative check (minimum_stock >= 0),
  add constraint raw_materials_low_stock_threshold_non_negative check (
    low_stock_threshold is null or low_stock_threshold >= 0
  ),
  add constraint raw_materials_data_status_check check (
    data_status in ('active', 'needs_review', 'archived')
  );

create index if not exists raw_materials_data_status_idx
  on public.raw_materials (user_id, data_status);
