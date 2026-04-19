alter table public.accord_items
    add column if not exists dilution_percent numeric(5, 2);

alter table public.accord_items
    add column if not exists dilution_solvent_id uuid references public.raw_materials (id) on delete restrict;

alter table public.accord_items
    add column if not exists concentrate_amount numeric(12, 3);

create index if not exists accord_items_dilution_solvent_id_idx
    on public.accord_items (dilution_solvent_id);
