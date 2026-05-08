do $$
declare
  duplicate_count integer := 0;
begin
  create temp table raw_material_duplicate_cleanup on commit drop as
  with normalized_raw_materials as (
    select
      raw_material.id,
      raw_material.user_id,
      raw_material.name,
      trim(regexp_replace(
        regexp_replace(
          regexp_replace(lower(raw_material.name), 'undiliuted|undiliute', 'undiluted', 'g'),
          '[^a-z0-9]+',
          ' ',
          'g'
        ),
        '\s+',
        ' ',
        'g'
      )) as normalized_name,
      (
        case when coalesce(raw_material.data_status, 'active') = 'active' then 64 else 0 end
        + case when coalesce(raw_material.data_status, 'active') = 'archived' then -128 else 0 end
        + case when coalesce(raw_material.stock_quantity, 0) > 0 then 32 else 0 end
        + case when coalesce(raw_material.cost_per_unit, 0) > 0 then 16 else 0 end
        + case when nullif(trim(coalesce(raw_material.workbook_code, '')), '') is not null then 8 else 0 end
        + case when nullif(trim(coalesce(raw_material.cas_number, '')), '') is not null then 8 else 0 end
        + case when raw_material.reference_impact is not null then 4 else 0 end
        + case when raw_material.reference_life_hours is not null then 4 else 0 end
        + case when raw_material.ifra_limit is not null then 2 else 0 end
      ) as keeper_score,
      raw_material.updated_at,
      raw_material.created_at
    from public.raw_materials as raw_material
  ),
  ranked_raw_materials as (
    select
      normalized_raw_materials.*,
      first_value(id) over (
        partition by user_id, normalized_name
        order by keeper_score desc, updated_at desc nulls last, created_at desc nulls last, id
      ) as keeper_id,
      row_number() over (
        partition by user_id, normalized_name
        order by keeper_score desc, updated_at desc nulls last, created_at desc nulls last, id
      ) as row_number_in_group,
      count(*) over (partition by user_id, normalized_name) as duplicate_group_count
    from normalized_raw_materials
    where normalized_name <> ''
  )
  select
    id as duplicate_id,
    keeper_id
  from ranked_raw_materials
  where duplicate_group_count > 1
    and row_number_in_group > 1
    and id <> keeper_id;

  select count(*) into duplicate_count from raw_material_duplicate_cleanup;

  delete from public.brief_material_shortlists as shortlist
  using raw_material_duplicate_cleanup as duplicate_map
  where shortlist.raw_material_id = duplicate_map.duplicate_id
    and exists (
      select 1
      from public.brief_material_shortlists as keeper_shortlist
      where keeper_shortlist.brief_id = shortlist.brief_id
        and keeper_shortlist.raw_material_id = duplicate_map.keeper_id
    );

  update public.brief_material_shortlists as shortlist
  set raw_material_id = duplicate_map.keeper_id
  from raw_material_duplicate_cleanup as duplicate_map
  where shortlist.raw_material_id = duplicate_map.duplicate_id;

  delete from public.brief_project_stage_items as stage_item
  using raw_material_duplicate_cleanup as duplicate_map
  where stage_item.raw_material_id = duplicate_map.duplicate_id
    and exists (
      select 1
      from public.brief_project_stage_items as keeper_stage_item
      where keeper_stage_item.project_id = stage_item.project_id
        and keeper_stage_item.stage = stage_item.stage
        and keeper_stage_item.raw_material_id = duplicate_map.keeper_id
    );

  update public.brief_project_stage_items as stage_item
  set raw_material_id = duplicate_map.keeper_id
  from raw_material_duplicate_cleanup as duplicate_map
  where stage_item.raw_material_id = duplicate_map.duplicate_id;

  update public.formula_items as formula_item
  set item_id = duplicate_map.keeper_id
  from raw_material_duplicate_cleanup as duplicate_map
  where formula_item.item_id = duplicate_map.duplicate_id
    and formula_item.item_type in ('raw_material', 'solvent');

  update public.formula_items as formula_item
  set dilution_solvent_id = duplicate_map.keeper_id
  from raw_material_duplicate_cleanup as duplicate_map
  where formula_item.dilution_solvent_id = duplicate_map.duplicate_id;

  update public.accord_items as accord_item
  set raw_material_id = duplicate_map.keeper_id
  from raw_material_duplicate_cleanup as duplicate_map
  where accord_item.raw_material_id = duplicate_map.duplicate_id;

  update public.accord_items as accord_item
  set dilution_solvent_id = duplicate_map.keeper_id
  from raw_material_duplicate_cleanup as duplicate_map
  where accord_item.dilution_solvent_id = duplicate_map.duplicate_id;

  update public.batches as batch
  set solvent_id = duplicate_map.keeper_id
  from raw_material_duplicate_cleanup as duplicate_map
  where batch.solvent_id = duplicate_map.duplicate_id;

  update public.batch_usage_records as usage_record
  set raw_material_id = duplicate_map.keeper_id
  from raw_material_duplicate_cleanup as duplicate_map
  where usage_record.raw_material_id = duplicate_map.duplicate_id;

  update public.raw_materials as raw_material
  set dilution_solvent_id = duplicate_map.keeper_id
  from raw_material_duplicate_cleanup as duplicate_map
  where raw_material.dilution_solvent_id = duplicate_map.duplicate_id
    and raw_material.id <> duplicate_map.keeper_id;

  delete from public.raw_materials as raw_material
  using raw_material_duplicate_cleanup as duplicate_map
  where raw_material.id = duplicate_map.duplicate_id;

  raise notice 'Raw material duplicate cleanup removed % duplicate row(s).', duplicate_count;
end $$;
