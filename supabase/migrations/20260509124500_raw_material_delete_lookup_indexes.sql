create index if not exists formula_items_item_type_item_id_idx
  on public.formula_items (item_type, item_id);

create index if not exists formula_items_item_id_idx
  on public.formula_items (item_id);

create index if not exists accord_items_raw_material_id_idx
  on public.accord_items (raw_material_id);

create index if not exists raw_materials_dilution_solvent_id_idx
  on public.raw_materials (dilution_solvent_id);
