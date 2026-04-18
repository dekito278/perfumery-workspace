alter table public.formula_items
    add column if not exists dilution_solvent_id uuid references public.raw_materials (id) on delete restrict;

create index if not exists formula_items_dilution_solvent_id_idx
    on public.formula_items (dilution_solvent_id);

delete from public.raw_material_categories
where name not in (
    'A - ALI-FAT-IC',
    'B - Berg-ICEBERG',
    'C - CITRUS',
    'D - DAIRY',
    'E - EDIBLE',
    'F - FRUIT',
    'G - GREEN',
    'H - HERB (Cool)',
    'I - IRIS',
    'J - JASMIN',
    'K - KONIFER',
    'L - LIGHT Chemical Floral',
    'M - MUGUET',
    'N - NARCOTIC',
    'O - ORCHID',
    'P - PHENOL',
    'Q - Queen of the ORIENT',
    'R - ROSE',
    'S - SPICE (Hot)',
    'T - TAR SMOKE',
    'U - Urine Faecal ANIMAL',
    'V - VANILLA',
    'W - WOOD',
    'X - X-rated MUSK',
    'Y - EARTHY MOSSY',
    'Z - ZOLVENTS'
);
