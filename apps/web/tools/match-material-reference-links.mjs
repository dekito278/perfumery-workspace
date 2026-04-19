#!/usr/bin/env node

import path from 'node:path';
import {
  DEFAULT_SOURCE_DIR,
  createSupabaseAdminClient,
  ensureDirectoryExists,
  normalizeLookupValue,
  normalizeWhitespace,
  parseArgs,
  readJsonFile,
  toTextOrNull,
  writeJsonFile,
} from './material-reference-common.mjs';

const MATERIAL_REFERENCE_JSON = 'material-reference-clean.json';

const splitSynonyms = (value) =>
  String(value || '')
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);

const buildReferenceLookup = (profiles, rawMaterials, fallbackPayload) => {
  const lookup = {
    byWorkbookCode: new Map(),
    byCas: new Map(),
    byName: new Map(),
    bySynonym: new Map(),
  };

  const payloadMaterialsByReference = new Map(
    (fallbackPayload?.materials || []).map((material) => [toTextOrNull(material.reference), material])
  );

  for (const profile of profiles) {
    if (profile.reference_code) {
      lookup.byWorkbookCode.set(normalizeLookupValue(profile.reference_code), profile);
    }

    if (profile.cas_no) {
      lookup.byCas.set(normalizeLookupValue(profile.cas_no), profile);
    }

    if (profile.name) {
      lookup.byName.set(normalizeLookupValue(profile.name), profile);
    }

    const payloadMaterial = payloadMaterialsByReference.get(profile.reference_code);
    const synonyms = [
      ...splitSynonyms(profile.synonym),
      ...splitSynonyms(payloadMaterial?.synonym),
    ];

    synonyms.forEach((synonym) => {
      const key = normalizeLookupValue(synonym);
      if (!key || lookup.bySynonym.has(key)) {
        return;
      }
      lookup.bySynonym.set(key, profile);
    });
  }

  return lookup;
};

const scoreMatch = (material, lookup) => {
  const workbookCode = normalizeLookupValue(material.workbook_code);
  if (workbookCode && lookup.byWorkbookCode.has(workbookCode)) {
    return {
      profile: lookup.byWorkbookCode.get(workbookCode),
      match_method: 'workbook_code_exact',
      match_confidence: 1,
    };
  }

  const casNumber = normalizeLookupValue(material.cas_number);
  if (casNumber && lookup.byCas.has(casNumber)) {
    return {
      profile: lookup.byCas.get(casNumber),
      match_method: 'cas_exact',
      match_confidence: 0.98,
    };
  }

  const normalizedName = normalizeLookupValue(material.name);
  if (normalizedName && lookup.byName.has(normalizedName)) {
    return {
      profile: lookup.byName.get(normalizedName),
      match_method: 'name_exact',
      match_confidence: 0.95,
    };
  }

  if (normalizedName && lookup.bySynonym.has(normalizedName)) {
    return {
      profile: lookup.bySynonym.get(normalizedName),
      match_method: 'synonym_exact',
      match_confidence: 0.9,
    };
  }

  return null;
};

const fetchReferenceProfiles = async (supabase) => {
  const { data, error } = await supabase
    .from('material_reference_profiles')
    .select('id, reference_code, name, cas_no, synonym, abc_code');

  if (error) {
    throw new Error(error.message || 'Failed to load material reference profiles');
  }

  return data || [];
};

const fetchRawMaterials = async (supabase) => {
  const { data, error } = await supabase
    .from('raw_materials')
    .select('id, user_id, name, workbook_code, cas_number');

  if (error) {
    throw new Error(error.message || 'Failed to load raw materials');
  }

  return data || [];
};

const applyMatches = async (supabase, matches, threshold) => {
  const eligibleMatches = matches.filter((match) => match.match_confidence >= threshold);

  for (const match of eligibleMatches) {
    const { error } = await supabase
      .from('raw_material_reference_links')
      .upsert(
        {
          raw_material_id: match.raw_material_id,
          reference_profile_id: match.reference_profile_id,
          match_method: match.match_method,
          match_confidence: match.match_confidence,
          is_primary: true,
        },
        { onConflict: 'raw_material_id' }
      );

    if (error) {
      throw new Error(error.message || `Failed to upsert reference link for raw material ${match.raw_material_id}`);
    }
  }

  return eligibleMatches.length;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const outDir = args.get('out-dir') ? path.resolve(String(args.get('out-dir'))) : null;
  const shouldApply = Boolean(args.get('apply'));
  const threshold = Number(args.get('threshold') || 0.95);
  const sourceDir = path.resolve(String(args.get('source-dir') || DEFAULT_SOURCE_DIR));

  const supabase = createSupabaseAdminClient();
  const [profiles, rawMaterials] = await Promise.all([
    fetchReferenceProfiles(supabase),
    fetchRawMaterials(supabase),
  ]);

  const fallbackPayload = readJsonFile(path.join(sourceDir, MATERIAL_REFERENCE_JSON));
  const lookup = buildReferenceLookup(profiles, rawMaterials, fallbackPayload);

  const matches = [];
  const unmatched = [];

  for (const material of rawMaterials) {
    const match = scoreMatch(material, lookup);

    if (!match) {
      unmatched.push({
        raw_material_id: material.id,
        name: material.name,
        workbook_code: material.workbook_code || null,
        cas_number: material.cas_number || null,
      });
      continue;
    }

    matches.push({
      raw_material_id: material.id,
      user_id: material.user_id,
      name: material.name,
      workbook_code: material.workbook_code || null,
      cas_number: material.cas_number || null,
      reference_profile_id: match.profile.id,
      reference_code: match.profile.reference_code,
      reference_name: match.profile.name,
      match_method: match.match_method,
      match_confidence: match.match_confidence,
    });
  }

  const summary = {
    generated_at: new Date().toISOString(),
    threshold,
    total_raw_materials: rawMaterials.length,
    matched: matches.length,
    unmatched: unmatched.length,
    eligible_for_apply: matches.filter((match) => match.match_confidence >= threshold).length,
    applied: 0,
  };

  if (shouldApply) {
    summary.applied = await applyMatches(supabase, matches, threshold);
  }

  if (outDir) {
    ensureDirectoryExists(outDir);
    writeJsonFile(path.join(outDir, 'material-reference-match-summary.json'), summary);
    writeJsonFile(path.join(outDir, 'material-reference-matches.json'), matches);
    writeJsonFile(path.join(outDir, 'material-reference-unmatched.json'), unmatched);
  }

  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
