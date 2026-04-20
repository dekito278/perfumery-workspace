#!/usr/bin/env node

import path from 'node:path';
import {
  DEFAULT_SOURCE_DIR,
  chunkArray,
  createSupabaseAdminClient,
  ensureDirectoryExists,
  normalizeWhitespace,
  parseArgs,
  parseCsv,
  readJsonFile,
  toNumberOrNull,
  toPercentOrNull,
  toTextOrNull,
  writeJsonFile,
} from './material-reference-common.mjs';

const MATERIAL_REFERENCE_JSON = 'material-reference-no-dilute.json';
const ABC_REFERENCE_CSV = 'abc-classification-reference.csv';

const buildAbcFamilies = (rows) =>
  rows.map((row) => ({
    letter: toTextOrNull(row.letter),
    class_index: toNumberOrNull(row.class_index),
    family_name: toTextOrNull(row.family_name),
    description: toTextOrNull(row.description),
  })).filter((row) => row.letter && row.family_name);

const buildReferenceRecords = (payload) => {
  const sourceWorkbookPath = payload?.source_files?.workbook || null;
  const sourceCatalogPath = payload?.source_files?.catalog || null;

  const profilesByReferenceCode = new Map();
  const odourFacetsByKey = new Map();

  for (const material of payload?.materials || []) {
    const referenceCode = toTextOrNull(material.reference);
    const name = toTextOrNull(material.name);

    if (!referenceCode || !name) {
      continue;
    }

    profilesByReferenceCode.set(referenceCode, {
      reference_code: referenceCode,
      name,
      synonym: toTextOrNull(material.synonym),
      supplier: toTextOrNull(material.supplier),
      abc_code: toTextOrNull(material.abc_code),
      abc_primary_letter: toTextOrNull(material.abc_primary_letter),
      abc_primary_family: toTextOrNull(material.abc_primary_family),
      abc_secondary_letter: toTextOrNull(material.abc_secondary_letter),
      abc_secondary_family: toTextOrNull(material.abc_secondary_family),
      category: toTextOrNull(material.category),
      catalog_tag: toTextOrNull(material.catalog_tag),
      classification: toTextOrNull(material.classification),
      brief_description: toTextOrNull(material.brief_description),
      odour_description: toTextOrNull(material.odour_description),
      odour_profile: toTextOrNull(material.odour_profile),
      perfume_uses: toTextOrNull(material.perfume_uses),
      flavour_uses: toTextOrNull(material.flavour_uses),
      function_labels: toTextOrNull(material.function_labels),
      function_raw: toTextOrNull(material.function_raw),
      order_no: toTextOrNull(material.order_no),
      impact: toNumberOrNull(material.impact),
      life_hours: toNumberOrNull(material.life_hours),
      use_level_min_percent: toPercentOrNull(material.use_level_min_percent),
      use_level_typical_percent: toPercentOrNull(material.use_level_typical_percent),
      use_level_max_percent: toPercentOrNull(material.use_level_max_percent),
      ifra_limit_percent: toPercentOrNull(material.ifra_limit_percent),
      stability_heat: toTextOrNull(material.stability_heat),
      stability_discolour: toTextOrNull(material.stability_discolour),
      stability_storage: toTextOrNull(material.stability_storage),
      stability_antioxidant: toTextOrNull(material.stability_antioxidant),
      stability_summary: toTextOrNull(material.stability_summary),
      physical_state: toTextOrNull(material.state),
      mol_formula: toTextOrNull(material.mol_formula),
      molecular_weight: toNumberOrNull(material.molecular_weight),
      cas_no: toTextOrNull(material.cas_no),
      safety: toTextOrNull(material.safety),
      ifra: toTextOrNull(material.ifra),
      pw_price: toNumberOrNull(material.pw_price),
      catalog_price: toNumberOrNull(material.catalog_price),
      catalog_available: toTextOrNull(material.catalog_available),
      catalog_unit: toTextOrNull(material.catalog_unit),
      source_workbook_path: sourceWorkbookPath,
      source_catalog_path: sourceCatalogPath,
      raw_payload: material.raw_record || material,
    });

    const facets = Array.isArray(material.odour_profile_detail) ? material.odour_profile_detail : [];
    facets.forEach((facet, index) => {
      const letter = toTextOrNull(facet.letter);
      if (!letter) {
        return;
      }

      odourFacetsByKey.set(`${referenceCode}:${letter}`, {
        reference_code: referenceCode,
        letter,
        family: toTextOrNull(facet.family),
        value: toNumberOrNull(facet.value) ?? 0,
        description: toTextOrNull(facet.description),
        sort_order: index,
      });
    });
  }

  return {
    profiles: [...profilesByReferenceCode.values()],
    odourFacets: [...odourFacetsByKey.values()],
  };
};

const upsertAbcFamilies = async (supabase, rows) => {
  if (!rows.length) {
    return;
  }

  const { error } = await supabase
    .from('material_reference_abc_families')
    .upsert(rows, { onConflict: 'letter' });

  if (error) {
    throw new Error(error.message || 'Failed to upsert ABC families');
  }
};

const upsertReferenceProfiles = async (supabase, rows) => {
  for (const chunk of chunkArray(rows, 200)) {
    const { error } = await supabase
      .from('material_reference_profiles')
      .upsert(chunk, { onConflict: 'reference_code' });

    if (error) {
      throw new Error(error.message || 'Failed to upsert material reference profiles');
    }
  }
};

const syncOdourFacets = async (supabase, facets) => {
  if (!facets.length) {
    return;
  }

  const referenceCodes = [...new Set(facets.map((facet) => facet.reference_code))];
  const { data: profiles, error: profileError } = await supabase
    .from('material_reference_profiles')
    .select('id, reference_code')
    .in('reference_code', referenceCodes);

  if (profileError) {
    throw new Error(profileError.message || 'Failed to fetch reference profile ids');
  }

  const profileIdByReferenceCode = new Map((profiles || []).map((profile) => [profile.reference_code, profile.id]));
  const profileIds = [...profileIdByReferenceCode.values()];

  if (profileIds.length) {
    const { error: deleteError } = await supabase
      .from('material_reference_odour_facets')
      .delete()
      .in('reference_profile_id', profileIds);

    if (deleteError) {
      throw new Error(deleteError.message || 'Failed to clear existing odour facets');
    }
  }

  const nextRows = facets
    .map((facet) => ({
      reference_profile_id: profileIdByReferenceCode.get(facet.reference_code),
      letter: facet.letter,
      family: facet.family,
      value: facet.value,
      description: facet.description,
      sort_order: facet.sort_order,
    }))
    .filter((facet) => facet.reference_profile_id);

  for (const chunk of chunkArray(nextRows, 500)) {
    const { error } = await supabase
      .from('material_reference_odour_facets')
      .insert(chunk);

    if (error) {
      throw new Error(error.message || 'Failed to insert odour facets');
    }
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = path.resolve(String(args.get('source-dir') || DEFAULT_SOURCE_DIR));
  const outDir = args.get('out-dir') ? path.resolve(String(args.get('out-dir'))) : null;
  const shouldApply = Boolean(args.get('apply'));

  const materialReferencePath = path.join(sourceDir, MATERIAL_REFERENCE_JSON);
  const abcReferencePath = path.join(sourceDir, ABC_REFERENCE_CSV);

  const materialReferencePayload = readJsonFile(materialReferencePath);
  const abcRows = parseCsv(normalizeWhitespaceCsv(await BunOrNodeRead(abcReferencePath)));

  const abcFamilies = buildAbcFamilies(abcRows);
  const { profiles, odourFacets } = buildReferenceRecords(materialReferencePayload);

  const summary = {
    generated_at: new Date().toISOString(),
    source_dir: sourceDir,
    reference_records: profiles.length,
    odour_facet_records: odourFacets.length,
    abc_family_records: abcFamilies.length,
    should_apply: shouldApply,
  };

  if (outDir) {
    ensureDirectoryExists(outDir);
    writeJsonFile(path.join(outDir, 'abc-families.json'), abcFamilies);
    writeJsonFile(path.join(outDir, 'reference-profiles.json'), profiles);
    writeJsonFile(path.join(outDir, 'reference-odour-facets.json'), odourFacets);
    writeJsonFile(path.join(outDir, 'summary.json'), summary);
  }

  if (shouldApply) {
    const supabase = createSupabaseAdminClient();
    await upsertAbcFamilies(supabase, abcFamilies);
    await upsertReferenceProfiles(supabase, profiles);
    await syncOdourFacets(supabase, odourFacets);
  }

  console.log(JSON.stringify(summary, null, 2));
};

const BunOrNodeRead = async (targetPath) => {
  const fs = await import('node:fs/promises');
  return fs.readFile(targetPath, 'utf8');
};

const normalizeWhitespaceCsv = (content) =>
  String(content || '').replace(/^\uFEFF/, '');

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
