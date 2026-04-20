#!/usr/bin/env node

import path from 'node:path';
import {
  DEFAULT_SOURCE_DIR,
  createSupabaseAdminClient,
  ensureDirectoryExists,
  hasSupabaseAdminEnv,
  parseArgs,
  readJsonFile,
  toPercentOrNull,
  toTextOrNull,
  writeJsonFile,
} from './material-reference-common.mjs';

const MATERIAL_REFERENCE_JSON = 'material-reference-no-dilute.json';
const DEFAULT_OUTPUT_DIR = path.resolve('../../docs/material-library-seed');
const DEFAULT_STOCK_QUANTITY = 1000;
const DEFAULT_MINIMUM_STOCK = 1;
const DEFAULT_UNIT = 'ml';
const DEFAULT_COST_PER_UNIT = 0;

const CATEGORY_DEFINITIONS = new Map([
  ['A', { label: 'A - ALI-FAT-IC', scentFamily: 'Fatty', type: 'material' }],
  ['B', { label: 'B - Berg-ICEBERG', scentFamily: 'Fresh', type: 'material' }],
  ['C', { label: 'C - CITRUS', scentFamily: 'Citrus', type: 'material' }],
  ['D', { label: 'D - DAIRY', scentFamily: 'Dairy', type: 'material' }],
  ['E', { label: 'E - EDIBLE', scentFamily: 'Edible', type: 'material' }],
  ['F', { label: 'F - FRUIT', scentFamily: 'Fruity', type: 'material' }],
  ['G', { label: 'G - GREEN', scentFamily: 'Green', type: 'material' }],
  ['H', { label: 'H - HERB (Cool)', scentFamily: 'Herbal', type: 'material' }],
  ['I', { label: 'I - IRIS', scentFamily: 'Powdery', type: 'material' }],
  ['J', { label: 'J - JASMIN', scentFamily: 'Floral', type: 'material' }],
  ['K', { label: 'K - KONIFER', scentFamily: 'Coniferous', type: 'material' }],
  ['L', { label: 'L - LIGHT Chemical Floral', scentFamily: 'Floral', type: 'material' }],
  ['M', { label: 'M - MUGUET', scentFamily: 'Floral', type: 'material' }],
  ['N', { label: 'N - NARCOTIC', scentFamily: 'Floral', type: 'material' }],
  ['O', { label: 'O - ORCHID', scentFamily: 'Floral', type: 'material' }],
  ['P', { label: 'P - PHENOL', scentFamily: 'Phenolic', type: 'material' }],
  ['Q', { label: 'Q - Queen of the ORIENT', scentFamily: 'Resinous', type: 'material' }],
  ['R', { label: 'R - ROSE', scentFamily: 'Rose', type: 'material' }],
  ['S', { label: 'S - SPICE (Hot)', scentFamily: 'Spicy', type: 'material' }],
  ['T', { label: 'T - TAR SMOKE', scentFamily: 'Smoky', type: 'material' }],
  ['U', { label: 'U - Urine Faecal ANIMAL', scentFamily: 'Animalic', type: 'material' }],
  ['V', { label: 'V - VANILLA', scentFamily: 'Gourmand', type: 'material' }],
  ['W', { label: 'W - WOOD', scentFamily: 'Woody', type: 'material' }],
  ['X', { label: 'X - X-rated MUSK', scentFamily: 'Musky', type: 'material' }],
  ['Y', { label: 'Y - EARTHY MOSSY', scentFamily: 'Earthy', type: 'material' }],
  ['Z', { label: 'Z - ZOLVENTS', scentFamily: 'Solvent', type: 'solvent' }],
]);

const getCategoryMeta = (abcPrimaryLetter) =>
  CATEGORY_DEFINITIONS.get(String(abcPrimaryLetter || '').trim().toUpperCase())
  || { label: 'L - LIGHT Chemical Floral', scentFamily: 'Floral', type: 'material' };

const inferPyramidPlacement = (lifeHours) => {
  const numericLifeHours = Number(lifeHours);
  if (!Number.isFinite(numericLifeHours)) {
    return null;
  }

  if (numericLifeHours < 12) {
    return 'top';
  }

  if (numericLifeHours < 120) {
    return 'middle';
  }

  return 'base';
};

const toDefaultNotes = (referenceRecord) => [
  'Seeded from Perfumer\'s Workbook reference library.',
  referenceRecord.reference ? `Reference code: ${referenceRecord.reference}` : null,
  referenceRecord.supplier ? `Workbook supplier: ${referenceRecord.supplier}` : null,
].filter(Boolean).join(' ');

const buildSeedMaterial = (referenceRecord) => {
  const categoryMeta = getCategoryMeta(referenceRecord.abc_primary_letter);
  const description = toTextOrNull(referenceRecord.brief_description || referenceRecord.odour_description);
  const ifraLimit = toPercentOrNull(referenceRecord.ifra_limit_percent);
  const workbookCode = toTextOrNull(referenceRecord.reference);

  return {
    workbook_code: workbookCode,
    name: toTextOrNull(referenceRecord.name),
    category: categoryMeta.label,
    type: categoryMeta.type,
    scent_family: categoryMeta.scentFamily,
    stock_quantity: DEFAULT_STOCK_QUANTITY,
    unit: DEFAULT_UNIT,
    cost_per_unit: DEFAULT_COST_PER_UNIT,
    minimum_stock: DEFAULT_MINIMUM_STOCK,
    low_stock_threshold: DEFAULT_MINIMUM_STOCK,
    vendor: null,
    supplier_name: toTextOrNull(referenceRecord.supplier),
    cas_number: toTextOrNull(referenceRecord.cas_no),
    ifra_limit: ifraLimit,
    description,
    notes: toDefaultNotes(referenceRecord),
    pyramid_placement: inferPyramidPlacement(referenceRecord.life_hours),
  };
};

const loadAllUsers = async (supabase) => {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw new Error(error.message || 'Failed to load auth users');
    }

    const batch = data?.users || [];
    users.push(...batch);

    if (batch.length < 200) {
      break;
    }

    page += 1;
  }

  return users;
};

const loadReferenceProfiles = async (supabase) => {
  const { data, error } = await supabase
    .from('material_reference_profiles')
    .select('id, reference_code, name');

  if (error) {
    throw new Error(error.message || 'Failed to load material reference profiles');
  }

  return data || [];
};

const loadExistingRawMaterials = async (supabase) => {
  const { data, error } = await supabase
    .from('raw_materials')
    .select('id, user_id, name, workbook_code');

  if (error) {
    throw new Error(error.message || 'Failed to load existing raw materials');
  }

  return data || [];
};

const loadExistingLinks = async (supabase) => {
  const { data, error } = await supabase
    .from('raw_material_reference_links')
    .select('raw_material_id, reference_profile_id, is_primary')
    .eq('is_primary', true);

  if (error) {
    throw new Error(error.message || 'Failed to load existing material reference links');
  }

  return data || [];
};

const buildSeedPlan = ({ users, referencePayload, referenceProfiles, existingRawMaterials, existingLinks }) => {
  const referenceProfileByCode = new Map(
    referenceProfiles
      .filter((profile) => profile.reference_code)
      .map((profile) => [profile.reference_code, profile])
  );

  const existingMaterialByUserAndWorkbookCode = new Map(
    existingRawMaterials
      .filter((material) => material.workbook_code)
      .map((material) => [`${material.user_id}:${material.workbook_code}`, material])
  );

  const linkedRawMaterialIds = new Set(existingLinks.map((link) => link.raw_material_id));

  const materials = (referencePayload?.materials || [])
    .map(buildSeedMaterial)
    .filter((material) => material.name && material.workbook_code);

  const missingReferenceProfiles = [];
  const pendingCreates = [];
  const alreadyExisting = [];
  const pendingLinkTargets = [];

  for (const material of materials) {
    const profile = referenceProfileByCode.get(material.workbook_code);

    if (!profile) {
      missingReferenceProfiles.push({
        workbook_code: material.workbook_code,
        name: material.name,
      });
      continue;
    }

    for (const user of users) {
      const key = `${user.id}:${material.workbook_code}`;
      const existingMaterial = existingMaterialByUserAndWorkbookCode.get(key);

      if (existingMaterial) {
        alreadyExisting.push({
          user_id: user.id,
          raw_material_id: existingMaterial.id,
          workbook_code: material.workbook_code,
          name: material.name,
          already_linked: linkedRawMaterialIds.has(existingMaterial.id),
        });

        if (!linkedRawMaterialIds.has(existingMaterial.id)) {
          pendingLinkTargets.push({
            raw_material_id: existingMaterial.id,
            reference_profile_id: profile.id,
            workbook_code: material.workbook_code,
            name: material.name,
            user_id: user.id,
          });
        }
        continue;
      }

      pendingCreates.push({
        user_id: user.id,
        reference_profile_id: profile.id,
        ...material,
      });
    }
  }

  return {
    pendingCreates,
    alreadyExisting,
    pendingLinkTargets,
    missingReferenceProfiles,
    summary: {
      users: users.length,
      workbook_materials: materials.length,
      pending_creates: pendingCreates.length,
      existing_materials: alreadyExisting.length,
      pending_links_for_existing_materials: pendingLinkTargets.length,
      missing_reference_profiles: missingReferenceProfiles.length,
    },
  };
};

const buildOfflinePlan = ({ referencePayload }) => {
  const materials = (referencePayload?.materials || [])
    .map(buildSeedMaterial)
    .filter((material) => material.name && material.workbook_code);

  return {
    pendingCreates: materials,
    alreadyExisting: [],
    pendingLinkTargets: [],
    missingReferenceProfiles: [],
    summary: {
      users: 0,
      workbook_materials: materials.length,
      pending_creates: materials.length,
      existing_materials: 0,
      pending_links_for_existing_materials: 0,
      missing_reference_profiles: 0,
    },
  };
};

const applySeedPlan = async (supabase, plan) => {
  let created = 0;
  let linked = 0;

  for (const row of plan.pendingCreates) {
    const { data, error } = await supabase
      .from('raw_materials')
      .insert({
        user_id: row.user_id,
        name: row.name,
        category: row.category,
        type: row.type,
        scent_family: row.scent_family,
        stock_quantity: row.stock_quantity,
        unit: row.unit,
        cost_per_unit: row.cost_per_unit,
        minimum_stock: row.minimum_stock,
        low_stock_threshold: row.low_stock_threshold,
        supplier_name: row.supplier_name,
        vendor: row.vendor,
        cas_number: row.cas_number,
        ifra_limit: row.ifra_limit,
        pyramid_placement: row.pyramid_placement,
        description: row.description,
        notes: row.notes,
        workbook_code: row.workbook_code,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(error.message || `Failed to insert raw material ${row.name}`);
    }

    created += 1;

    const { error: linkError } = await supabase
      .from('raw_material_reference_links')
      .insert({
        raw_material_id: data.id,
        reference_profile_id: row.reference_profile_id,
        match_method: 'seeded_workbook_library',
        match_confidence: 1,
        is_primary: true,
        notes: 'Seeded into operational inventory from workbook reference library.',
      });

    if (linkError) {
      throw new Error(linkError.message || `Failed to link raw material ${row.name} to reference profile`);
    }

    linked += 1;
  }

  for (const row of plan.pendingLinkTargets) {
    const { error } = await supabase
      .from('raw_material_reference_links')
      .upsert({
        raw_material_id: row.raw_material_id,
        reference_profile_id: row.reference_profile_id,
        match_method: 'seeded_workbook_library',
        match_confidence: 1,
        is_primary: true,
        notes: 'Linked while seeding workbook inventory library.',
      }, { onConflict: 'raw_material_id' });

    if (error) {
      throw new Error(error.message || `Failed to backfill reference link for ${row.name}`);
    }

    linked += 1;
  }

  return { created, linked };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = path.resolve(String(args.get('source-dir') || DEFAULT_SOURCE_DIR));
  const outDir = path.resolve(String(args.get('out-dir') || DEFAULT_OUTPUT_DIR));
  const shouldApply = Boolean(args.get('apply'));
  const canUseSupabasePlan = hasSupabaseAdminEnv();

  const referencePayload = readJsonFile(path.join(sourceDir, MATERIAL_REFERENCE_JSON));

  if (shouldApply && !canUseSupabasePlan) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --apply mode');
  }

  let plan;
  if (canUseSupabasePlan) {
    const supabase = createSupabaseAdminClient();

    const [users, referenceProfiles, existingRawMaterials, existingLinks] = await Promise.all([
      loadAllUsers(supabase),
      loadReferenceProfiles(supabase),
      loadExistingRawMaterials(supabase),
      loadExistingLinks(supabase),
    ]);

    plan = buildSeedPlan({
      users,
      referencePayload,
      referenceProfiles,
      existingRawMaterials,
      existingLinks,
    });
  } else {
    plan = buildOfflinePlan({ referencePayload });
  }

  let applyResult = { created: 0, linked: 0 };
  if (shouldApply) {
    const supabase = createSupabaseAdminClient();
    applyResult = await applySeedPlan(supabase, plan);
  }

  const output = {
    generated_at: new Date().toISOString(),
    source_dir: sourceDir,
    should_apply: shouldApply,
    planning_mode: canUseSupabasePlan ? 'supabase' : 'offline_workbook_catalog',
    ...plan.summary,
    created: applyResult.created,
    linked: applyResult.linked,
  };

  ensureDirectoryExists(outDir);
  writeJsonFile(path.join(outDir, 'material-library-seed-summary.json'), output);
  writeJsonFile(path.join(outDir, 'material-library-seed-create-plan.json'), plan.pendingCreates);
  writeJsonFile(path.join(outDir, 'material-library-seed-existing.json'), plan.alreadyExisting);
  writeJsonFile(path.join(outDir, 'material-library-seed-link-backfill.json'), plan.pendingLinkTargets);
  writeJsonFile(path.join(outDir, 'material-library-seed-missing-reference-profiles.json'), plan.missingReferenceProfiles);

  console.log(JSON.stringify(output, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
