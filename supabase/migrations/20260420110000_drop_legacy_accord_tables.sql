delete from public.formula_items
where item_type = 'accord';

alter table public.formula_items
    drop constraint if exists formula_items_item_type_check;

alter table public.formula_items
    add constraint formula_items_item_type_check
    check (item_type in ('raw_material', 'solvent'));

drop policy if exists "accord items select own" on public.accord_items;
drop policy if exists "accord items insert own" on public.accord_items;
drop policy if exists "accord items update own" on public.accord_items;
drop policy if exists "accord items delete own" on public.accord_items;

drop policy if exists "accords select own" on public.accords;
drop policy if exists "accords insert own" on public.accords;
drop policy if exists "accords update own" on public.accords;
drop policy if exists "accords delete own" on public.accords;

drop table if exists public.accord_items;
drop table if exists public.accords;
