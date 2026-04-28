
import supabase from '@/lib/supabaseClient.js';
import { deriveScentFamilyFromCategory, inferRawMaterialTypeFromCategory } from '@/utils/rawMaterialCategoryMeta.js';
import {
  getPrimaryReferenceRawMaterialIds,
  removeReferenceArtifactsForRawMaterial,
  syncManualReferenceProfileForRawMaterial,
} from '@/services/materialReferenceService.js';

const RAW_MATERIAL_OPTIONS_TTL_MS = 5 * 60 * 1000;
let rawMaterialOptionsCache = {
  data: null,
  loadedAt: 0,
  promise: null,
};

const MATCH_RESOLUTION_ACTION = 'matched_existing';

const normalizeLookupValue = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
const collapseLookupValue = (value) => normalizeLookupValue(value).replace(/[^a-z0-9]+/g, '');
const normalizeCasValue = (value) => normalizeLookupValue(value).replace(/[^a-z0-9]+/g, '');
const normalizeChemicalSemanticValue = (value) => {
  const normalized = normalizeLookupValue(value)
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]+/g, '-')
    .replace(/\((z)\)/g, 'cis')
    .replace(/\((e)\)/g, 'trans')
    .replace(/\((rs|rac)\)/g, 'rac')
    .replace(/\b(z)\s*-\s*(\d+)/g, 'cis-$2')
    .replace(/\b(e)\s*-\s*(\d+)/g, 'trans-$2')
    .replace(/\b(cis|trans)\s*[- ]?\s*(\d+)\b/g, '$1-$2')
    .replace(/\b(\d+)\s*[- ]\s*([a-z])/g, '$1-$2')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized;
};
const buildSemanticLookupKey = (value) => collapseLookupValue(normalizeChemicalSemanticValue(value));
const DILUTION_MARKER_PATTERN = /(?:^|\b)(\d+\s*[- ]?\s*(?:tec|dpg|dep)|50\s*dep|100(?:\b|\s*\())/i;
const INVALID_CAS_MATCH_VALUES = new Set(['', 'mixture', 'mix', 'na', 'n/a', 'unknown', 'odiferousmixture']);

const mapRawMaterial = (row, solventMap = new Map()) => ({
  ...row,
  created: row.created_at,
  updated: row.updated_at,
  expand: row.dilution_solvent_id
    ? {
        dilution_solvent_id: solventMap.get(row.dilution_solvent_id) || null,
      }
    : undefined,
});

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

const hasDilutionMarker = (value) => DILUTION_MARKER_PATTERN.test(String(value || ''));

const extractSynonymCandidates = (notes) => {
  const synonymMatch = String(notes || '').match(/synonym:\s*([^|\n]+)/i);
  if (!synonymMatch?.[1]) {
    return [];
  }

  return synonymMatch[1]
    .split(/\s*\/\s*/)
    .map((item) => String(item || '').trim())
    .filter(Boolean);
};

const buildNameCandidates = ({ name, notes }) => {
  const baseName = String(name || '').trim();
  const slashSegments = baseName.split('/').map((item) => item.trim()).filter(Boolean);
  const synonymCandidates = extractSynonymCandidates(notes);

  return [...new Set([baseName, ...slashSegments, ...synonymCandidates].filter(Boolean))];
};

export const normalizeRawMaterialLookupValue = normalizeLookupValue;
export const collapseRawMaterialLookupValue = collapseLookupValue;
export const normalizeRawMaterialCasValue = normalizeCasValue;
export const normalizeRawMaterialChemicalName = normalizeChemicalSemanticValue;
export const buildRawMaterialSemanticLookupKey = buildSemanticLookupKey;
export const rawMaterialHasDilutionMarker = hasDilutionMarker;
export const buildRawMaterialNameCandidates = buildNameCandidates;

const buildResolution = ({ record, matchMethod, incomingName, matchedName }) => ({
  action: MATCH_RESOLUTION_ACTION,
  matchMethod,
  message: incomingName && matchedName && incomingName !== matchedName
    ? `Matched "${incomingName}" to existing raw material "${matchedName}" via ${matchMethod}.`
    : `Matched to existing raw material via ${matchMethod}.`,
  matchedRawMaterialId: record.id,
});

const withCreationResolution = (record, solventMap, resolution = null) => {
  const mapped = mapRawMaterial(record, solventMap);
  return resolution ? { ...mapped, _creationResolution: resolution } : mapped;
};

const buildRawMaterialPayload = (data) => {
  const normalizedCategory = data.category || null;
  const normalizedType = inferRawMaterialTypeFromCategory(normalizedCategory, data.type || 'material');
  const normalizedFamily = deriveScentFamilyFromCategory(normalizedCategory, data.scent_family || '');
  const isDiluted = Boolean(data.is_diluted);

  return {
    name: String(data.name || '').trim(),
    category: normalizedCategory,
    type: normalizedType,
    unit: data.unit,
    cost_per_unit: Number(data.cost_per_unit || 0),
    description: normalizeOptionalText(data.description),
    notes: normalizeOptionalText(data.notes),
    workbook_code: normalizeOptionalText(data.workbook_code),
    scent_family: normalizedFamily || null,
    supplier_name: normalizeOptionalText(data.supplier_name),
    vendor: normalizeOptionalText(data.vendor),
    cas_number: normalizeOptionalText(data.cas_number),
    ifra_limit: normalizeOptionalNumber(data.ifra_limit),
    reference_abc_primary_family: normalizeOptionalText(data.reference_abc_primary_family),
    reference_impact: normalizeOptionalNumber(data.reference_impact),
    reference_life_hours: normalizeOptionalNumber(data.reference_life_hours),
    reference_use_level_typical_percent: normalizeOptionalNumber(data.reference_use_level_typical_percent),
    reference_use_level_max_percent: normalizeOptionalNumber(data.reference_use_level_max_percent),
    is_diluted: isDiluted,
    dilution_solvent_id: isDiluted ? data.dilution_solvent_id : null,
    dilution_percentage: isDiluted ? normalizeOptionalNumber(data.dilution_percentage) : null,
  };
};

const getCurrentUserId = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message || 'Failed to read authenticated user');
  }

  if (!user) {
    throw new Error('User not authenticated');
  }

  return user.id;
};

const getSolventMap = async (solventIds) => {
  if (!solventIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('raw_materials')
    .select('id, name, unit')
    .in('id', solventIds);

  if (error) {
    console.error('Error fetching dilution solvents:', error);
    return new Map();
  }

  return new Map((data || []).map((item) => [item.id, item]));
};

export const clearRawMaterialOptionsCache = () => {
  rawMaterialOptionsCache = {
    data: null,
    loadedAt: 0,
    promise: null,
  };
};

const getCachedRawMaterialMatchCandidates = async () => {
  const rows = await getRawMaterialOptions();
  return rows || [];
};

const pickPreferredExistingMatch = (matches) => {
  if (!matches.length) {
    return null;
  }

  return [...matches].sort((left, right) => {
    const leftWorkbookScore = left.workbook_code ? 1 : 0;
    const rightWorkbookScore = right.workbook_code ? 1 : 0;
    if (rightWorkbookScore !== leftWorkbookScore) {
      return rightWorkbookScore - leftWorkbookScore;
    }

    const leftGuidanceScore =
      (Number(left.reference_impact) > 0 ? 1 : 0)
      + (Number(left.reference_life_hours) > 0 ? 1 : 0)
      + (Number(left.ifra_limit) > 0 ? 1 : 0)
      + (left.cas_number ? 1 : 0);
    const rightGuidanceScore =
      (Number(right.reference_impact) > 0 ? 1 : 0)
      + (Number(right.reference_life_hours) > 0 ? 1 : 0)
      + (Number(right.ifra_limit) > 0 ? 1 : 0)
      + (right.cas_number ? 1 : 0);
    if (rightGuidanceScore !== leftGuidanceScore) {
      return rightGuidanceScore - leftGuidanceScore;
    }

    return String(left.name || '').localeCompare(String(right.name || ''));
  })[0];
};

const pickUniquePreferredExistingMatch = (matches) => {
  if (!matches.length) {
    return null;
  }

  if (matches.length === 1) {
    return matches[0];
  }

  const uniqueIds = [...new Set(matches.map((entry) => entry.id).filter(Boolean))];
  if (uniqueIds.length !== 1) {
    return null;
  }

  return pickPreferredExistingMatch(matches);
};

const buildSemanticCandidateKeys = ({ name, notes }) => (
  buildNameCandidates({ name, notes })
    .map((candidate) => buildSemanticLookupKey(candidate))
    .filter(Boolean)
);

const findExistingRawMaterialBySmartMatch = async (userId, payload) => {
  const normalizedName = String(payload.name || '').trim();
  if (!normalizedName) {
    return null;
  }

  const candidateRows = (await getCachedRawMaterialMatchCandidates())
    .filter((row) => row.user_id === userId);

  const normalizedWorkbookCode = normalizeLookupValue(payload.workbook_code);
  if (normalizedWorkbookCode) {
    const workbookMatch = candidateRows.find((row) => normalizeLookupValue(row.workbook_code) === normalizedWorkbookCode);
    if (workbookMatch) {
      return {
        record: workbookMatch,
        resolution: buildResolution({
          record: workbookMatch,
          matchMethod: 'workbook code',
          incomingName: payload.name,
          matchedName: workbookMatch.name,
        }),
      };
    }
  }

  const incomingIsDilutionVariant = hasDilutionMarker(payload.name);
  const incomingCas = normalizeCasValue(payload.cas_number);
  const safeCas = incomingCas && !INVALID_CAS_MATCH_VALUES.has(incomingCas) ? incomingCas : null;

  if (safeCas) {
    const casMatches = candidateRows.filter((row) => {
      if (hasDilutionMarker(row.name) !== incomingIsDilutionVariant) {
        return false;
      }

      const rowCas = normalizeCasValue(row.cas_number);
      return rowCas && !INVALID_CAS_MATCH_VALUES.has(rowCas) && rowCas === safeCas;
    });

    const pickedCasMatch = pickUniquePreferredExistingMatch(casMatches);
    if (pickedCasMatch) {
      return {
        record: pickedCasMatch,
        resolution: buildResolution({
          record: pickedCasMatch,
          matchMethod: 'CAS number',
          incomingName: payload.name,
          matchedName: pickedCasMatch.name,
        }),
      };
    }
  }

  const exactNameMatches = candidateRows.filter((row) => normalizeLookupValue(row.name) === normalizeLookupValue(payload.name));
  const pickedExactNameMatch = pickUniquePreferredExistingMatch(exactNameMatches);
  if (pickedExactNameMatch) {
    return {
      record: pickedExactNameMatch,
      resolution: buildResolution({
        record: pickedExactNameMatch,
        matchMethod: 'exact name',
        incomingName: payload.name,
        matchedName: pickedExactNameMatch.name,
      }),
    };
  }

  const nameCandidates = buildNameCandidates({
    name: payload.name,
    notes: payload.notes,
  });
  const normalizedCandidateNames = nameCandidates.map((item) => normalizeLookupValue(item));
  const collapsedCandidateNames = nameCandidates.map((item) => collapseLookupValue(item));
  const semanticCandidateKeys = buildSemanticCandidateKeys({
    name: payload.name,
    notes: payload.notes,
  });

  const exactAliasMatches = candidateRows.filter((row) => {
    if (hasDilutionMarker(row.name) !== incomingIsDilutionVariant) {
      return false;
    }

    const rowName = normalizeLookupValue(row.name);
    return normalizedCandidateNames.includes(rowName);
  });
  const pickedExactAliasMatch = pickUniquePreferredExistingMatch(exactAliasMatches);
  if (pickedExactAliasMatch) {
    return {
      record: pickedExactAliasMatch,
      resolution: buildResolution({
        record: pickedExactAliasMatch,
        matchMethod: 'alias name',
        incomingName: payload.name,
        matchedName: pickedExactAliasMatch.name,
      }),
    };
  }

  const collapsedAliasMatches = candidateRows.filter((row) => {
    if (hasDilutionMarker(row.name) !== incomingIsDilutionVariant) {
      return false;
    }

    const rowName = collapseLookupValue(row.name);
    return collapsedCandidateNames.includes(rowName);
  });
  const pickedCollapsedAliasMatch = pickUniquePreferredExistingMatch(collapsedAliasMatches);
  if (pickedCollapsedAliasMatch) {
    return {
      record: pickedCollapsedAliasMatch,
      resolution: buildResolution({
        record: pickedCollapsedAliasMatch,
        matchMethod: 'normalized alias',
        incomingName: payload.name,
        matchedName: pickedCollapsedAliasMatch.name,
      }),
    };
  }

  const semanticAliasMatches = candidateRows.filter((row) => {
    if (hasDilutionMarker(row.name) !== incomingIsDilutionVariant) {
      return false;
    }

    const rowSemanticKeys = buildSemanticCandidateKeys({
      name: row.name,
      notes: row.notes,
    });

    return rowSemanticKeys.some((key) => semanticCandidateKeys.includes(key));
  });
  const pickedSemanticAliasMatch = pickUniquePreferredExistingMatch(semanticAliasMatches);
  if (pickedSemanticAliasMatch) {
    return {
      record: pickedSemanticAliasMatch,
      resolution: buildResolution({
        record: pickedSemanticAliasMatch,
        matchMethod: 'semantic alias',
        incomingName: payload.name,
        matchedName: pickedSemanticAliasMatch.name,
      }),
    };
  }

  return null;
};

const findExistingRawMaterialByName = async (userId, name) => {
  const normalizedName = String(name || '').trim();
  if (!normalizedName) {
    return null;
  }

  const { data, error } = await supabase
    .from('raw_materials')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', normalizedName)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error checking existing raw material by name:', error);
    return null;
  }

  return data || null;
};

const findExistingRawMaterialByWorkbookCode = async (userId, workbookCode, excludedRawMaterialId = null) => {
  const normalizedWorkbookCode = String(workbookCode || '').trim();
  if (!normalizedWorkbookCode) {
    return null;
  }

  let query = supabase
    .from('raw_materials')
    .select('*')
    .eq('user_id', userId)
    .ilike('workbook_code', normalizedWorkbookCode)
    .limit(1);

  if (excludedRawMaterialId) {
    query = query.neq('id', excludedRawMaterialId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Error checking existing raw material by workbook code:', error);
    return null;
  }

  return data || null;
};

export const getRawMaterials = async () => {
  try {
    const { data, error } = await supabase
      .from('raw_materials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const solventIds = [...new Set((data || []).map((item) => item.dilution_solvent_id).filter(Boolean))];
    const solventMap = await getSolventMap(solventIds);

    return (data || []).map((row) => mapRawMaterial(row, solventMap));
  } catch (error) {
    throw new Error('Failed to fetch raw materials');
  }
};

export const getRawMaterialsPage = async ({
  page = 1,
  pageSize = 20,
  searchTerm = '',
  typeFilter = 'all',
  categoryFilter = 'all',
  referenceFilter = 'all',
} = {}) => {
  try {
    const safePage = Math.max(Number(page) || 1, 1);
    const safePageSize = Math.max(Number(pageSize) || 20, 1);
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;
    const normalizedSearch = String(searchTerm || '').trim();

    const referenceScope = await getPrimaryReferenceRawMaterialIds({
      searchTerm: normalizedSearch,
      referenceFilter,
    });

    let query = supabase
      .from('raw_materials')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (normalizedSearch) {
      const escapedQuery = normalizedSearch.replace(/[%_,]/g, ' ');
      const searchConditions = [
        `name.ilike.%${escapedQuery}%`,
        `category.ilike.%${escapedQuery}%`,
        `vendor.ilike.%${escapedQuery}%`,
        `cas_number.ilike.%${escapedQuery}%`,
        `workbook_code.ilike.%${escapedQuery}%`,
        `scent_family.ilike.%${escapedQuery}%`,
      ];

      if (referenceScope.hasFilteredIds) {
        searchConditions.push(`id.in.${referenceScope.formatPostgrestInList(referenceScope.filteredIds)}`);
      }

      query = query.or(searchConditions.join(','));
    }

    if (typeFilter !== 'all') {
      query = query.eq('type', typeFilter);
    }

    if (categoryFilter !== 'all') {
      query = query.ilike('category', categoryFilter);
    }

    if (referenceFilter === 'matched' || referenceFilter === 'ifra_limited' || referenceFilter === 'has_guidance') {
      if (!referenceScope.hasFilteredIds) {
        return {
          items: [],
          total: 0,
          page: safePage,
          pageSize: safePageSize,
        };
      }

      query = query.in('id', referenceScope.filteredIds);
    } else if (referenceFilter === 'unmatched') {
      if (referenceScope.hasAnyMatchedIds) {
        query = query.not('id', 'in', referenceScope.formatPostgrestInList(referenceScope.matchedIds));
      }
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const solventIds = [...new Set((data || []).map((item) => item.dilution_solvent_id).filter(Boolean))];
    const solventMap = await getSolventMap(solventIds);

    return {
      items: (data || []).map((row) => mapRawMaterial(row, solventMap)),
      total: Number(count || 0),
      page: safePage,
      pageSize: safePageSize,
    };
  } catch (error) {
    console.error('Error fetching paginated raw materials:', error);
    throw new Error('Failed to fetch raw materials');
  }
};

export const getRawMaterialsSummary = async () => {
  try {
    const { data, error } = await supabase
      .from('raw_materials')
      .select(`
        id,
        name,
        type,
        category,
        workbook_code,
        cost_per_unit,
        reference_abc_primary_family,
        reference_impact,
        reference_life_hours,
        ifra_limit,
        created_at,
        updated_at
      `);

    if (error) {
      throw error;
    }

    return (data || []).map((row) => ({
      ...row,
      created: row.created_at,
      updated: row.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching raw material summary:', error);
    throw new Error('Failed to fetch raw material summary');
  }
};

export const getRawMaterialOptions = async ({ forceRefresh = false } = {}) => {
  try {
    const now = Date.now();
    if (!forceRefresh && rawMaterialOptionsCache.data && (now - rawMaterialOptionsCache.loadedAt) < RAW_MATERIAL_OPTIONS_TTL_MS) {
      return rawMaterialOptionsCache.data;
    }

    if (!forceRefresh && rawMaterialOptionsCache.promise) {
      return rawMaterialOptionsCache.promise;
    }

    rawMaterialOptionsCache.promise = (async () => {
      const { data, error } = await supabase
        .from('raw_materials')
        .select(`
          id,
          user_id,
          name,
          type,
          unit,
          category,
          vendor,
          workbook_code,
          cost_per_unit,
          scent_family,
          reference_abc_primary_family,
          reference_impact,
          reference_life_hours,
          reference_use_level_typical_percent,
          reference_use_level_max_percent,
          ifra_limit,
          cas_number,
          notes,
          description,
          dilution_percentage,
          dilution_solvent_id,
          is_diluted
        `)
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      const solventIds = [...new Set((data || []).map((item) => item.dilution_solvent_id).filter(Boolean))];
      const solventMap = await getSolventMap(solventIds);
      const mappedData = (data || []).map((row) => mapRawMaterial(row, solventMap));

      rawMaterialOptionsCache = {
        data: mappedData,
        loadedAt: Date.now(),
        promise: null,
      };

      return mappedData;
    })();

    return await rawMaterialOptionsCache.promise;
  } catch (error) {
    rawMaterialOptionsCache.promise = null;
    console.error('Error fetching raw material options:', error);
    throw new Error('Failed to fetch raw material options');
  }
};

export const getRawMaterialsReferenceSummary = async () => {
  try {
    const [
      { count: matchedReferenceCount, error: matchedError },
      { count: ifraReferenceCount, error: ifraError },
    ] = await Promise.all([
      supabase
        .from('raw_material_reference_links')
        .select('raw_material_id', { count: 'exact', head: true })
        .eq('is_primary', true),
      supabase
        .from('raw_material_reference_links')
        .select('raw_material_id, material_reference_profiles!inner(id)', { count: 'exact', head: true })
        .eq('is_primary', true)
        .not('material_reference_profiles.ifra_limit_percent', 'is', null),
    ]);

    if (matchedError) {
      throw matchedError;
    }

    if (ifraError) {
      throw ifraError;
    }

    return {
      matchedReferenceCount: Number(matchedReferenceCount || 0),
      ifraReferenceCount: Number(ifraReferenceCount || 0),
    };
  } catch (error) {
    console.error('Error fetching raw material reference summary:', error);
    throw new Error('Failed to fetch raw material reference summary');
  }
};

export const getRawMaterialById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('raw_materials')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }

    const solventMap = await getSolventMap(data.dilution_solvent_id ? [data.dilution_solvent_id] : []);
    return mapRawMaterial(data, solventMap);
  } catch (error) {
    console.error('Error fetching raw material:', error);
    throw new Error('Failed to fetch raw material');
  }
};

export const getSolvents = async () => {
  try {
    const { data, error } = await supabase
      .from('raw_materials')
      .select('id, name')
      .eq('type', 'solvent')
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map((item) => ({
      value: item.id,
      label: item.name,
    }));
  } catch (error) {
    console.error('Error fetching solvents:', error);
    throw new Error('Failed to fetch solvents');
  }
};

export const getRawMaterialVendorSuggestions = async () => {
  try {
    const { data, error } = await supabase
      .from('raw_materials')
      .select('vendor')
      .not('vendor', 'is', null)
      .order('vendor', { ascending: true });

    if (error) {
      throw error;
    }

    return [...new Set((data || []).map((item) => item.vendor).filter(Boolean))];
  } catch (error) {
    console.error('Error fetching vendor suggestions:', error);
    return [];
  }
};

export const createRawMaterial = async (data) => {
  try {
    const userId = await getCurrentUserId();
    const payload = buildRawMaterialPayload(data);

    // Validate dilution fields
    if (data.is_diluted) {
      if (!data.dilution_solvent_id) {
        throw new Error('Dilution solvent is required for diluted materials');
      }
      if (!data.dilution_percentage || data.dilution_percentage <= 0 || data.dilution_percentage > 100) {
        throw new Error('Dilution percentage must be between 0 and 100');
      }
    }

    const smartMatch = await findExistingRawMaterialBySmartMatch(userId, payload);
    if (smartMatch?.record) {
      const solventMap = await getSolventMap(
        smartMatch.record.dilution_solvent_id ? [smartMatch.record.dilution_solvent_id] : []
      );
      return withCreationResolution(smartMatch.record, solventMap, smartMatch.resolution);
    }

    const existingByWorkbookCode = payload.workbook_code
      ? await findExistingRawMaterialByWorkbookCode(userId, payload.workbook_code)
      : null;
    if (existingByWorkbookCode) {
      const solventMap = await getSolventMap(
        existingByWorkbookCode.dilution_solvent_id ? [existingByWorkbookCode.dilution_solvent_id] : []
      );
      return withCreationResolution(
        existingByWorkbookCode,
        solventMap,
        buildResolution({
          record: existingByWorkbookCode,
          matchMethod: 'workbook code',
          incomingName: payload.name,
          matchedName: existingByWorkbookCode.name,
        }),
      );
    }

    const existingByName = payload.name
      ? await findExistingRawMaterialByName(userId, payload.name)
      : null;
    if (existingByName) {
      const solventMap = await getSolventMap(
        existingByName.dilution_solvent_id ? [existingByName.dilution_solvent_id] : []
      );
      return withCreationResolution(
        existingByName,
        solventMap,
        buildResolution({
          record: existingByName,
          matchMethod: 'exact name',
          incomingName: payload.name,
          matchedName: existingByName.name,
        }),
      );
    }

    const { data: record, error } = await supabase
      .from('raw_materials')
      .insert({
        user_id: userId,
        ...payload,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505' && error.message?.includes('raw_materials_unique_workbook_code_per_user')) {
        const existingRecord = await findExistingRawMaterialByWorkbookCode(userId, payload.workbook_code);
        if (existingRecord) {
          const solventMap = await getSolventMap(existingRecord.dilution_solvent_id ? [existingRecord.dilution_solvent_id] : []);
          return withCreationResolution(
            existingRecord,
            solventMap,
            buildResolution({
              record: existingRecord,
              matchMethod: 'workbook code',
              incomingName: payload.name,
              matchedName: existingRecord.name,
            }),
          );
        }
      }

      if (error.code === '23505' && error.message?.includes('raw_materials_unique_name_per_user')) {
        const existingRecord = await findExistingRawMaterialByName(userId, payload.name);
        if (existingRecord) {
          const solventMap = await getSolventMap(existingRecord.dilution_solvent_id ? [existingRecord.dilution_solvent_id] : []);
          return withCreationResolution(
            existingRecord,
            solventMap,
            buildResolution({
              record: existingRecord,
              matchMethod: 'exact name',
              incomingName: payload.name,
              matchedName: existingRecord.name,
            }),
          );
        }
      }
      throw error;
    }

    const solventMap = await getSolventMap(record.dilution_solvent_id ? [record.dilution_solvent_id] : []);
    await syncManualReferenceProfileForRawMaterial({
      ...record,
      __referenceSourceSnapshots: data?.__referenceSourceSnapshots || null,
      __referenceFieldLocks: data?.__referenceFieldLocks || null,
    });
    clearRawMaterialOptionsCache();
    return withCreationResolution(record, solventMap);
  } catch (error) {
    console.error('Error creating raw material:', error);
    throw new Error(error.message || 'Failed to create raw material');
  }
};

export const updateRawMaterial = async (id, data) => {
  try {
    const { data: currentRecord, error: currentRecordError } = await supabase
      .from('raw_materials')
      .select('*')
      .eq('id', id)
      .single();

    if (currentRecordError) {
      throw currentRecordError;
    }

      const mergedData = {
        ...currentRecord,
        ...data,
      };
      const payload = buildRawMaterialPayload(mergedData);

      const duplicateWorkbookCodeRecord = payload.workbook_code
        ? await findExistingRawMaterialByWorkbookCode(currentRecord.user_id, payload.workbook_code, id)
        : null;
      if (duplicateWorkbookCodeRecord) {
        throw new Error(`Workbook code "${payload.workbook_code}" sudah dipakai oleh raw material "${duplicateWorkbookCodeRecord.name}".`);
      }

      // Validate dilution fields
      if (mergedData.is_diluted) {
        if (!mergedData.dilution_solvent_id) {
          throw new Error('Dilution solvent is required for diluted materials');
      }
      if (!mergedData.dilution_percentage || mergedData.dilution_percentage <= 0 || mergedData.dilution_percentage > 100) {
        throw new Error('Dilution percentage must be between 0 and 100');
      }
    }

    const { data: record, error } = await supabase
      .from('raw_materials')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

      if (error) {
        if (error.code === '23505' && error.message?.includes('raw_materials_unique_workbook_code_per_user')) {
          throw new Error(`Workbook code "${payload.workbook_code}" sudah dipakai oleh raw material lain.`);
        }
        throw error;
      }

    const solventMap = await getSolventMap(record.dilution_solvent_id ? [record.dilution_solvent_id] : []);
    await syncManualReferenceProfileForRawMaterial({
      ...record,
      __referenceSourceSnapshots: data?.__referenceSourceSnapshots || null,
      __referenceFieldLocks: data?.__referenceFieldLocks || null,
    });
    clearRawMaterialOptionsCache();
    return mapRawMaterial(record, solventMap);
  } catch (error) {
    console.error('Error updating raw material:', error);
    throw new Error(error.message || 'Failed to update raw material');
  }
};

const hasMeaningfulText = (value) => String(value || '').trim().length > 0;

const hasMeaningfulValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';

const preferMissingText = (currentValue, fallbackValue) => (
  hasMeaningfulText(currentValue) ? currentValue : (hasMeaningfulText(fallbackValue) ? fallbackValue : null)
);

const preferPositiveNumber = (currentValue, fallbackValue) => {
  const currentNumber = Number(currentValue);
  if (Number.isFinite(currentNumber) && currentNumber > 0) {
    return currentNumber;
  }

  const fallbackNumber = Number(fallbackValue);
  return Number.isFinite(fallbackNumber) ? fallbackNumber : null;
};

const preferDefinedNumber = (currentValue, fallbackValue) => (
  hasMeaningfulValue(currentValue) ? Number(currentValue) : (hasMeaningfulValue(fallbackValue) ? Number(fallbackValue) : null)
);

const mergeMaterialNotes = (masterRecord, duplicateRecord) => {
  const masterNotes = String(masterRecord.notes || '').trim();
  const duplicateNotes = String(duplicateRecord.notes || '').trim();

  if (!duplicateNotes) {
    return masterNotes || null;
  }

  if (!masterNotes) {
    return duplicateNotes;
  }

  if (masterNotes === duplicateNotes || masterNotes.includes(duplicateNotes)) {
    return masterNotes;
  }

  return `${masterNotes}\n\nMerged duplicate note from ${duplicateRecord.name}:\n${duplicateNotes}`;
};

const validateMergeableRawMaterials = (masterRecord, duplicateRecord) => {
  if (!masterRecord || !duplicateRecord) {
    throw new Error('Raw material merge requires both a master and a duplicate row.');
  }

  if (masterRecord.id === duplicateRecord.id) {
    throw new Error('Master and duplicate raw material cannot be the same row.');
  }

  if (masterRecord.user_id !== duplicateRecord.user_id) {
    throw new Error('Cannot merge raw materials from different users.');
  }

  if (masterRecord.type !== duplicateRecord.type) {
    throw new Error('Cannot merge rows with different raw material types.');
  }

  if (Boolean(masterRecord.is_diluted) !== Boolean(duplicateRecord.is_diluted)) {
    throw new Error('Cannot merge diluted and non-diluted raw materials automatically.');
  }

  if (String(masterRecord.dilution_solvent_id || '') === duplicateRecord.id || String(duplicateRecord.dilution_solvent_id || '') === masterRecord.id) {
    throw new Error('Cannot merge rows that reference each other as dilution solvent. Review manually first.');
  }

  if (masterRecord.is_diluted) {
    if (String(masterRecord.dilution_solvent_id || '') !== String(duplicateRecord.dilution_solvent_id || '')) {
      throw new Error('Cannot merge diluted raw materials with different solvent links automatically.');
    }

    if (Number(masterRecord.dilution_percentage || 0) !== Number(duplicateRecord.dilution_percentage || 0)) {
      throw new Error('Cannot merge diluted raw materials with different dilution percentages automatically.');
    }
  }

  const masterWorkbookCode = normalizeLookupValue(masterRecord.workbook_code);
  const duplicateWorkbookCode = normalizeLookupValue(duplicateRecord.workbook_code);
  if (masterWorkbookCode && duplicateWorkbookCode && masterWorkbookCode !== duplicateWorkbookCode) {
    throw new Error('Cannot merge rows that have different workbook codes.');
  }

  const masterCas = normalizeCasValue(masterRecord.cas_number);
  const duplicateCas = normalizeCasValue(duplicateRecord.cas_number);
  if (
    masterCas
    && duplicateCas
    && !INVALID_CAS_MATCH_VALUES.has(masterCas)
    && !INVALID_CAS_MATCH_VALUES.has(duplicateCas)
    && masterCas !== duplicateCas
  ) {
    throw new Error('Cannot merge rows that have different CAS numbers.');
  }
};

const buildMergedRawMaterialData = (masterRecord, duplicateRecord) => ({
  ...masterRecord,
  workbook_code: preferMissingText(masterRecord.workbook_code, duplicateRecord.workbook_code),
  scent_family: preferMissingText(masterRecord.scent_family, duplicateRecord.scent_family),
  supplier_name: preferMissingText(masterRecord.supplier_name, duplicateRecord.supplier_name),
  vendor: preferMissingText(masterRecord.vendor, duplicateRecord.vendor),
  description: preferMissingText(masterRecord.description, duplicateRecord.description),
  notes: mergeMaterialNotes(masterRecord, duplicateRecord),
  cas_number: preferMissingText(masterRecord.cas_number, duplicateRecord.cas_number),
  ifra_limit: preferDefinedNumber(masterRecord.ifra_limit, duplicateRecord.ifra_limit),
  reference_abc_primary_family: preferMissingText(
    masterRecord.reference_abc_primary_family,
    duplicateRecord.reference_abc_primary_family
  ),
  reference_impact: preferPositiveNumber(masterRecord.reference_impact, duplicateRecord.reference_impact),
  reference_life_hours: preferPositiveNumber(masterRecord.reference_life_hours, duplicateRecord.reference_life_hours),
  reference_use_level_typical_percent: preferDefinedNumber(
    masterRecord.reference_use_level_typical_percent,
    duplicateRecord.reference_use_level_typical_percent
  ),
  reference_use_level_max_percent: preferDefinedNumber(
    masterRecord.reference_use_level_max_percent,
    duplicateRecord.reference_use_level_max_percent
  ),
  cost_per_unit: Number(masterRecord.cost_per_unit || 0) > 0
    ? Number(masterRecord.cost_per_unit || 0)
    : Number(duplicateRecord.cost_per_unit || 0),
});

const moveRowsByRawMaterialId = async ({
  table,
  duplicateId,
  masterId,
  conflictColumns = [],
}) => {
  const baseColumns = ['id', ...conflictColumns];
  const selectColumns = [...new Set(baseColumns)].join(', ');

  const [duplicateResult, masterResult] = await Promise.all([
    supabase
      .from(table)
      .select(selectColumns)
      .eq('raw_material_id', duplicateId),
    supabase
      .from(table)
      .select(selectColumns)
      .eq('raw_material_id', masterId),
  ]);

  if (duplicateResult.error) {
    throw duplicateResult.error;
  }

  if (masterResult.error) {
    throw masterResult.error;
  }

  const masterConflictKeys = new Set(
    (masterResult.data || []).map((row) => conflictColumns.map((column) => String(row[column] || '')).join('::'))
  );

  const duplicateRows = duplicateResult.data || [];
  const conflictingDuplicateIds = duplicateRows
    .filter((row) => conflictColumns.length > 0 && masterConflictKeys.has(conflictColumns.map((column) => String(row[column] || '')).join('::')))
    .map((row) => row.id);

  if (conflictingDuplicateIds.length) {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .in('id', conflictingDuplicateIds);

    if (deleteError) {
      throw deleteError;
    }
  }

  const remainingDuplicateIds = duplicateRows
    .map((row) => row.id)
    .filter((id) => !conflictingDuplicateIds.includes(id));

  if (remainingDuplicateIds.length) {
    const { error: updateError } = await supabase
      .from(table)
      .update({ raw_material_id: masterId })
      .in('id', remainingDuplicateIds);

    if (updateError) {
      throw updateError;
    }
  }
};

const mergeReferenceLinksIntoMaster = async ({ masterId, duplicateId }) => {
  const { data: links, error } = await supabase
    .from('raw_material_reference_links')
    .select('id, raw_material_id, reference_profile_id, match_method, match_confidence, is_primary, notes')
    .in('raw_material_id', [masterId, duplicateId]);

  if (error) {
    throw error;
  }

  const masterLinks = (links || []).filter((row) => row.raw_material_id === masterId);
  const duplicateLinks = (links || []).filter((row) => row.raw_material_id === duplicateId);
  const masterReferenceIds = new Set(masterLinks.map((row) => row.reference_profile_id));
  let masterHasPrimary = masterLinks.some((row) => row.is_primary);

  for (const link of duplicateLinks) {
    if (masterReferenceIds.has(link.reference_profile_id)) {
      const { error: deleteError } = await supabase
        .from('raw_material_reference_links')
        .delete()
        .eq('id', link.id);

      if (deleteError) {
        throw deleteError;
      }
      continue;
    }

    const nextPrimary = Boolean(link.is_primary) && !masterHasPrimary;
    const { error: updateError } = await supabase
      .from('raw_material_reference_links')
      .update({
        raw_material_id: masterId,
        is_primary: nextPrimary,
      })
      .eq('id', link.id);

    if (updateError) {
      throw updateError;
    }

    masterReferenceIds.add(link.reference_profile_id);
    if (nextPrimary) {
      masterHasPrimary = true;
    }
  }
};

const mergeManualReferenceProfilesIntoMaster = async ({ masterId, duplicateId }) => {
  const { data: profiles, error } = await supabase
    .from('material_reference_profiles')
    .select('id, source_raw_material_id')
    .eq('source_kind', 'manual')
    .in('source_raw_material_id', [masterId, duplicateId]);

  if (error) {
    throw error;
  }

  const masterProfile = (profiles || []).find((row) => row.source_raw_material_id === masterId) || null;
  const duplicateProfile = (profiles || []).find((row) => row.source_raw_material_id === duplicateId) || null;

  if (!duplicateProfile) {
    return;
  }

  if (!masterProfile) {
    const { error: reassignError } = await supabase
      .from('material_reference_profiles')
      .update({ source_raw_material_id: masterId })
      .eq('id', duplicateProfile.id);

    if (reassignError) {
      throw reassignError;
    }
    return;
  }

  const { error: deleteError } = await supabase
    .from('material_reference_profiles')
    .delete()
    .eq('id', duplicateProfile.id);

  if (deleteError) {
    throw deleteError;
  }
};

const getOwnedRawMaterialRecord = async (userId, rawMaterialId) => {
  const { data, error } = await supabase
    .from('raw_materials')
    .select('*')
    .eq('user_id', userId)
    .eq('id', rawMaterialId)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const mergeRawMaterialIntoMaster = async (masterId, duplicateId) => {
  try {
    const userId = await getCurrentUserId();
    const [masterRecord, duplicateRecord] = await Promise.all([
      getOwnedRawMaterialRecord(userId, masterId),
      getOwnedRawMaterialRecord(userId, duplicateId),
    ]);

    validateMergeableRawMaterials(masterRecord, duplicateRecord);
    const mergedData = buildMergedRawMaterialData(masterRecord, duplicateRecord);

    await moveRowsByRawMaterialId({
      table: 'brief_material_shortlists',
      duplicateId,
      masterId,
      conflictColumns: ['brief_id'],
    });

    await moveRowsByRawMaterialId({
      table: 'brief_project_stage_items',
      duplicateId,
      masterId,
      conflictColumns: ['project_id', 'stage'],
    });

    await mergeReferenceLinksIntoMaster({ masterId, duplicateId });
    await mergeManualReferenceProfilesIntoMaster({ masterId, duplicateId });

    const tableUpdates = [
      supabase
        .from('formula_items')
        .update({ item_id: masterId })
        .in('item_type', ['raw_material', 'solvent'])
        .eq('item_id', duplicateId),
      supabase
        .from('formula_items')
        .update({ dilution_solvent_id: masterId })
        .eq('dilution_solvent_id', duplicateId),
      supabase
        .from('accord_items')
        .update({ raw_material_id: masterId })
        .eq('raw_material_id', duplicateId),
      supabase
        .from('accord_items')
        .update({ dilution_solvent_id: masterId })
        .eq('dilution_solvent_id', duplicateId),
      supabase
        .from('batches')
        .update({ solvent_id: masterId })
        .eq('solvent_id', duplicateId),
      supabase
        .from('batch_usage_records')
        .update({ raw_material_id: masterId })
        .eq('raw_material_id', duplicateId),
      supabase
        .from('raw_materials')
        .update({ dilution_solvent_id: masterId })
        .eq('dilution_solvent_id', duplicateId)
        .neq('id', masterId),
    ];

    const results = await Promise.all(tableUpdates);
    const failedResult = results.find((result) => result.error);
    if (failedResult?.error) {
      throw failedResult.error;
    }

    const { error: deleteError } = await supabase
      .from('raw_materials')
      .delete()
      .eq('id', duplicateId)
      .eq('user_id', userId);

    if (deleteError) {
      throw deleteError;
    }

    const payload = buildRawMaterialPayload(mergedData);
    const { data: updatedMaster, error: updateError } = await supabase
      .from('raw_materials')
      .update(payload)
      .eq('id', masterId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (updateError) {
      throw updateError;
    }

    const solventMap = await getSolventMap(updatedMaster.dilution_solvent_id ? [updatedMaster.dilution_solvent_id] : []);
    await syncManualReferenceProfileForRawMaterial(updatedMaster);
    clearRawMaterialOptionsCache();

    return {
      master: mapRawMaterial(updatedMaster, solventMap),
      removedRawMaterialId: duplicateId,
    };
  } catch (error) {
    console.error('Error merging raw materials:', error);
    throw new Error(error.message || 'Failed to merge raw materials');
  }
};

export const getRawMaterialDeletionDependencies = async (id) => {
  const [
    formulaUsageResult,
    formulaDilutionUsageResult,
  ] = await Promise.all([
    supabase
      .from('formula_items')
      .select('id', { count: 'exact', head: true })
      .in('item_type', ['raw_material', 'solvent'])
      .eq('item_id', id),
    supabase
      .from('formula_items')
      .select('id', { count: 'exact', head: true })
      .eq('dilution_solvent_id', id),
  ]);

  const dependencyErrors = [
    formulaUsageResult,
    formulaDilutionUsageResult,
  ].filter((result) => result.error);

  if (dependencyErrors.length) {
    throw dependencyErrors[0].error;
  }

  return [
    { label: 'formula items', count: formulaUsageResult.count || 0 },
    { label: 'formula dilution solvents', count: formulaDilutionUsageResult.count || 0 },
  ].filter((entry) => entry.count > 0);
};

export const deleteRawMaterial = async (id) => {
  try {
    const blockers = await getRawMaterialDeletionDependencies(id);

    if (blockers.length) {
      const blockerSummary = blockers
        .map((entry) => `${entry.count} ${entry.label}`)
        .join(', ');
      throw new Error(`Cannot delete raw material because it is still used in ${blockerSummary}. Remove those references first.`);
    }

    await removeReferenceArtifactsForRawMaterial(id);

    const [deleteAccordItemsError, deleteAccordDilutionItemsError] = await Promise.all([
      supabase
        .from('accord_items')
        .delete()
        .eq('raw_material_id', id),
      supabase
        .from('accord_items')
        .delete()
        .eq('dilution_solvent_id', id),
    ]).then((results) => results.map((result) => result.error));

    if (deleteAccordItemsError || deleteAccordDilutionItemsError) {
      throw deleteAccordItemsError || deleteAccordDilutionItemsError;
    }

    const { error } = await supabase
      .from('raw_materials')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
    clearRawMaterialOptionsCache();
  } catch (error) {
    console.error('Error deleting raw material:', error);
    if (error?.code === '23503') {
      throw new Error('Cannot delete raw material because it is still referenced by other records.');
    }

    throw new Error(error.message || 'Failed to delete raw material');
  }
};

