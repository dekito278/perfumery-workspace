with workbook_material_seed as (
    select
        users.id as user_id,
        profile.reference_code as workbook_code,
        profile.name,
        case upper(coalesce(profile.abc_primary_letter, ''))
            when 'A' then 'A - ALI-FAT-IC'
            when 'B' then 'B - Berg-ICEBERG'
            when 'C' then 'C - CITRUS'
            when 'D' then 'D - DAIRY'
            when 'E' then 'E - EDIBLE'
            when 'F' then 'F - FRUIT'
            when 'G' then 'G - GREEN'
            when 'H' then 'H - HERB (Cool)'
            when 'I' then 'I - IRIS'
            when 'J' then 'J - JASMIN'
            when 'K' then 'K - KONIFER'
            when 'L' then 'L - LIGHT Chemical Floral'
            when 'M' then 'M - MUGUET'
            when 'N' then 'N - NARCOTIC'
            when 'O' then 'O - ORCHID'
            when 'P' then 'P - PHENOL'
            when 'Q' then 'Q - Queen of the ORIENT'
            when 'R' then 'R - ROSE'
            when 'S' then 'S - SPICE (Hot)'
            when 'T' then 'T - TAR SMOKE'
            when 'U' then 'U - Urine Faecal ANIMAL'
            when 'V' then 'V - VANILLA'
            when 'W' then 'W - WOOD'
            when 'X' then 'X - X-rated MUSK'
            when 'Y' then 'Y - EARTHY MOSSY'
            when 'Z' then 'Z - ZOLVENTS'
            else 'L - LIGHT Chemical Floral'
        end as category,
        case upper(coalesce(profile.abc_primary_letter, ''))
            when 'Z' then 'solvent'
            else 'material'
        end as type,
        case upper(coalesce(profile.abc_primary_letter, ''))
            when 'A' then 'Fatty'
            when 'B' then 'Fresh'
            when 'C' then 'Citrus'
            when 'D' then 'Dairy'
            when 'E' then 'Edible'
            when 'F' then 'Fruity'
            when 'G' then 'Green'
            when 'H' then 'Herbal'
            when 'I' then 'Powdery'
            when 'J' then 'Floral'
            when 'K' then 'Coniferous'
            when 'L' then 'Floral'
            when 'M' then 'Floral'
            when 'N' then 'Floral'
            when 'O' then 'Floral'
            when 'P' then 'Phenolic'
            when 'Q' then 'Resinous'
            when 'R' then 'Rose'
            when 'S' then 'Spicy'
            when 'T' then 'Smoky'
            when 'U' then 'Animalic'
            when 'V' then 'Gourmand'
            when 'W' then 'Woody'
            when 'X' then 'Musky'
            when 'Y' then 'Earthy'
            when 'Z' then 'Solvent'
            else 'Floral'
        end as scent_family,
        1000::numeric(12, 2) as stock_quantity,
        'ml'::text as unit,
        0::numeric(12, 2) as cost_per_unit,
        1::numeric(12, 2) as minimum_stock,
        1::numeric(12, 2) as low_stock_threshold,
        profile.supplier as supplier_name,
        profile.cas_no as cas_number,
        case
            when profile.ifra_limit_percent is null then null
            when profile.ifra_limit_percent < 0 then null
            when profile.ifra_limit_percent > 100 then null
            else profile.ifra_limit_percent
        end as ifra_limit,
        case
            when profile.life_hours is null then null
            when profile.life_hours < 12 then 'top'
            when profile.life_hours < 120 then 'middle'
            else 'base'
        end as pyramid_placement,
        coalesce(nullif(trim(profile.brief_description), ''), nullif(trim(profile.odour_description), '')) as description,
        concat_ws(
            ' ',
            'Seeded from Perfumer''s Workbook reference library.',
            case when profile.reference_code is not null then concat('Reference code: ', profile.reference_code) end,
            case when profile.supplier is not null then concat('Workbook supplier: ', profile.supplier) end
        ) as notes
    from auth.users as users
    cross join public.material_reference_profiles as profile
)
insert into public.raw_materials (
    user_id,
    name,
    category,
    type,
    scent_family,
    stock_quantity,
    unit,
    cost_per_unit,
    minimum_stock,
    low_stock_threshold,
    supplier_name,
    cas_number,
    ifra_limit,
    pyramid_placement,
    description,
    notes,
    workbook_code
)
select
    seed.user_id,
    seed.name,
    seed.category,
    seed.type,
    seed.scent_family,
    seed.stock_quantity,
    seed.unit,
    seed.cost_per_unit,
    seed.minimum_stock,
    seed.low_stock_threshold,
    seed.supplier_name,
    seed.cas_number,
    seed.ifra_limit,
    seed.pyramid_placement,
    seed.description,
    seed.notes,
    seed.workbook_code
from workbook_material_seed as seed
where not exists (
    select 1
    from public.raw_materials as existing_raw_material
    where existing_raw_material.user_id = seed.user_id
      and (
        existing_raw_material.workbook_code = seed.workbook_code
        or lower(trim(existing_raw_material.name)) = lower(trim(seed.name))
      )
);

insert into public.raw_material_reference_links (
    raw_material_id,
    reference_profile_id,
    match_method,
    match_confidence,
    is_primary,
    notes
)
select
    raw_material.id,
    profile.id,
    'seeded_workbook_library',
    1,
    true,
    'Linked while seeding operational workbook inventory library.'
from public.raw_materials as raw_material
join public.material_reference_profiles as profile
  on profile.reference_code = raw_material.workbook_code
where not exists (
    select 1
    from public.raw_material_reference_links as existing_link
    where existing_link.raw_material_id = raw_material.id
      and existing_link.is_primary = true
);
