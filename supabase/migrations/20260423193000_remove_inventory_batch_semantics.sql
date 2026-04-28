drop policy if exists "batch usage records select own" on public.batch_usage_records;
drop policy if exists "batch usage records insert own" on public.batch_usage_records;
drop policy if exists "batch usage records update own" on public.batch_usage_records;
drop policy if exists "batch usage records delete own" on public.batch_usage_records;

drop policy if exists "batches select own" on public.batches;
drop policy if exists "batches insert own" on public.batches;
drop policy if exists "batches update own" on public.batches;
drop policy if exists "batches delete own" on public.batches;

drop trigger if exists batch_usage_records_set_updated_at on public.batch_usage_records;
drop trigger if exists batches_set_updated_at on public.batches;

drop table if exists public.batch_usage_records;
drop table if exists public.batches;

alter table if exists public.raw_materials
  drop constraint if exists raw_materials_stock_quantity_non_negative,
  drop constraint if exists raw_materials_minimum_stock_non_negative,
  drop constraint if exists raw_materials_low_stock_threshold_non_negative;

alter table if exists public.raw_materials
  drop column if exists stock_quantity,
  drop column if exists minimum_stock,
  drop column if exists low_stock_threshold;
