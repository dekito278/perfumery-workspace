-- Raw material duplicate merge plan
-- user_id: 09a06d15-d0bb-4706-ad61-c857076b2df0
-- generated_at: 2026-04-21T04:25:06.911Z
-- ready_actions: 1
-- skipped_actions: 111

begin;
-- missing-import-3-1: Dihydrojasmone -> Dihydro Jasmone
update public.raw_materials as master
set
    cas_number = coalesce(nullif(master.cas_number, ''), nullif(duplicate.cas_number, '')),
    ifra_limit = coalesce(nullif(master.ifra_limit, 0), nullif(duplicate.ifra_limit, 0)),
    scent_family = coalesce(nullif(master.scent_family, ''), nullif(duplicate.scent_family, '')),
    reference_abc_primary_family = coalesce(nullif(master.reference_abc_primary_family, ''), nullif(duplicate.reference_abc_primary_family, '')),
    reference_impact = coalesce(nullif(master.reference_impact, 0), nullif(duplicate.reference_impact, 0)),
    reference_life_hours = coalesce(nullif(master.reference_life_hours, 0), nullif(duplicate.reference_life_hours, 0)),
    reference_use_level_typical_percent = coalesce(nullif(master.reference_use_level_typical_percent, 0), nullif(duplicate.reference_use_level_typical_percent, 0)),
    reference_use_level_max_percent = coalesce(nullif(master.reference_use_level_max_percent, 0), nullif(duplicate.reference_use_level_max_percent, 0)),
    vendor = coalesce(nullif(master.vendor, ''), nullif(duplicate.vendor, '')),
    supplier_name = coalesce(nullif(master.supplier_name, ''), nullif(duplicate.supplier_name, '')),
    unit = coalesce(nullif(master.unit, ''), nullif(duplicate.unit, '')),
    description = coalesce(nullif(master.description, ''), nullif(duplicate.description, '')),
    cost_per_unit = case
      when 'missing_import_synonym' = 'high_confidence_merge' and coalesce(duplicate.cost_per_unit, 0) > 0 then duplicate.cost_per_unit
      else coalesce(nullif(master.cost_per_unit, 0), nullif(duplicate.cost_per_unit, 0), master.cost_per_unit)
    end,
    stock_quantity = case
      when coalesce(master.stock_quantity, 0) > 0 then master.stock_quantity
      else coalesce(nullif(duplicate.stock_quantity, 0), master.stock_quantity)
    end,
    notes = trim(both from concat_ws(E'\n', nullif(master.notes, ''), 'Merged duplicate raw material "Dihydrojasmone" (00ad8297-3af7-49a1-a341-ef4643ddd866) into "Dihydro Jasmone" (b5271771-b156-46d4-a297-61affd1916b2) via missing_import_synonym.', 'Merge source: missing_import_synonym:missing-import-3-1'))
from public.raw_materials as duplicate
where master.id = 'b5271771-b156-46d4-a297-61affd1916b2'::uuid
  and duplicate.id = '00ad8297-3af7-49a1-a341-ef4643ddd866'::uuid;

update public.material_reference_profiles
set source_raw_material_id = 'b5271771-b156-46d4-a297-61affd1916b2'::uuid
where source_kind = 'manual'
  and source_raw_material_id = '00ad8297-3af7-49a1-a341-ef4643ddd866'::uuid
  and not exists (
    select 1
    from public.material_reference_profiles as existing_manual
    where existing_manual.source_kind = 'manual'
      and existing_manual.source_raw_material_id = 'b5271771-b156-46d4-a297-61affd1916b2'::uuid
  );

delete from public.raw_material_reference_links as duplicate_primary
where duplicate_primary.raw_material_id = '00ad8297-3af7-49a1-a341-ef4643ddd866'::uuid
  and duplicate_primary.is_primary = true
  and exists (
    select 1
    from public.raw_material_reference_links as master_primary
    where master_primary.raw_material_id = 'b5271771-b156-46d4-a297-61affd1916b2'::uuid
      and master_primary.is_primary = true
  );

update public.raw_material_reference_links
set raw_material_id = 'b5271771-b156-46d4-a297-61affd1916b2'::uuid
where raw_material_id = '00ad8297-3af7-49a1-a341-ef4643ddd866'::uuid;

update public.accord_items
set raw_material_id = 'b5271771-b156-46d4-a297-61affd1916b2'::uuid
where raw_material_id = '00ad8297-3af7-49a1-a341-ef4643ddd866'::uuid;

update public.formula_items
set item_id = 'b5271771-b156-46d4-a297-61affd1916b2'::uuid
where item_id = '00ad8297-3af7-49a1-a341-ef4643ddd866'::uuid
  and item_type in ('raw_material', 'solvent');

update public.batches
set solvent_id = 'b5271771-b156-46d4-a297-61affd1916b2'::uuid
where solvent_id = '00ad8297-3af7-49a1-a341-ef4643ddd866'::uuid;

update public.batch_usage_records
set raw_material_id = 'b5271771-b156-46d4-a297-61affd1916b2'::uuid
where raw_material_id = '00ad8297-3af7-49a1-a341-ef4643ddd866'::uuid;

update public.raw_materials
set dilution_solvent_id = 'b5271771-b156-46d4-a297-61affd1916b2'::uuid
where dilution_solvent_id = '00ad8297-3af7-49a1-a341-ef4643ddd866'::uuid;

delete from public.raw_materials
where id = '00ad8297-3af7-49a1-a341-ef4643ddd866'::uuid;
commit;

