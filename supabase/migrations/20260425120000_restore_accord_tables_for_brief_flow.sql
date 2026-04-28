create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create table if not exists public.accords (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    notes text,
    stock_quantity numeric(12,2) not null default 0,
    description text,
    cost_per_unit numeric(12,2) not null default 0,
    unit text not null default 'ml',
    brief_id uuid references public.briefs (id) on delete set null,
    author_name text,
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
    stage text,
    project_role text,
    dilution_percent numeric(6,2),
    dilution_solvent_id uuid references public.raw_materials (id) on delete restrict,
    concentrate_amount numeric(12,3),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint accord_items_percentage_range check (percentage >= 0 and percentage <= 100),
    constraint accord_items_stage_check check (stage is null or stage in ('top', 'middle', 'base')),
    constraint accord_items_dilution_percent_range check (dilution_percent is null or (dilution_percent >= 0 and dilution_percent <= 100)),
    constraint accord_items_concentrate_amount_non_negative check (concentrate_amount is null or concentrate_amount >= 0)
);

create index if not exists accords_user_id_idx on public.accords (user_id);
create index if not exists accords_brief_id_idx on public.accords (brief_id);
create index if not exists accord_items_accord_id_idx on public.accord_items (accord_id);
create index if not exists accord_items_dilution_solvent_id_idx on public.accord_items (dilution_solvent_id);

drop trigger if exists accords_set_updated_at on public.accords;
create trigger accords_set_updated_at
before update on public.accords
for each row
execute function public.set_updated_at();

drop trigger if exists accord_items_set_updated_at on public.accord_items;
create trigger accord_items_set_updated_at
before update on public.accord_items
for each row
execute function public.set_updated_at();

alter table public.accords enable row level security;
alter table public.accord_items enable row level security;

drop policy if exists "accords select own" on public.accords;
create policy "accords select own"
on public.accords
for select
using (auth.uid() = user_id);

drop policy if exists "accords insert own" on public.accords;
create policy "accords insert own"
on public.accords
for insert
with check (auth.uid() = user_id);

drop policy if exists "accords update own" on public.accords;
create policy "accords update own"
on public.accords
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "accords delete own" on public.accords;
create policy "accords delete own"
on public.accords
for delete
using (auth.uid() = user_id);

drop policy if exists "accord items select own" on public.accord_items;
create policy "accord items select own"
on public.accord_items
for select
using (
    exists (
        select 1
        from public.accords accord_row
        where accord_row.id = accord_items.accord_id
          and accord_row.user_id = auth.uid()
    )
);

drop policy if exists "accord items insert own" on public.accord_items;
create policy "accord items insert own"
on public.accord_items
for insert
with check (
    exists (
        select 1
        from public.accords accord_row
        where accord_row.id = accord_items.accord_id
          and accord_row.user_id = auth.uid()
    )
);

drop policy if exists "accord items update own" on public.accord_items;
create policy "accord items update own"
on public.accord_items
for update
using (
    exists (
        select 1
        from public.accords accord_row
        where accord_row.id = accord_items.accord_id
          and accord_row.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.accords accord_row
        where accord_row.id = accord_items.accord_id
          and accord_row.user_id = auth.uid()
    )
);

drop policy if exists "accord items delete own" on public.accord_items;
create policy "accord items delete own"
on public.accord_items
for delete
using (
    exists (
        select 1
        from public.accords accord_row
        where accord_row.id = accord_items.accord_id
          and accord_row.user_id = auth.uid()
    )
);
