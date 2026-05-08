alter table public.formulas
    drop constraint if exists formulas_status_check;

alter table public.formulas
    add constraint formulas_status_check check (
        status in (
            'draft',
            'in_review',
            'approved',
            'ready_for_batch',
            'batched',
            'published_product',
            'active',
            'archived'
        )
    );

create table if not exists public.batches (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    batch_code text not null,
    formula_id uuid not null references public.formulas (id) on delete restrict,
    solvent_id uuid references public.raw_materials (id) on delete restrict,
    target_quantity numeric(12,2) not null,
    produced_quantity numeric(12,2) not null default 0,
    production_date date not null default current_date,
    unit text not null default 'ml',
    formula_percentage numeric(6,2) not null default 0,
    solvent_percentage numeric(6,2) not null default 0,
    formula_quantity_needed numeric(12,2) not null default 0,
    solvent_quantity_needed numeric(12,2) not null default 0,
    status text not null default 'planned',
    notes text,
    is_stock_deducted boolean not null default false,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint batches_batch_code_not_blank check (char_length(trim(batch_code)) > 0),
    constraint batches_target_quantity_positive check (target_quantity > 0),
    constraint batches_produced_quantity_non_negative check (produced_quantity >= 0),
    constraint batches_formula_percentage_range check (formula_percentage >= 0 and formula_percentage <= 100),
    constraint batches_solvent_percentage_range check (solvent_percentage >= 0 and solvent_percentage <= 100),
    constraint batches_formula_quantity_needed_non_negative check (formula_quantity_needed >= 0),
    constraint batches_solvent_quantity_needed_non_negative check (solvent_quantity_needed >= 0),
    constraint batches_unique_code_per_user unique (user_id, batch_code)
);

alter table public.batches
    drop constraint if exists batches_status_check;

alter table public.batches
    add constraint batches_status_check check (
        status in (
            'planned',
            'produced',
            'qc',
            'ready_for_product',
            'converted_to_product',
            'draft',
            'in_progress',
            'completed'
        )
    );

alter table public.batches
    add column if not exists bottle_ml numeric(12,2) not null default 0,
    add column if not exists loss_percent numeric(6,2) not null default 0,
    add column if not exists usable_quantity numeric(12,2) not null default 0,
    add column if not exists bottle_count integer not null default 0,
    add column if not exists cogs_per_bottle numeric(12,2) not null default 0,
    add column if not exists selling_price numeric(12,2) not null default 0,
    add column if not exists sku text,
    add column if not exists product_id uuid references public.storefront_products (id) on delete set null;

alter table public.batches
    drop constraint if exists batches_bottle_ml_non_negative,
    drop constraint if exists batches_loss_percent_range,
    drop constraint if exists batches_usable_quantity_non_negative,
    drop constraint if exists batches_bottle_count_non_negative,
    drop constraint if exists batches_cogs_per_bottle_non_negative,
    drop constraint if exists batches_selling_price_non_negative;

alter table public.batches
    add constraint batches_bottle_ml_non_negative check (bottle_ml >= 0),
    add constraint batches_loss_percent_range check (loss_percent >= 0 and loss_percent <= 100),
    add constraint batches_usable_quantity_non_negative check (usable_quantity >= 0),
    add constraint batches_bottle_count_non_negative check (bottle_count >= 0),
    add constraint batches_cogs_per_bottle_non_negative check (cogs_per_bottle >= 0),
    add constraint batches_selling_price_non_negative check (selling_price >= 0);

create index if not exists batches_status_idx on public.batches (status);
create index if not exists batches_product_id_idx on public.batches (product_id);
create index if not exists batches_user_id_idx on public.batches (user_id);
create index if not exists batches_formula_id_idx on public.batches (formula_id);

drop trigger if exists batches_set_updated_at on public.batches;
create trigger batches_set_updated_at before update on public.batches for each row execute function public.set_updated_at();

alter table public.batches enable row level security;

drop policy if exists "batches select own" on public.batches;
create policy "batches select own" on public.batches for select using (auth.uid() = user_id);
drop policy if exists "batches insert own" on public.batches;
create policy "batches insert own" on public.batches for insert with check (auth.uid() = user_id);
drop policy if exists "batches update own" on public.batches;
create policy "batches update own" on public.batches for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "batches delete own" on public.batches;
create policy "batches delete own" on public.batches for delete using (auth.uid() = user_id);
