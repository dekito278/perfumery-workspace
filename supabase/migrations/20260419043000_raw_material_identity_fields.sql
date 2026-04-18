alter table public.raw_materials
    add column if not exists cas_number text,
    add column if not exists charge_number text;

alter table public.raw_materials
    drop constraint if exists raw_materials_cas_number_not_blank;

alter table public.raw_materials
    add constraint raw_materials_cas_number_not_blank
    check (cas_number is null or char_length(trim(cas_number)) > 0);

alter table public.raw_materials
    drop constraint if exists raw_materials_charge_number_not_blank;

alter table public.raw_materials
    add constraint raw_materials_charge_number_not_blank
    check (charge_number is null or char_length(trim(charge_number)) > 0);
