with normalized_raw_materials as (
    select
        raw_material.id as raw_material_id,
        lower(trim(raw_material.workbook_code)) as workbook_code_key,
        lower(trim(raw_material.cas_number)) as cas_number_key,
        lower(trim(regexp_replace(raw_material.name, '[^a-zA-Z0-9]+', ' ', 'g'))) as name_key
    from public.raw_materials as raw_material
),
normalized_reference_profiles as (
    select
        reference_profile.id as reference_profile_id,
        lower(trim(reference_profile.reference_code)) as reference_code_key,
        lower(trim(reference_profile.cas_no)) as cas_no_key,
        lower(trim(regexp_replace(reference_profile.name, '[^a-zA-Z0-9]+', ' ', 'g'))) as name_key
    from public.material_reference_profiles as reference_profile
),
candidate_matches as (
    select
        raw_material.raw_material_id,
        reference_profile.reference_profile_id,
        'workbook_code_exact'::text as match_method,
        1.0::numeric as match_confidence,
        1 as match_priority
    from normalized_raw_materials as raw_material
    join normalized_reference_profiles as reference_profile
      on raw_material.workbook_code_key is not null
     and raw_material.workbook_code_key <> ''
     and raw_material.workbook_code_key = reference_profile.reference_code_key

    union all

    select
        raw_material.raw_material_id,
        reference_profile.reference_profile_id,
        'cas_exact'::text as match_method,
        0.98::numeric as match_confidence,
        2 as match_priority
    from normalized_raw_materials as raw_material
    join normalized_reference_profiles as reference_profile
      on raw_material.cas_number_key is not null
     and raw_material.cas_number_key <> ''
     and raw_material.cas_number_key = reference_profile.cas_no_key

    union all

    select
        raw_material.raw_material_id,
        reference_profile.reference_profile_id,
        'name_exact'::text as match_method,
        0.95::numeric as match_confidence,
        3 as match_priority
    from normalized_raw_materials as raw_material
    join normalized_reference_profiles as reference_profile
      on raw_material.name_key is not null
     and raw_material.name_key <> ''
     and raw_material.name_key = reference_profile.name_key
),
ranked_candidate_matches as (
    select
        candidate_match.*,
        row_number() over (
            partition by candidate_match.raw_material_id
            order by candidate_match.match_confidence desc, candidate_match.match_priority asc, candidate_match.reference_profile_id
        ) as rank_order
    from candidate_matches as candidate_match
),
primary_candidate_matches as (
    select
        ranked_candidate_match.raw_material_id,
        ranked_candidate_match.reference_profile_id,
        ranked_candidate_match.match_method,
        ranked_candidate_match.match_confidence
    from ranked_candidate_matches as ranked_candidate_match
    where ranked_candidate_match.rank_order = 1
)
insert into public.raw_material_reference_links (
    raw_material_id,
    reference_profile_id,
    match_method,
    match_confidence,
    is_primary
)
select
    primary_candidate_match.raw_material_id,
    primary_candidate_match.reference_profile_id,
    primary_candidate_match.match_method,
    primary_candidate_match.match_confidence,
    true
from primary_candidate_matches as primary_candidate_match
where not exists (
    select 1
    from public.raw_material_reference_links as existing_link
    where existing_link.raw_material_id = primary_candidate_match.raw_material_id
      and existing_link.is_primary = true
);
