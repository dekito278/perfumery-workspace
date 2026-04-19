import supabase from '@/lib/supabaseClient.js';
import { toAppRecord } from '@/services/supabaseDataHelpers.js';

const mapOdourFacet = (row) => ({
  ...toAppRecord(row),
  value: Number(row.value || 0),
});

const mapReferenceProfile = (row) => {
  if (!row) {
    return null;
  }

  return {
    ...toAppRecord(row),
    impact: row.impact === null || row.impact === undefined ? null : Number(row.impact),
    life_hours: row.life_hours === null || row.life_hours === undefined ? null : Number(row.life_hours),
    molecular_weight: row.molecular_weight === null || row.molecular_weight === undefined ? null : Number(row.molecular_weight),
    use_level_min_percent: row.use_level_min_percent === null || row.use_level_min_percent === undefined ? null : Number(row.use_level_min_percent),
    use_level_typical_percent: row.use_level_typical_percent === null || row.use_level_typical_percent === undefined ? null : Number(row.use_level_typical_percent),
    use_level_max_percent: row.use_level_max_percent === null || row.use_level_max_percent === undefined ? null : Number(row.use_level_max_percent),
    ifra_limit_percent: row.ifra_limit_percent === null || row.ifra_limit_percent === undefined ? null : Number(row.ifra_limit_percent),
    pw_price: row.pw_price === null || row.pw_price === undefined ? null : Number(row.pw_price),
    catalog_price: row.catalog_price === null || row.catalog_price === undefined ? null : Number(row.catalog_price),
    odour_facets: Array.isArray(row.material_reference_odour_facets)
      ? row.material_reference_odour_facets
          .map(mapOdourFacet)
          .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0))
      : [],
  };
};

const mapReferenceLink = (row) => ({
  ...toAppRecord(row),
  match_confidence:
    row.match_confidence === null || row.match_confidence === undefined
      ? null
      : Number(row.match_confidence),
  reference_profile: mapReferenceProfile(row.material_reference_profiles),
});

export const getReferenceProfileByRawMaterialId = async (rawMaterialId) => {
  const { data, error } = await supabase
    .from('raw_material_reference_links')
    .select(`
      *,
      material_reference_profiles (
        *,
        material_reference_odour_facets (*)
      )
    `)
    .eq('raw_material_id', rawMaterialId)
    .eq('is_primary', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching material reference profile:', error);
    throw new Error(error.message || 'Failed to fetch material reference profile');
  }

  return data ? mapReferenceLink(data) : null;
};

export const getReferenceMatchStatusMap = async (rawMaterialIds) => {
  const uniqueIds = [...new Set((rawMaterialIds || []).filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('raw_material_reference_links')
    .select(`
      raw_material_id,
      match_method,
      match_confidence,
      is_primary,
      material_reference_profiles (
        id,
        reference_code,
        name,
        abc_code
      )
    `)
    .in('raw_material_id', uniqueIds)
    .eq('is_primary', true);

  if (error) {
    console.error('Error fetching reference match status map:', error);
    throw new Error(error.message || 'Failed to fetch reference match statuses');
  }

  return new Map(
    (data || []).map((row) => [
      row.raw_material_id,
      {
        raw_material_id: row.raw_material_id,
        match_method: row.match_method,
        match_confidence:
          row.match_confidence === null || row.match_confidence === undefined
            ? null
            : Number(row.match_confidence),
        is_primary: Boolean(row.is_primary),
        reference_profile: row.material_reference_profiles
          ? {
              ...row.material_reference_profiles,
              ifra_limit_percent:
                row.material_reference_profiles.ifra_limit_percent === null || row.material_reference_profiles.ifra_limit_percent === undefined
                  ? null
                  : Number(row.material_reference_profiles.ifra_limit_percent),
              use_level_max_percent:
                row.material_reference_profiles.use_level_max_percent === null || row.material_reference_profiles.use_level_max_percent === undefined
                  ? null
                  : Number(row.material_reference_profiles.use_level_max_percent),
            }
          : null,
      },
    ])
  );
};

export const getReferenceLinksByRawMaterialIds = async (rawMaterialIds) => {
  const uniqueIds = [...new Set((rawMaterialIds || []).filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('raw_material_reference_links')
    .select(`
      *,
      material_reference_profiles (
        id,
        reference_code,
        name,
        brief_description,
        impact,
        life_hours,
        abc_primary_family,
        use_level_min_percent,
        use_level_typical_percent,
        use_level_max_percent,
        ifra_limit_percent,
        material_reference_odour_facets (*)
      )
    `)
    .in('raw_material_id', uniqueIds)
    .eq('is_primary', true);

  if (error) {
    console.error('Error fetching material reference links:', error);
    throw new Error(error.message || 'Failed to fetch material reference links');
  }

  return new Map((data || []).map((row) => [row.raw_material_id, mapReferenceLink(row)]));
};

export const searchReferenceProfiles = async (query = '', limit = 12) => {
  const normalizedQuery = String(query || '').trim();

  let request = supabase
    .from('material_reference_profiles')
    .select(`
      id,
      reference_code,
      name,
      supplier,
      abc_code,
      abc_primary_family,
      cas_no,
      use_level_typical_percent,
      use_level_max_percent,
      ifra_limit_percent
    `)
    .order('name', { ascending: true })
    .limit(limit);

  if (normalizedQuery) {
    const escapedQuery = normalizedQuery.replace(/[%_,]/g, ' ');
    request = request.or([
      `reference_code.ilike.%${escapedQuery}%`,
      `name.ilike.%${escapedQuery}%`,
      `cas_no.ilike.%${escapedQuery}%`,
      `abc_code.ilike.%${escapedQuery}%`,
      `abc_primary_family.ilike.%${escapedQuery}%`,
    ].join(','));
  }

  const { data, error } = await request;

  if (error) {
    console.error('Error searching material reference profiles:', error);
    throw new Error(error.message || 'Failed to search material reference profiles');
  }

  return (data || []).map((row) => ({
    ...row,
    use_level_typical_percent:
      row.use_level_typical_percent === null || row.use_level_typical_percent === undefined
        ? null
        : Number(row.use_level_typical_percent),
    use_level_max_percent:
      row.use_level_max_percent === null || row.use_level_max_percent === undefined
        ? null
        : Number(row.use_level_max_percent),
    ifra_limit_percent:
      row.ifra_limit_percent === null || row.ifra_limit_percent === undefined
        ? null
        : Number(row.ifra_limit_percent),
  }));
};

export const assignPrimaryReferenceProfile = async (rawMaterialId, referenceProfileId, notes = null) => {
  const { data: existingLink, error: existingLinkError } = await supabase
    .from('raw_material_reference_links')
    .select('id')
    .eq('raw_material_id', rawMaterialId)
    .eq('is_primary', true)
    .maybeSingle();

  if (existingLinkError) {
    console.error('Error loading existing material reference link:', existingLinkError);
    throw new Error(existingLinkError.message || 'Failed to load existing material reference link');
  }

  if (existingLink?.id) {
    const { error } = await supabase
      .from('raw_material_reference_links')
      .update({
        reference_profile_id: referenceProfileId,
        match_method: 'manual',
        match_confidence: 1,
        notes,
      })
      .eq('id', existingLink.id);

    if (error) {
      console.error('Error updating material reference link:', error);
      throw new Error(error.message || 'Failed to update material reference link');
    }
  } else {
    const { error } = await supabase
      .from('raw_material_reference_links')
      .insert({
        raw_material_id: rawMaterialId,
        reference_profile_id: referenceProfileId,
        match_method: 'manual',
        match_confidence: 1,
        is_primary: true,
        notes,
      });

    if (error) {
      console.error('Error creating material reference link:', error);
      throw new Error(error.message || 'Failed to create material reference link');
    }
  }
};

export const removePrimaryReferenceProfile = async (rawMaterialId) => {
  const { error } = await supabase
    .from('raw_material_reference_links')
    .delete()
    .eq('raw_material_id', rawMaterialId)
    .eq('is_primary', true);

  if (error) {
    console.error('Error removing material reference link:', error);
    throw new Error(error.message || 'Failed to remove material reference link');
  }
};
