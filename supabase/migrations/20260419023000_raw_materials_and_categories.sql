create extension if not exists pgcrypto;

create table if not exists public.raw_material_categories (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    color text not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint raw_material_categories_name_not_blank check (char_length(trim(name)) > 0),
    constraint raw_material_categories_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$'),
    constraint raw_material_categories_unique_name_per_user unique (user_id, name)
);

create table if not exists public.raw_materials (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    category text not null,
    type text not null check (type in ('material', 'solvent')),
    scent_family text,
    note_type text,
    stock_quantity numeric(12,2) not null default 0,
    unit text not null default 'ml',
    cost_per_unit numeric(12,2) not null default 0,
    supplier_name text,
    minimum_stock numeric(12,2) not null default 0,
    low_stock_threshold numeric(12,2),
    default_dilution_percent numeric(5,2),
    vendor text,
    ifra_limit numeric(5,2),
    pyramid_placement text check (pyramid_placement in ('top', 'middle', 'base')),
    dilution_info text,
    description text,
    notes text,
    is_diluted boolean not null default false,
    dilution_solvent_id uuid references public.raw_materials (id) on delete set null,
    dilution_percentage numeric(5,2),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint raw_materials_name_not_blank check (char_length(trim(name)) > 0),
    constraint raw_materials_category_not_blank check (char_length(trim(category)) > 0),
    constraint raw_materials_unit_not_blank check (char_length(trim(unit)) > 0),
    constraint raw_materials_stock_quantity_non_negative check (stock_quantity >= 0),
    constraint raw_materials_cost_per_unit_non_negative check (cost_per_unit >= 0),
    constraint raw_materials_minimum_stock_non_negative check (minimum_stock >= 0),
    constraint raw_materials_low_stock_threshold_non_negative check (
        low_stock_threshold is null or low_stock_threshold >= 0
    ),
    constraint raw_materials_default_dilution_percent_range check (
        default_dilution_percent is null or (default_dilution_percent >= 0 and default_dilution_percent <= 100)
    ),
    constraint raw_materials_ifra_limit_range check (
        ifra_limit is null or (ifra_limit >= 0 and ifra_limit <= 100)
    ),
    constraint raw_materials_dilution_percentage_range check (
        dilution_percentage is null or (dilution_percentage > 0 and dilution_percentage <= 100)
    ),
    constraint raw_materials_dilution_required_fields check (
        (is_diluted = false and dilution_solvent_id is null and dilution_percentage is null)
        or
        (is_diluted = true and dilution_solvent_id is not null and dilution_percentage is not null)
    ),
    constraint raw_materials_unique_name_per_user unique (user_id, name)
);

create index if not exists raw_material_categories_user_id_idx
    on public.raw_material_categories (user_id);

create index if not exists raw_materials_user_id_idx
    on public.raw_materials (user_id);

create index if not exists raw_materials_category_idx
    on public.raw_materials (user_id, category);

create index if not exists raw_materials_type_idx
    on public.raw_materials (user_id, type);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists raw_material_categories_set_updated_at on public.raw_material_categories;
create trigger raw_material_categories_set_updated_at
before update on public.raw_material_categories
for each row
execute function public.set_updated_at();

drop trigger if exists raw_materials_set_updated_at on public.raw_materials;
create trigger raw_materials_set_updated_at
before update on public.raw_materials
for each row
execute function public.set_updated_at();

alter table public.raw_material_categories enable row level security;
alter table public.raw_materials enable row level security;

drop policy if exists "raw material categories select own" on public.raw_material_categories;
create policy "raw material categories select own"
on public.raw_material_categories
for select
using (auth.uid() = user_id);

drop policy if exists "raw material categories insert own" on public.raw_material_categories;
create policy "raw material categories insert own"
on public.raw_material_categories
for insert
with check (auth.uid() = user_id);

drop policy if exists "raw material categories update own" on public.raw_material_categories;
create policy "raw material categories update own"
on public.raw_material_categories
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "raw material categories delete own" on public.raw_material_categories;
create policy "raw material categories delete own"
on public.raw_material_categories
for delete
using (auth.uid() = user_id);

drop policy if exists "raw materials select own" on public.raw_materials;
create policy "raw materials select own"
on public.raw_materials
for select
using (auth.uid() = user_id);

drop policy if exists "raw materials insert own" on public.raw_materials;
create policy "raw materials insert own"
on public.raw_materials
for insert
with check (auth.uid() = user_id);

drop policy if exists "raw materials update own" on public.raw_materials;
create policy "raw materials update own"
on public.raw_materials
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "raw materials delete own" on public.raw_materials;
create policy "raw materials delete own"
on public.raw_materials
for delete
using (auth.uid() = user_id);

insert into public.raw_material_categories (user_id, name, color)
select
    users.id,
    seed.name,
    seed.color
from auth.users as users
cross join (
    values
        ('Floral', '#FFB6D9'),
        ('Amber', '#D8A55A'),
        ('Woody', '#8B5E3C'),
        ('Citrus', '#FFD166'),
        ('Musk', '#C9C9C9'),
        ('Fruity', '#FF8FA3'),
        ('Green', '#7BC47F'),
        ('Gourmand', '#B08968'),
        ('Spicy', '#D97706'),
        ('Resinous', '#7C3AED'),
        ('Solvent', '#60A5FA')
) as seed(name, color)
on conflict (user_id, name) do nothing;
