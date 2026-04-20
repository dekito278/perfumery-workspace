#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_SOURCE_DIR,
  ensureDirectoryExists,
  parseArgs,
  readJsonFile,
} from './material-reference-common.mjs';

const MATERIAL_REFERENCE_JSON = 'material-reference-no-dilute.json';
const DEFAULT_MIGRATION_NAME = '20260420103000_seed_no_dilute_workbook_raw_materials.sql';

const sqlLiteral = (value) => {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL';
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
};

const toCodeRows = (payload) =>
  [...new Set((payload?.materials || [])
    .map((material) => String(material.reference || '').trim())
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .map((referenceCode) => ({ reference_code: referenceCode }));

const buildProfilesToSeedCte = () => [
  'profiles_to_seed AS (',
  '  SELECT',
  '    profile.id AS reference_profile_id,',
  '    profile.reference_code,',
  '    profile.name,',
  '    profile.supplier,',
  '    profile.abc_primary_letter,',
  '    profile.abc_primary_family,',
  '    profile.brief_description,',
  '    profile.odour_description,',
  '    profile.cas_no,',
  '    profile.ifra_limit_percent,',
  '    profile.life_hours',
  '  FROM public.material_reference_profiles AS profile',
  '  JOIN desired_reference_codes AS desired',
  '    ON desired.reference_code = profile.reference_code',
  ')',
];

const buildSeededMaterialTargetsCte = () => [
  'seeded_material_targets AS (',
  '  SELECT',
  '    users.id AS user_id,',
  '    profiles.reference_profile_id,',
  '    profiles.reference_code AS workbook_code,',
  '    profiles.name,',
  '    CASE upper(coalesce(profiles.abc_primary_letter, \'\'))',
  '      WHEN \'A\' THEN \'A - ALI-FAT-IC\'',
  '      WHEN \'B\' THEN \'B - Berg-ICEBERG\'',
  '      WHEN \'C\' THEN \'C - CITRUS\'',
  '      WHEN \'D\' THEN \'D - DAIRY\'',
  '      WHEN \'E\' THEN \'E - EDIBLE\'',
  '      WHEN \'F\' THEN \'F - FRUIT\'',
  '      WHEN \'G\' THEN \'G - GREEN\'',
  '      WHEN \'H\' THEN \'H - HERB (Cool)\'',
  '      WHEN \'I\' THEN \'I - IRIS\'',
  '      WHEN \'J\' THEN \'J - JASMIN\'',
  '      WHEN \'K\' THEN \'K - KONIFER\'',
  '      WHEN \'L\' THEN \'L - LIGHT Chemical Floral\'',
  '      WHEN \'M\' THEN \'M - MUGUET\'',
  '      WHEN \'N\' THEN \'N - NARCOTIC\'',
  '      WHEN \'O\' THEN \'O - ORCHID\'',
  '      WHEN \'P\' THEN \'P - PHENOL\'',
  '      WHEN \'Q\' THEN \'Q - Queen of the ORIENT\'',
  '      WHEN \'R\' THEN \'R - ROSE\'',
  '      WHEN \'S\' THEN \'S - SPICE (Hot)\'',
  '      WHEN \'T\' THEN \'T - TAR SMOKE\'',
  '      WHEN \'U\' THEN \'U - Urine Faecal ANIMAL\'',
  '      WHEN \'V\' THEN \'V - VANILLA\'',
  '      WHEN \'W\' THEN \'W - WOOD\'',
  '      WHEN \'X\' THEN \'X - X-rated MUSK\'',
  '      WHEN \'Y\' THEN \'Y - EARTHY MOSSY\'',
  '      WHEN \'Z\' THEN \'Z - ZOLVENTS\'',
  '      ELSE \'L - LIGHT Chemical Floral\'',
  '    END AS category,',
  '    CASE upper(coalesce(profiles.abc_primary_letter, \'\'))',
  '      WHEN \'Z\' THEN \'solvent\'',
  '      ELSE \'material\'',
  '    END AS type,',
  '    CASE upper(coalesce(profiles.abc_primary_letter, \'\'))',
  '      WHEN \'A\' THEN \'Fatty\'',
  '      WHEN \'B\' THEN \'Fresh\'',
  '      WHEN \'C\' THEN \'Citrus\'',
  '      WHEN \'D\' THEN \'Dairy\'',
  '      WHEN \'E\' THEN \'Edible\'',
  '      WHEN \'F\' THEN \'Fruity\'',
  '      WHEN \'G\' THEN \'Green\'',
  '      WHEN \'H\' THEN \'Herbal\'',
  '      WHEN \'I\' THEN \'Powdery\'',
  '      WHEN \'J\' THEN \'Floral\'',
  '      WHEN \'K\' THEN \'Coniferous\'',
  '      WHEN \'L\' THEN \'Floral\'',
  '      WHEN \'M\' THEN \'Floral\'',
  '      WHEN \'N\' THEN \'Floral\'',
  '      WHEN \'O\' THEN \'Floral\'',
  '      WHEN \'P\' THEN \'Phenolic\'',
  '      WHEN \'Q\' THEN \'Resinous\'',
  '      WHEN \'R\' THEN \'Rose\'',
  '      WHEN \'S\' THEN \'Spicy\'',
  '      WHEN \'T\' THEN \'Smoky\'',
  '      WHEN \'U\' THEN \'Animalic\'',
  '      WHEN \'V\' THEN \'Gourmand\'',
  '      WHEN \'W\' THEN \'Woody\'',
  '      WHEN \'X\' THEN \'Musky\'',
  '      WHEN \'Y\' THEN \'Earthy\'',
  '      WHEN \'Z\' THEN \'Solvent\'',
  '      ELSE \'Floral\'',
  '    END AS scent_family,',
  '    1000::numeric(12, 2) AS stock_quantity,',
  '    \'ml\'::text AS unit,',
  '    0::numeric(12, 2) AS cost_per_unit,',
  '    1::numeric(12, 2) AS minimum_stock,',
  '    1::numeric(12, 2) AS low_stock_threshold,',
  '    profiles.supplier AS supplier_name,',
  '    profiles.supplier AS vendor,',
  '    profiles.cas_no AS cas_number,',
  '    CASE',
  '      WHEN profiles.ifra_limit_percent IS NULL THEN NULL',
  '      WHEN profiles.ifra_limit_percent < 0 THEN NULL',
  '      WHEN profiles.ifra_limit_percent > 100 THEN NULL',
  '      ELSE profiles.ifra_limit_percent',
  '    END AS ifra_limit,',
  '    CASE',
  '      WHEN profiles.life_hours IS NULL THEN NULL',
  '      WHEN profiles.life_hours < 12 THEN \'top\'',
  '      WHEN profiles.life_hours < 120 THEN \'middle\'',
  '      ELSE \'base\'',
  '    END AS pyramid_placement,',
  '    coalesce(nullif(trim(profiles.brief_description), \'\'), nullif(trim(profiles.odour_description), \'\')) AS description,',
  '    concat_ws(',
  "      ' ',",
  "      'Seeded from Perfumer''s Workbook reference library.',",
  "      concat('Reference code: ', profiles.reference_code),",
  "      CASE WHEN profiles.supplier IS NOT NULL THEN concat('Workbook supplier: ', profiles.supplier) END",
  '    ) AS notes',
  '  FROM auth.users AS users',
  '  CROSS JOIN profiles_to_seed AS profiles',
  ')',
];

const buildLegacySeededRowsCte = () => [
  'legacy_seeded_rows AS (',
  '  SELECT raw_material.id',
  '  FROM public.raw_materials AS raw_material',
  '  WHERE raw_material.workbook_code IS NOT NULL',
  "    AND raw_material.notes LIKE 'Seeded from Perfumer''s Workbook reference library.%'",
  '    AND NOT EXISTS (',
  '      SELECT 1',
  '      FROM desired_reference_codes AS desired',
  '      WHERE desired.reference_code = raw_material.workbook_code',
  '    )',
  ')',
];

const pushWithClauses = (lines, ...clauses) => {
  lines.push('WITH');
  clauses.forEach((clause, index) => {
    const suffix = index === clauses.length - 1 ? '' : ',';
    const nextLines = [...clause];
    nextLines[nextLines.length - 1] = `${nextLines[nextLines.length - 1]}${suffix}`;
    lines.push(...nextLines);
  });
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = path.resolve(String(args.get('source-dir') || DEFAULT_SOURCE_DIR));
  const migrationName = String(args.get('name') || DEFAULT_MIGRATION_NAME);
  const outputPath = path.resolve(
    String(args.get('out') || path.join('../../supabase', 'migrations', migrationName)),
  );

  const payload = readJsonFile(path.join(sourceDir, MATERIAL_REFERENCE_JSON));
  const codes = toCodeRows(payload);

  const lines = [];
  lines.push('-- Generated by apps/web/tools/generate-operational-material-library-sql.mjs');
  lines.push(`-- Source: ${path.join(sourceDir, MATERIAL_REFERENCE_JSON)}`);
  lines.push('BEGIN;');
  lines.push('');
  lines.push('CREATE TEMP TABLE desired_reference_codes (');
  lines.push('  reference_code text PRIMARY KEY');
  lines.push(') ON COMMIT DROP;');
  lines.push('');
  lines.push('INSERT INTO desired_reference_codes (reference_code)');
  lines.push('VALUES');
  lines.push(codes.map((row) => `  (${sqlLiteral(row.reference_code)})`).join(',\n'));
  lines.push(';');
  lines.push('');

  pushWithClauses(lines, buildProfilesToSeedCte(), buildSeededMaterialTargetsCte(), buildLegacySeededRowsCte());
  lines.push('DELETE FROM public.raw_material_reference_links AS link');
  lines.push('WHERE EXISTS (');
  lines.push('  SELECT 1');
  lines.push('  FROM legacy_seeded_rows AS legacy');
  lines.push('  WHERE legacy.id = link.raw_material_id');
  lines.push(');');
  lines.push('');

  pushWithClauses(lines, buildLegacySeededRowsCte());
  lines.push('DELETE FROM public.raw_materials AS raw_material');
  lines.push('WHERE EXISTS (');
  lines.push('  SELECT 1');
  lines.push('  FROM legacy_seeded_rows AS legacy');
  lines.push('  WHERE legacy.id = raw_material.id');
  lines.push(');');
  lines.push('');

  pushWithClauses(lines, buildProfilesToSeedCte(), buildSeededMaterialTargetsCte());
  lines.push('INSERT INTO public.raw_materials (');
  lines.push('  user_id, name, category, type, scent_family, stock_quantity, unit, cost_per_unit,');
  lines.push('  minimum_stock, low_stock_threshold, supplier_name, vendor, cas_number, ifra_limit,');
  lines.push('  pyramid_placement, description, notes, workbook_code');
  lines.push(')');
  lines.push('SELECT');
  lines.push('  seed.user_id, seed.name, seed.category, seed.type, seed.scent_family, seed.stock_quantity,');
  lines.push('  seed.unit, seed.cost_per_unit, seed.minimum_stock, seed.low_stock_threshold, seed.supplier_name,');
  lines.push('  seed.vendor, seed.cas_number, seed.ifra_limit, seed.pyramid_placement, seed.description, seed.notes,');
  lines.push('  seed.workbook_code');
  lines.push('FROM seeded_material_targets AS seed');
  lines.push('WHERE NOT EXISTS (');
  lines.push('  SELECT 1');
  lines.push('  FROM public.raw_materials AS existing_raw_material');
  lines.push('  WHERE existing_raw_material.user_id = seed.user_id');
  lines.push('    AND (');
  lines.push('      existing_raw_material.workbook_code = seed.workbook_code');
  lines.push('      OR lower(trim(existing_raw_material.name)) = lower(trim(seed.name))');
  lines.push('    )');
  lines.push(');');
  lines.push('');

  pushWithClauses(lines, buildProfilesToSeedCte());
  lines.push('INSERT INTO public.raw_material_reference_links (');
  lines.push('  raw_material_id, reference_profile_id, match_method, match_confidence, is_primary, notes');
  lines.push(')');
  lines.push('SELECT');
  lines.push('  raw_material.id,');
  lines.push('  profile.reference_profile_id,');
  lines.push('  \'seeded_workbook_library\',');
  lines.push('  1,');
  lines.push('  true,');
  lines.push('  \'Linked while seeding workbook inventory library.\'');
  lines.push('FROM public.raw_materials AS raw_material');
  lines.push('JOIN profiles_to_seed AS profile');
  lines.push('  ON profile.reference_code = raw_material.workbook_code');
  lines.push('WHERE NOT EXISTS (');
  lines.push('  SELECT 1');
  lines.push('  FROM public.raw_material_reference_links AS existing_link');
  lines.push('  WHERE existing_link.raw_material_id = raw_material.id');
  lines.push('    AND existing_link.is_primary = true');
  lines.push(');');
  lines.push('');
  lines.push('COMMIT;');
  lines.push('');

  ensureDirectoryExists(path.dirname(outputPath));
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');

  console.log(JSON.stringify({
    output_path: outputPath,
    source_path: path.join(sourceDir, MATERIAL_REFERENCE_JSON),
    reference_codes: codes.length,
  }, null, 2));
};

main();
