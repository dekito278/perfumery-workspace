#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import {
  normalizeLookupValue,
  normalizeWhitespace,
  parseArgs,
  readJsonFile,
} from './material-reference-common.mjs';

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);
const DEFAULT_EXPORT_DIR = path.resolve(CURRENT_DIR, '../../../docs/material-reference-export');
const DEFAULT_PROFILE_FILE = 'reference-profiles.json';
const DEFAULT_FACET_FILE = 'reference-odour-facets.json';
const INVALID_CAS_VALUES = new Set(['mixture', '*mixture', 'mix', 'n/a', 'na', 'unknown']);

const splitSynonyms = (value) =>
  String(value || '')
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);

const readEnvFile = (targetPath) => Object.fromEntries(
  fs.readFileSync(targetPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separatorIndex = line.indexOf('=');
      return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
    })
);

const createUserClient = ({ supabaseUrl, anonKey }) => createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const buildReferenceLookup = (profiles) => {
  const lookup = {
    byReferenceCode: new Map(),
    byCas: new Map(),
    byName: new Map(),
    bySynonym: new Map(),
  };

  for (const profile of profiles) {
    const referenceCode = normalizeLookupValue(profile.reference_code);
    if (referenceCode) {
      lookup.byReferenceCode.set(referenceCode, profile);
    }

    const casNumber = normalizeLookupValue(profile.cas_no);
    if (casNumber && !INVALID_CAS_VALUES.has(casNumber) && !lookup.byCas.has(casNumber)) {
      lookup.byCas.set(casNumber, profile);
    }

    const normalizedName = normalizeLookupValue(profile.name);
    if (normalizedName) {
      lookup.byName.set(normalizedName, profile);
    }

    splitSynonyms(profile.synonym).forEach((synonym) => {
      const normalizedSynonym = normalizeLookupValue(synonym);
      if (!normalizedSynonym || lookup.bySynonym.has(normalizedSynonym)) {
        return;
      }

      lookup.bySynonym.set(normalizedSynonym, profile);
    });
  }

  return lookup;
};

const scoreMatch = (rawMaterial, lookup) => {
  const workbookCode = normalizeLookupValue(rawMaterial.workbook_code);
  if (workbookCode && lookup.byReferenceCode.has(workbookCode)) {
    return {
      profile: lookup.byReferenceCode.get(workbookCode),
      match_method: 'workbook_code_exact_local_export',
      match_confidence: 1,
    };
  }

  const casNumber = normalizeLookupValue(rawMaterial.cas_number);
  if (casNumber && !INVALID_CAS_VALUES.has(casNumber) && lookup.byCas.has(casNumber)) {
    return {
      profile: lookup.byCas.get(casNumber),
      match_method: 'cas_exact_local_export',
      match_confidence: 0.98,
    };
  }

  const normalizedName = normalizeLookupValue(rawMaterial.name);
  if (normalizedName && lookup.byName.has(normalizedName)) {
    return {
      profile: lookup.byName.get(normalizedName),
      match_method: 'name_exact_local_export',
      match_confidence: 0.95,
    };
  }

  if (normalizedName && lookup.bySynonym.has(normalizedName)) {
    return {
      profile: lookup.bySynonym.get(normalizedName),
      match_method: 'synonym_exact_local_export',
      match_confidence: 0.9,
    };
  }

  return null;
};

const buildManualReferenceCode = (rawMaterialId) => (
  `MAN-${String(rawMaterialId || '').replace(/-/g, '').slice(0, 12).toUpperCase()}`
);

const buildManualProfilePayload = ({ rawMaterial, profile, userId }) => ({
  owner_user_id: userId,
  source_kind: 'manual',
  source_raw_material_id: rawMaterial.id,
  reference_code: buildManualReferenceCode(rawMaterial.id),
  name: profile.name || rawMaterial.name,
  synonym: profile.synonym || null,
  supplier: profile.supplier || rawMaterial.vendor || rawMaterial.supplier_name || null,
  abc_code: profile.abc_code || rawMaterial.workbook_code || null,
  abc_primary_letter: profile.abc_primary_letter || null,
  abc_primary_family: profile.abc_primary_family || rawMaterial.reference_abc_primary_family || rawMaterial.scent_family || null,
  abc_secondary_letter: profile.abc_secondary_letter || null,
  abc_secondary_family: profile.abc_secondary_family || null,
  category: profile.category || rawMaterial.category || null,
  catalog_tag: profile.catalog_tag || null,
  classification: profile.classification || null,
  brief_description: profile.brief_description || rawMaterial.description || null,
  odour_description: profile.odour_description || rawMaterial.description || null,
  odour_profile: profile.odour_profile || null,
  perfume_uses: profile.perfume_uses || null,
  flavour_uses: profile.flavour_uses || null,
  function_labels: profile.function_labels || null,
  function_raw: profile.function_raw || null,
  order_no: profile.order_no || null,
  impact: profile.impact ?? rawMaterial.reference_impact ?? null,
  life_hours: profile.life_hours ?? rawMaterial.reference_life_hours ?? null,
  use_level_min_percent: profile.use_level_min_percent ?? null,
  use_level_typical_percent: profile.use_level_typical_percent ?? rawMaterial.reference_use_level_typical_percent ?? null,
  use_level_max_percent: profile.use_level_max_percent ?? rawMaterial.reference_use_level_max_percent ?? null,
  ifra_limit_percent: profile.ifra_limit_percent ?? rawMaterial.ifra_limit ?? null,
  stability_heat: profile.stability_heat || null,
  stability_discolour: profile.stability_discolour || null,
  stability_storage: profile.stability_storage || null,
  stability_antioxidant: profile.stability_antioxidant || null,
  stability_summary: profile.stability_summary || null,
  physical_state: profile.physical_state || null,
  mol_formula: profile.mol_formula || null,
  molecular_weight: profile.molecular_weight ?? null,
  cas_no: profile.cas_no || rawMaterial.cas_number || null,
  safety: profile.safety || null,
  ifra: profile.ifra || null,
  pw_price: profile.pw_price ?? null,
  catalog_price: profile.catalog_price ?? null,
  catalog_available: profile.catalog_available || null,
  catalog_unit: profile.catalog_unit || null,
  source_workbook_path: profile.source_workbook_path || null,
  source_catalog_path: profile.source_catalog_path || null,
  raw_payload: {
    ...(profile.raw_payload && typeof profile.raw_payload === 'object' ? profile.raw_payload : {}),
    source: 'local_reference_export_sync',
    synced_from_reference_code: profile.reference_code,
    synced_for_raw_material_id: rawMaterial.id,
    synced_for_raw_material_name: rawMaterial.name,
  },
});

const fetchUserState = async (supabase, userId) => {
  const [{ data: rawMaterials, error: rawError }, { data: links, error: linksError }] = await Promise.all([
    supabase
      .from('raw_materials')
      .select('id, user_id, name, workbook_code, cas_number, category, type, unit, vendor, supplier_name, description, scent_family, ifra_limit, reference_abc_primary_family, reference_impact, reference_life_hours, reference_use_level_typical_percent, reference_use_level_max_percent')
      .eq('user_id', userId)
      .order('name', { ascending: true }),
    supabase
      .from('raw_material_reference_links')
      .select('id, raw_material_id, reference_profile_id, is_primary')
      .eq('is_primary', true),
  ]);

  if (rawError) {
    throw new Error(rawError.message || 'Failed to fetch raw materials');
  }

  if (linksError) {
    throw new Error(linksError.message || 'Failed to fetch reference links');
  }

  return {
    rawMaterials: rawMaterials || [],
    links: links || [],
  };
};

const upsertManualProfile = async (supabase, payload) => {
  const { data: existingProfile, error: existingError } = await supabase
    .from('material_reference_profiles')
    .select('id')
    .eq('source_kind', 'manual')
    .eq('source_raw_material_id', payload.source_raw_material_id)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || `Failed to load manual profile for raw material ${payload.source_raw_material_id}`);
  }

  if (existingProfile?.id) {
    const { data, error } = await supabase
      .from('material_reference_profiles')
      .update(payload)
      .eq('id', existingProfile.id)
      .select('id')
      .single();

    if (error) {
      throw new Error(error.message || `Failed to update manual profile for raw material ${payload.source_raw_material_id}`);
    }

    return data.id;
  }

  const { data, error } = await supabase
    .from('material_reference_profiles')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message || `Failed to create manual profile for raw material ${payload.source_raw_material_id}`);
  }

  return data.id;
};

const replaceOdourFacets = async (supabase, referenceProfileId, facets) => {
  const { error: deleteError } = await supabase
    .from('material_reference_odour_facets')
    .delete()
    .eq('reference_profile_id', referenceProfileId);

  if (deleteError) {
    if (String(deleteError.message || '').toLowerCase().includes('row-level security')) {
      return false;
    }

    throw new Error(deleteError.message || `Failed to clear odour facets for profile ${referenceProfileId}`);
  }

  if (!facets.length) {
    return true;
  }

  const rows = facets.map((facet, index) => ({
    reference_profile_id: referenceProfileId,
    letter: facet.letter,
    family: facet.family || null,
    value: Number(facet.value || 0),
    description: facet.description || null,
    sort_order: facet.sort_order ?? index,
  }));

  const { error: insertError } = await supabase
    .from('material_reference_odour_facets')
    .insert(rows);

  if (insertError) {
    if (String(insertError.message || '').toLowerCase().includes('row-level security')) {
      return false;
    }

    throw new Error(insertError.message || `Failed to insert odour facets for profile ${referenceProfileId}`);
  }

  return true;
};

const upsertPrimaryLink = async (supabase, { rawMaterialId, referenceProfileId, matchMethod, matchConfidence, notes }) => {
  const { data: existingLink, error: existingError } = await supabase
    .from('raw_material_reference_links')
    .select('id')
    .eq('raw_material_id', rawMaterialId)
    .eq('is_primary', true)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || `Failed to load existing link for raw material ${rawMaterialId}`);
  }

  if (existingLink?.id) {
    const { error } = await supabase
      .from('raw_material_reference_links')
      .update({
        reference_profile_id: referenceProfileId,
        match_method: matchMethod,
        match_confidence: matchConfidence,
        notes,
      })
      .eq('id', existingLink.id);

    if (error) {
      throw new Error(error.message || `Failed to update link for raw material ${rawMaterialId}`);
    }

    return;
  }

  const { error } = await supabase
    .from('raw_material_reference_links')
    .insert({
      raw_material_id: rawMaterialId,
      reference_profile_id: referenceProfileId,
      match_method: matchMethod,
      match_confidence: matchConfidence,
      is_primary: true,
      notes,
    });

  if (error) {
    throw new Error(error.message || `Failed to link raw material ${rawMaterialId}`);
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const email = String(args.get('email') || '').trim();
  const password = String(args.get('password') || '').trim();
  const shouldApply = Boolean(args.get('apply'));
  const envPath = path.resolve(String(args.get('env-file') || '.env'));
  const exportDir = path.resolve(String(args.get('export-dir') || DEFAULT_EXPORT_DIR));

  if (!email || !password) {
    throw new Error('--email and --password are required');
  }

  const env = readEnvFile(envPath);
  const supabase = createUserClient({
    supabaseUrl: env.VITE_SUPABASE_URL,
    anonKey: env.VITE_SUPABASE_ANON_KEY,
  });

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    throw new Error(authError.message || 'Failed to sign in');
  }

  const user = authData.user;
  if (!user) {
    throw new Error('Authenticated user not available');
  }

  const profiles = readJsonFile(path.join(exportDir, DEFAULT_PROFILE_FILE));
  const odourFacets = readJsonFile(path.join(exportDir, DEFAULT_FACET_FILE));
  const facetsByReferenceCode = new Map();

  for (const facet of odourFacets) {
    const referenceCode = String(facet.reference_code || '').trim();
    if (!referenceCode) {
      continue;
    }

    if (!facetsByReferenceCode.has(referenceCode)) {
      facetsByReferenceCode.set(referenceCode, []);
    }

    facetsByReferenceCode.get(referenceCode).push(facet);
  }

  const lookup = buildReferenceLookup(profiles);
  const { rawMaterials, links } = await fetchUserState(supabase, user.id);
  const linkedIds = new Set(links.map((row) => row.raw_material_id));
  const unmatchedMaterials = rawMaterials.filter((rawMaterial) => !linkedIds.has(rawMaterial.id));

  const matches = [];
  const unmatched = [];

  for (const rawMaterial of unmatchedMaterials) {
    const match = scoreMatch(rawMaterial, lookup);
    if (!match) {
      unmatched.push({
        raw_material_id: rawMaterial.id,
        name: rawMaterial.name,
        workbook_code: rawMaterial.workbook_code || null,
        cas_number: rawMaterial.cas_number || null,
      });
      continue;
    }

    matches.push({
      rawMaterial,
      profile: match.profile,
      match_method: match.match_method,
      match_confidence: match.match_confidence,
    });
  }

  const summary = {
    generated_at: new Date().toISOString(),
    user_id: user.id,
    total_raw_materials: rawMaterials.length,
    already_linked: linkedIds.size,
    unmatched_before: unmatchedMaterials.length,
    matched: matches.length,
    still_unmatched: unmatched.length,
    applied: 0,
    facet_sync_skipped: 0,
    by_method: matches.reduce((accumulator, match) => {
      accumulator[match.match_method] = (accumulator[match.match_method] || 0) + 1;
      return accumulator;
    }, {}),
    sample_matches: matches.slice(0, 20).map((match) => ({
      raw_material_id: match.rawMaterial.id,
      name: match.rawMaterial.name,
      workbook_code: match.rawMaterial.workbook_code || null,
      reference_code: match.profile.reference_code,
      reference_name: match.profile.name,
      match_method: match.match_method,
      match_confidence: match.match_confidence,
    })),
    sample_unmatched: unmatched.slice(0, 20),
  };

  if (!shouldApply) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  for (const match of matches) {
    const referenceProfileId = await upsertManualProfile(
      supabase,
      buildManualProfilePayload({
        rawMaterial: match.rawMaterial,
        profile: match.profile,
        userId: user.id,
      }),
    );

    const facetsSynced = await replaceOdourFacets(
      supabase,
      referenceProfileId,
      facetsByReferenceCode.get(match.profile.reference_code) || [],
    );
    if (!facetsSynced) {
      summary.facet_sync_skipped += 1;
    }

    await upsertPrimaryLink(supabase, {
      rawMaterialId: match.rawMaterial.id,
      referenceProfileId,
      matchMethod: match.match_method,
      matchConfidence: match.match_confidence,
      notes: `Synced from local reference export ${match.profile.reference_code} on ${new Date().toISOString()}`,
    });
  }

  summary.applied = matches.length;
  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
