alter table public.formulas
    add column if not exists packaging_cost numeric(12,2) not null default 0,
    add column if not exists bottle_cost numeric(12,2) not null default 0,
    add column if not exists cap_cost numeric(12,2) not null default 0;

alter table public.formulas
    drop constraint if exists formulas_packaging_cost_non_negative;

alter table public.formulas
    add constraint formulas_packaging_cost_non_negative
    check (packaging_cost >= 0);

alter table public.formulas
    drop constraint if exists formulas_bottle_cost_non_negative;

alter table public.formulas
    add constraint formulas_bottle_cost_non_negative
    check (bottle_cost >= 0);

alter table public.formulas
    drop constraint if exists formulas_cap_cost_non_negative;

alter table public.formulas
    add constraint formulas_cap_cost_non_negative
    check (cap_cost >= 0);
