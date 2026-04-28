import supabase from '@/lib/supabaseClient.js';
import { toAppRecord } from '@/services/supabaseDataHelpers.js';
import { buildCanonicalReferencePayload, resolveCanonicalReferenceProfile } from '@/utils/canonicalReferenceProfile.js';

const mapOdourFacet = (row) => ({
  ...toAppRecord(row),
  value: Number(row.value || 0),
});

const mapReferenceProfile = (row) => {
  if (!row) {
    return null;
  }

  const baseProfile = {
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

  const canonicalProfile = resolveCanonicalReferenceProfile({
    referenceProfile: baseProfile,
  });

  return {
    ...baseProfile,
    canonical_profile: canonicalProfile,
    source_kind: canonicalProfile?.source_kind || baseProfile.source_kind,
    reference_code: canonicalProfile?.reference_code || baseProfile.reference_code,
    abc_primary_family: canonicalProfile?.abc_primary_family || baseProfile.abc_primary_family,
    abc_secondary_family: canonicalProfile?.abc_secondary_family || baseProfile.abc_secondary_family,
    abc_distribution: canonicalProfile?.abc_distribution || [],
    impact: canonicalProfile?.impact ?? baseProfile.impact,
    life_hours: canonicalProfile?.life_hours ?? baseProfile.life_hours,
    use_level_typical_percent: canonicalProfile?.use_level_typical_percent ?? baseProfile.use_level_typical_percent,
    use_level_max_percent: canonicalProfile?.use_level_max_percent ?? baseProfile.use_level_max_percent,
    ifra_limit_percent: canonicalProfile?.ifra_limit_percent ?? baseProfile.ifra_limit_percent,
    cas_no: canonicalProfile?.cas_number || baseProfile.cas_no,
    top_middle_base_tendency: canonicalProfile?.top_middle_base_tendency || null,
    confidence_score: canonicalProfile?.confidence_score ?? null,
    confidence_reason: canonicalProfile?.confidence_reason || null,
    field_locks: canonicalProfile?.field_locks || {},
    source_snapshots: canonicalProfile?.source_snapshots || {},
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

const chunkValues = (values, size = 150) => {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

const normalizeOptionalText = (value) => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const normalizeOptionalNumber = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
};

const hasManualReferenceGuidance = (rawMaterial) => [
  rawMaterial?.cas_number,
  rawMaterial?.ifra_limit,
  rawMaterial?.reference_abc_primary_family,
  rawMaterial?.reference_impact,
  rawMaterial?.reference_life_hours,
  rawMaterial?.reference_use_level_typical_percent,
  rawMaterial?.reference_use_level_max_percent,
].some((value) => value !== null && value !== undefined && value !== '');

const buildManualReferencePayload = (rawMaterial, userId) => {
  const manualReferenceCode = `MAN-${String(rawMaterial.id || '').replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  const rawPayload = buildCanonicalReferencePayload({
    rawMaterial,
    existingRawPayload: rawMaterial?.__existingManualReferenceRawPayload || {},
    sourceSnapshots: rawMaterial?.__referenceSourceSnapshots || null,
    fieldLocks: rawMaterial?.__referenceFieldLocks || null,
  });

  return {
    owner_user_id: userId,
    source_kind: 'manual',
    source_raw_material_id: rawMaterial.id,
    reference_code: manualReferenceCode,
    name: normalizeOptionalText(rawMaterial.name) || manualReferenceCode,
    supplier: normalizeOptionalText(rawMaterial.vendor || rawMaterial.supplier_name),
    abc_code: normalizeOptionalText(rawMaterial.workbook_code),
    abc_primary_family: normalizeOptionalText(rawMaterial.reference_abc_primary_family || rawMaterial.scent_family),
    category: normalizeOptionalText(rawMaterial.category),
    brief_description: normalizeOptionalText(rawMaterial.description),
    odour_description: normalizeOptionalText(rawMaterial.description),
    impact: normalizeOptionalNumber(rawMaterial.reference_impact),
    life_hours: normalizeOptionalNumber(rawMaterial.reference_life_hours),
    use_level_typical_percent: normalizeOptionalNumber(rawMaterial.reference_use_level_typical_percent),
    use_level_max_percent: normalizeOptionalNumber(rawMaterial.reference_use_level_max_percent),
    ifra_limit_percent: normalizeOptionalNumber(rawMaterial.ifra_limit),
    cas_no: normalizeOptionalText(rawMaterial.cas_number),
    raw_payload: {
      ...rawPayload,
      raw_material_id: rawMaterial.id,
      workbook_code: normalizeOptionalText(rawMaterial.workbook_code),
      type: normalizeOptionalText(rawMaterial.type),
      unit: normalizeOptionalText(rawMaterial.unit),
    },
  };
};

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

  const linkChunks = chunkValues(uniqueIds);
  const links = [];

  for (const idChunk of linkChunks) {
    const { data: chunkLinks, error: chunkLinksError } = await supabase
      .from('raw_material_reference_links')
      .select('raw_material_id, reference_profile_id, match_method, match_confidence, is_primary')
      .in('raw_material_id', idChunk)
      .eq('is_primary', true);

    if (chunkLinksError) {
      console.error('Error fetching reference match status map links:', chunkLinksError);
      throw new Error(chunkLinksError.message || 'Failed to fetch reference match statuses');
    }

    links.push(...(chunkLinks || []));
  }

  const referenceProfileIds = [...new Set((links || []).map((row) => row.reference_profile_id).filter(Boolean))];
  const referenceProfilesById = new Map();

  if (referenceProfileIds.length) {
    const referenceProfileChunks = chunkValues(referenceProfileIds);

    for (const idChunk of referenceProfileChunks) {
      const { data: referenceProfiles, error: referenceProfilesError } = await supabase
        .from('material_reference_profiles')
        .select(`
          id,
          reference_code,
          name,
          abc_code,
          abc_primary_family,
          abc_secondary_family,
          impact,
          life_hours,
          cas_no,
          ifra_limit_percent,
          use_level_typical_percent,
          use_level_max_percent,
          source_kind,
          raw_payload
        `)
        .in('id', idChunk);

      if (referenceProfilesError) {
        console.error('Error fetching reference profiles for status map:', referenceProfilesError);
        throw new Error(referenceProfilesError.message || 'Failed to fetch reference profile details');
      }

      for (const profile of referenceProfiles || []) {
        referenceProfilesById.set(profile.id, mapReferenceProfile(profile));
      }
    }
  }

  return new Map(
    (links || []).map((row) => [
      row.raw_material_id,
      {
        raw_material_id: row.raw_material_id,
        match_method: row.match_method,
        match_confidence:
          row.match_confidence === null || row.match_confidence === undefined
            ? null
            : Number(row.match_confidence),
        is_primary: Boolean(row.is_primary),
        reference_profile: referenceProfilesById.get(row.reference_profile_id) || null,
      },
    ])
  );
};

const formatPostgrestInList = (values) => (
  `(${values.map((value) => `"${String(value).replace(/"/g, '\\"')}"`).join(',')})`
);

export const getPrimaryReferenceRawMaterialIds = async ({
  searchTerm = '',
  referenceFilter = 'all',
} = {}) => {
  const normalizedSearch = String(searchTerm || '').trim();
  const normalizedReferenceFilter = String(referenceFilter || 'all');
  const matchedIds = new Set();

  let linksQuery = supabase
    .from('raw_material_reference_links')
    .select('raw_material_id, reference_profile_id')
    .eq('is_primary', true);

  if (normalizedReferenceFilter === 'matched') {
    // keep base primary links
  }

  const { data: links, error: linksError } = await linksQuery;

  if (linksError) {
    console.error('Error fetching primary reference raw material ids:', linksError);
    throw new Error(linksError.message || 'Failed to fetch reference ids');
  }

  for (const row of links || []) {
    if (row.raw_material_id) {
      matchedIds.add(row.raw_material_id);
    }
  }

  let filteredIds = new Set(matchedIds);
  const referenceProfileIds = [...new Set((links || []).map((row) => row.reference_profile_id).filter(Boolean))];

  if (normalizedSearch || ['ifra_limited', 'has_guidance'].includes(normalizedReferenceFilter)) {
    const matchingProfileIds = new Set();
    const chunkedProfileIds = chunkValues(referenceProfileIds);

    for (const idChunk of chunkedProfileIds) {
      let profileQuery = supabase
        .from('material_reference_profiles')
        .select('id, ifra_limit_percent, use_level_max_percent')
        .in('id', idChunk);

      if (normalizedSearch) {
        const escapedQuery = normalizedSearch.replace(/[%_,]/g, ' ');
        profileQuery = profileQuery.or([
          `reference_code.ilike.%${escapedQuery}%`,
          `name.ilike.%${escapedQuery}%`,
          `abc_code.ilike.%${escapedQuery}%`,
          `abc_primary_family.ilike.%${escapedQuery}%`,
          `cas_no.ilike.%${escapedQuery}%`,
        ].join(','));
      } else if (normalizedReferenceFilter === 'ifra_limited') {
        profileQuery = profileQuery.not('ifra_limit_percent', 'is', null);
      } else if (normalizedReferenceFilter === 'has_guidance') {
        profileQuery = profileQuery.or('ifra_limit_percent.not.is.null,use_level_max_percent.not.is.null');
      }

      const { data: profiles, error: profilesError } = await profileQuery;

      if (profilesError) {
        console.error('Error fetching filtered reference profile ids:', profilesError);
        throw new Error(profilesError.message || 'Failed to fetch filtered reference profiles');
      }

      for (const profile of profiles || []) {
        matchingProfileIds.add(profile.id);
      }
    }

    if (normalizedSearch || ['ifra_limited', 'has_guidance'].includes(normalizedReferenceFilter)) {
      filteredIds = new Set(
        (links || [])
          .filter((row) => matchingProfileIds.has(row.reference_profile_id))
          .map((row) => row.raw_material_id)
          .filter(Boolean)
      );
    }
  }

  if (normalizedReferenceFilter === 'all') {
    return {
      matchedIds: [...matchedIds],
      filteredIds: normalizedSearch ? [...filteredIds] : [],
      hasFilteredIds: normalizedSearch && filteredIds.size > 0,
      hasAnyMatchedIds: matchedIds.size > 0,
      formatPostgrestInList,
    };
  }

  return {
    matchedIds: [...matchedIds],
    filteredIds: [...filteredIds],
    hasFilteredIds: filteredIds.size > 0,
    hasAnyMatchedIds: matchedIds.size > 0,
    formatPostgrestInList,
  };
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
        classification,
        impact,
        life_hours,
        abc_primary_letter,
        abc_primary_family,
        abc_secondary_letter,
        abc_secondary_family,
        odour_profile,
        use_level_min_percent,
        use_level_typical_percent,
        use_level_max_percent,
        ifra_limit_percent,
        raw_payload,
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

export const ensureReferenceLinksForRawMaterials = async (rawMaterials) => {
  const materials = [...new Map(
    (rawMaterials || [])
      .filter((material) => material?.id)
      .map((material) => [material.id, material])
  ).values()];

  if (!materials.length) {
    return new Map();
  }

  let referenceLinksMap = await getReferenceLinksByRawMaterialIds(materials.map((material) => material.id));
  const missingManualMaterials = materials.filter((material) => (
    !referenceLinksMap.has(material.id) && hasManualReferenceGuidance(material)
  ));

  if (!missingManualMaterials.length) {
    return referenceLinksMap;
  }

  for (const rawMaterial of missingManualMaterials) {
    await syncManualReferenceProfileForRawMaterial(rawMaterial);
  }

  referenceLinksMap = await getReferenceLinksByRawMaterialIds(materials.map((material) => material.id));
  return referenceLinksMap;
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

export const syncManualReferenceProfileForRawMaterial = async (rawMaterial) => {
  if (!rawMaterial?.id) {
    return null;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('Error loading authenticated user for manual reference sync:', userError);
    throw new Error(userError.message || 'Failed to load current user');
  }

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: existingManualProfile, error: existingProfileError } = await supabase
    .from('material_reference_profiles')
    .select('id, raw_payload')
    .eq('source_kind', 'manual')
    .eq('source_raw_material_id', rawMaterial.id)
    .maybeSingle();

  if (existingProfileError) {
    console.error('Error loading existing manual reference profile:', existingProfileError);
    throw new Error(existingProfileError.message || 'Failed to load manual reference profile');
  }

  if (!hasManualReferenceGuidance(rawMaterial)) {
    if (existingManualProfile?.id) {
      const { error: deleteProfileError } = await supabase
        .from('material_reference_profiles')
        .delete()
        .eq('id', existingManualProfile.id);

      if (deleteProfileError) {
        console.error('Error deleting manual reference profile:', deleteProfileError);
        throw new Error(deleteProfileError.message || 'Failed to delete manual reference profile');
      }
    }

    return null;
  }

  const payload = buildManualReferencePayload({
    ...rawMaterial,
    __existingManualReferenceRawPayload: existingManualProfile?.raw_payload || {},
  }, user.id);
  let referenceProfileId = existingManualProfile?.id || null;

  if (referenceProfileId) {
    const { error: updateProfileError } = await supabase
      .from('material_reference_profiles')
      .update(payload)
      .eq('id', referenceProfileId);

    if (updateProfileError) {
      console.error('Error updating manual reference profile:', updateProfileError);
      throw new Error(updateProfileError.message || 'Failed to update manual reference profile');
    }
  } else {
    const { data: insertedProfile, error: insertProfileError } = await supabase
      .from('material_reference_profiles')
      .insert(payload)
      .select('id')
      .single();

    if (insertProfileError) {
      console.error('Error creating manual reference profile:', insertProfileError);
      throw new Error(insertProfileError.message || 'Failed to create manual reference profile');
    }

    referenceProfileId = insertedProfile.id;
  }

  await assignPrimaryReferenceProfile(
    rawMaterial.id,
    referenceProfileId,
    `Synced from raw material form on ${new Date().toISOString()}`,
  );

  return referenceProfileId;
};

export const removeReferenceArtifactsForRawMaterial = async (rawMaterialId) => {
  if (!rawMaterialId) {
    return;
  }

  const { error: deleteLinksError } = await supabase
    .from('raw_material_reference_links')
    .delete()
    .eq('raw_material_id', rawMaterialId);

  if (deleteLinksError) {
    console.error('Error deleting raw material reference links:', deleteLinksError);
    throw new Error(deleteLinksError.message || 'Failed to delete raw material reference links');
  }

  const { error: deleteManualProfilesError } = await supabase
    .from('material_reference_profiles')
    .delete()
    .eq('source_kind', 'manual')
    .eq('source_raw_material_id', rawMaterialId);

  if (deleteManualProfilesError) {
    console.error('Error deleting manual reference profiles for raw material:', deleteManualProfilesError);
    throw new Error(deleteManualProfilesError.message || 'Failed to delete manual reference profile');
  }
};
