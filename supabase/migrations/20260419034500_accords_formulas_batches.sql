create table if not exists public.accords (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    notes text,
    stock_quantity numeric(12,2) not null default 0,
    description text,
    cost_per_unit numeric(12,2) not null default 0,
    unit text not null default 'ml',
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint accords_name_not_blank check (char_length(trim(name)) > 0),
    constraint accords_stock_quantity_non_negative check (stock_quantity >= 0),
    constraint accords_cost_per_unit_non_negative check (cost_per_unit >= 0),
    constraint accords_unique_name_per_user unique (user_id, name)
);

create table if not exists public.accord_items (
    id uuid primary key default gen_random_uuid(),
    accord_id uuid not null references public.accords (id) on delete cascade,
    raw_material_id uuid not null references public.raw_materials (id) on delete restrict,
    percentage numeric(6,3) not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint accord_items_percentage_range check (percentage >= 0 and percentage <= 100)
);

create table if not exists public.formulas (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    code text not null,
    notes text,
    category text,
    status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
    version text,
    batch_size numeric(12,2),
    batch_date date,
    markup_percentage numeric(6,2) not null default 0,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint formulas_name_not_blank check (char_length(trim(name)) > 0),
    constraint formulas_code_not_blank check (char_length(trim(code)) > 0),
    constraint formulas_markup_percentage_non_negative check (markup_percentage >= 0),
    constraint formulas_batch_size_non_negative check (batch_size is null or batch_size >= 0),
    constraint formulas_unique_code_per_user unique (user_id, code)
);

create table if not exists public.formula_items (
    id uuid primary key default gen_random_uuid(),
    formula_id uuid not null references public.formulas (id) on delete cascade,
    item_type text not null check (item_type in ('raw_material', 'solvent', 'accord')),
    item_id uuid not null,
    percentage numeric(6,3) not null,
    grams numeric(12,3),
    dilution_percent numeric(6,2),
    concentrate_amount numeric(12,3),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint formula_items_percentage_range check (percentage >= 0 and percentage <= 100),
    constraint formula_items_grams_non_negative check (grams is null or grams >= 0),
    constraint formula_items_dilution_percent_range check (dilution_percent is null or (dilution_percent >= 0 and dilution_percent <= 100)),
    constraint formula_items_concentrate_amount_non_negative check (concentrate_amount is null or concentrate_amount >= 0)
);

create table if not exists public.batches (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    batch_code text not null,
    formula_id uuid not null references public.formulas (id) on delete restrict,
    solvent_id uuid references public.raw_materials (id) on delete restrict,
    target_quantity numeric(12,2) not null,
    produced_quantity numeric(12,2) not null default 0,
    production_date date not null,
    unit text not null default 'ml',
    formula_percentage numeric(6,2) not null,
    solvent_percentage numeric(6,2) not null,
    formula_quantity_needed numeric(12,2) not null,
    solvent_quantity_needed numeric(12,2) not null,
    status text not null default 'draft' check (status in ('draft', 'in_progress', 'completed')),
    notes text,
    is_stock_deducted boolean not null default false,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint batches_batch_code_not_blank check (char_length(trim(batch_code)) > 0),
    constraint batches_target_quantity_positive check (target_quantity > 0),
    constraint batches_produced_quantity_non_negative check (produced_quantity >= 0),
    constraint batches_formula_percentage_range check (formula_percentage > 0 and formula_percentage <= 100),
    constraint batches_solvent_percentage_range check (solvent_percentage >= 0 and solvent_percentage <= 100),
    constraint batches_formula_quantity_needed_non_negative check (formula_quantity_needed >= 0),
    constraint batches_solvent_quantity_needed_non_negative check (solvent_quantity_needed >= 0),
    constraint batches_unique_code_per_user unique (user_id, batch_code)
);

create table if not exists public.batch_usage_records (
    id uuid primary key default gen_random_uuid(),
    batch_id uuid not null references public.batches (id) on delete cascade,
    raw_material_id uuid not null references public.raw_materials (id) on delete restrict,
    quantity_deducted numeric(12,3) not null,
    type text not null,
    source text,
    cost numeric(12,2) not null default 0,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint batch_usage_records_quantity_positive check (quantity_deducted > 0),
    constraint batch_usage_records_cost_non_negative check (cost >= 0)
);

create index if not exists accords_user_id_idx on public.accords (user_id);
create index if not exists accord_items_accord_id_idx on public.accord_items (accord_id);
create index if not exists formulas_user_id_idx on public.formulas (user_id);
create index if not exists formula_items_formula_id_idx on public.formula_items (formula_id);
create index if not exists batches_user_id_idx on public.batches (user_id);
create index if not exists batches_formula_id_idx on public.batches (formula_id);
create index if not exists batch_usage_records_batch_id_idx on public.batch_usage_records (batch_id);
create index if not exists batch_usage_records_raw_material_id_idx on public.batch_usage_records (raw_material_id);

drop trigger if exists accords_set_updated_at on public.accords;
create trigger accords_set_updated_at before update on public.accords for each row execute function public.set_updated_at();
drop trigger if exists accord_items_set_updated_at on public.accord_items;
create trigger accord_items_set_updated_at before update on public.accord_items for each row execute function public.set_updated_at();
drop trigger if exists formulas_set_updated_at on public.formulas;
create trigger formulas_set_updated_at before update on public.formulas for each row execute function public.set_updated_at();
drop trigger if exists formula_items_set_updated_at on public.formula_items;
create trigger formula_items_set_updated_at before update on public.formula_items for each row execute function public.set_updated_at();
drop trigger if exists batches_set_updated_at on public.batches;
create trigger batches_set_updated_at before update on public.batches for each row execute function public.set_updated_at();
drop trigger if exists batch_usage_records_set_updated_at on public.batch_usage_records;
create trigger batch_usage_records_set_updated_at before update on public.batch_usage_records for each row execute function public.set_updated_at();

alter table public.accords enable row level security;
alter table public.accord_items enable row level security;
alter table public.formulas enable row level security;
alter table public.formula_items enable row level security;
alter table public.batches enable row level security;
alter table public.batch_usage_records enable row level security;

drop policy if exists "accords select own" on public.accords;
create policy "accords select own" on public.accords for select using (auth.uid() = user_id);
drop policy if exists "accords insert own" on public.accords;
create policy "accords insert own" on public.accords for insert with check (auth.uid() = user_id);
drop policy if exists "accords update own" on public.accords;
create policy "accords update own" on public.accords for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "accords delete own" on public.accords;
create policy "accords delete own" on public.accords for delete using (auth.uid() = user_id);

drop policy if exists "accord items select own" on public.accord_items;
create policy "accord items select own" on public.accord_items for select using (exists (select 1 from public.accords a where a.id = accord_id and a.user_id = auth.uid()));
drop policy if exists "accord items insert own" on public.accord_items;
create policy "accord items insert own" on public.accord_items for insert with check (exists (select 1 from public.accords a where a.id = accord_id and a.user_id = auth.uid()));
drop policy if exists "accord items update own" on public.accord_items;
create policy "accord items update own" on public.accord_items for update using (exists (select 1 from public.accords a where a.id = accord_id and a.user_id = auth.uid())) with check (exists (select 1 from public.accords a where a.id = accord_id and a.user_id = auth.uid()));
drop policy if exists "accord items delete own" on public.accord_items;
create policy "accord items delete own" on public.accord_items for delete using (exists (select 1 from public.accords a where a.id = accord_id and a.user_id = auth.uid()));

drop policy if exists "formulas select own" on public.formulas;
create policy "formulas select own" on public.formulas for select using (auth.uid() = user_id);
drop policy if exists "formulas insert own" on public.formulas;
create policy "formulas insert own" on public.formulas for insert with check (auth.uid() = user_id);
drop policy if exists "formulas update own" on public.formulas;
create policy "formulas update own" on public.formulas for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "formulas delete own" on public.formulas;
create policy "formulas delete own" on public.formulas for delete using (auth.uid() = user_id);

drop policy if exists "formula items select own" on public.formula_items;
create policy "formula items select own" on public.formula_items for select using (exists (select 1 from public.formulas f where f.id = formula_id and f.user_id = auth.uid()));
drop policy if exists "formula items insert own" on public.formula_items;
create policy "formula items insert own" on public.formula_items for insert with check (exists (select 1 from public.formulas f where f.id = formula_id and f.user_id = auth.uid()));
drop policy if exists "formula items update own" on public.formula_items;
create policy "formula items update own" on public.formula_items for update using (exists (select 1 from public.formulas f where f.id = formula_id and f.user_id = auth.uid())) with check (exists (select 1 from public.formulas f where f.id = formula_id and f.user_id = auth.uid()));
drop policy if exists "formula items delete own" on public.formula_items;
create policy "formula items delete own" on public.formula_items for delete using (exists (select 1 from public.formulas f where f.id = formula_id and f.user_id = auth.uid()));

drop policy if exists "batches select own" on public.batches;
create policy "batches select own" on public.batches for select using (auth.uid() = user_id);
drop policy if exists "batches insert own" on public.batches;
create policy "batches insert own" on public.batches for insert with check (auth.uid() = user_id);
drop policy if exists "batches update own" on public.batches;
create policy "batches update own" on public.batches for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "batches delete own" on public.batches;
create policy "batches delete own" on public.batches for delete using (auth.uid() = user_id);

drop policy if exists "batch usage records select own" on public.batch_usage_records;
create policy "batch usage records select own" on public.batch_usage_records for select using (exists (select 1 from public.batches b where b.id = batch_id and b.user_id = auth.uid()));
drop policy if exists "batch usage records insert own" on public.batch_usage_records;
create policy "batch usage records insert own" on public.batch_usage_records for insert with check (exists (select 1 from public.batches b where b.id = batch_id and b.user_id = auth.uid()));
drop policy if exists "batch usage records update own" on public.batch_usage_records;
create policy "batch usage records update own" on public.batch_usage_records for update using (exists (select 1 from public.batches b where b.id = batch_id and b.user_id = auth.uid())) with check (exists (select 1 from public.batches b where b.id = batch_id and b.user_id = auth.uid()));
drop policy if exists "batch usage records delete own" on public.batch_usage_records;
create policy "batch usage records delete own" on public.batch_usage_records for delete using (exists (select 1 from public.batches b where b.id = batch_id and b.user_id = auth.uid()));
