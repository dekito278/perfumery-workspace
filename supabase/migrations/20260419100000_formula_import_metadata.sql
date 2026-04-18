alter table public.formulas
    add column if not exists author_name text;

alter table public.formulas
    drop constraint if exists formulas_author_name_not_blank;

alter table public.formulas
    add constraint formulas_author_name_not_blank
    check (author_name is null or char_length(trim(author_name)) > 0);

alter table public.raw_materials
    add column if not exists workbook_code text;

alter table public.raw_materials
    drop constraint if exists raw_materials_workbook_code_not_blank;

alter table public.raw_materials
    add constraint raw_materials_workbook_code_not_blank
    check (workbook_code is null or char_length(trim(workbook_code)) > 0);

create unique index if not exists raw_materials_unique_workbook_code_per_user
    on public.raw_materials (user_id, workbook_code)
    where workbook_code is not null;

alter table public.formula_items
    add column if not exists sort_order integer not null default 0;

alter table public.formula_items
    drop constraint if exists formula_items_sort_order_non_negative;

alter table public.formula_items
    add constraint formula_items_sort_order_non_negative
    check (sort_order >= 0);

create index if not exists formula_items_formula_id_sort_order_idx
    on public.formula_items (formula_id, sort_order, created_at);
