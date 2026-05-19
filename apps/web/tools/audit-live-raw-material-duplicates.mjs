#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  ensureDirectoryExists,
  normalizeLookupValue,
  parseArgs,
  writeJsonFile,
} from './material-reference-common.mjs';

const DEFAULT_ENV_PATH = path.resolve('apps/web/.env');
const DEFAULT_OUT_DIR = path.resolve('.codex-temp/raw-material-live-audit');
const INVALID_CAS_VALUES = new Set(['', 'mixture', 'mix', 'na', 'n/a', 'unknown', 'compound', 'odiferousmixture']);

const RELATION_MOVES = [
  { table: 'brief_material_shortlists', column: 'raw_material_id', payloadColumn: 'raw_material_id', conflictColumns: ['brief_id'] },
  { table: 'brief_project_stage_items', column: 'raw_material_id', payloadColumn: 'raw_material_id', conflictColumns: ['project_id', 'stage'] },
  { table: 'raw_material_reference_links', column: 'raw_material_id', payloadColumn: 'raw_material_id', special: 'reference_links' },
  { table: 'material_reference_profiles', column: 'source_raw_material_id', payloadColumn: 'source_raw_material_id', special: 'manual_profiles' },
  { table: 'formula_items', column: 'item_id', payloadColumn: 'item_id', filter: (query) => query.in('item_type', ['raw_material', 'solvent']) },
  { table: 'formula_items', column: 'dilution_solvent_id', payloadColumn: 'dilution_solvent_id' },
  { table: 'accord_items', column: 'raw_material_id', payloadColumn: 'raw_material_id' },
  { table: 'accord_items', column: 'dilution_solvent_id', payloadColumn: 'dilution_solvent_id' },
  { table: 'raw_materials', column: 'dilution_solvent_id', payloadColumn: 'dilution_solvent_id' },
];

const readEnvFile = (targetPath) => {
  if (!fs.existsSync(targetPath)) {
    return {};
  }

  return Object.fromEntries(
    fs.readFileSync(targetPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
      }),
  );
};

const createAdminClientFromEnv = (envPath) => {
  const fileEnv = readEnvFile(envPath);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || fileEnv.SUPABASE_URL || fileEnv.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(`Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY. Checked ${envPath}.`);
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const unique = (items) => [...new Set(items.filter(Boolean))];
const textOrNull = (value) => {
  const nextValue = String(value ?? '').trim();
  return nextValue || null;
};
const normalizedText = (value) => normalizeLookupValue(value);
const collapsedText = (value) => normalizedText(value).replace(/[^a-z0-9]+/g, '');
const semanticName = (value) => collapsedText(
  normalizedText(value)
    .replace(/[\u2010-\u2015\u2212]+/g, '-')
    .replace(/\((z)\)/g, 'cis')
    .replace(/\((e)\)/g, 'trans')
    .replace(/\((rs|rac)\)/g, 'rac')
    .replace(/\b(z)\s*-\s*(\d+)/g, 'cis-$2')
    .replace(/\b(e)\s*-\s*(\d+)/g, 'trans-$2')
    .replace(/\b(cis|trans)\s*[- ]?\s*(\d+)\b/g, '$1-$2')
    .replace(/\b(\d+)\s*[- ]\s*([a-z])/g, '$1-$2'),
);
const normalizeCas = (value) => normalizedText(value).replace(/[^a-z0-9]+/g, '');
const validCas = (value) => {
  const key = normalizeCas(value);
  return key && /\d/.test(key) && !INVALID_CAS_VALUES.has(key) ? key : '';
};

const hasText = (value) => String(value || '').trim().length > 0;
const textConflict = (left, right) => hasText(left) && hasText(right) && normalizedText(left) !== normalizedText(right);
const numberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};
const positiveOrNull = (value) => {
  const numberValue = numberOrNull(value);
  return numberValue && numberValue > 0 ? numberValue : null;
};
const preferText = (left, right) => textOrNull(left) || textOrNull(right);
const preferNumber = (left, right) => numberOrNull(left) ?? numberOrNull(right);
const preferPositive = (left, right) => positiveOrNull(left) ?? positiveOrNull(right);

const scoreMaster = (row) => (
  (row.workbook_code ? 5 : 0)
  + (validCas(row.cas_number) ? 4 : 0)
  + (Number(row.reference_impact) > 0 ? 1 : 0)
  + (Number(row.reference_life_hours) > 0 ? 1 : 0)
  + (Number(row.ifra_limit) > 0 ? 1 : 0)
  + (row.supplier_name ? 1 : 0)
);

const pickMaster = (rows) => [...rows].sort((left, right) => {
  const scoreDelta = scoreMaster(right) - scoreMaster(left);
  if (scoreDelta !== 0) return scoreDelta;
  const updatedDelta = new Date(left.updated_at || left.created_at || 0) - new Date(right.updated_at || right.created_at || 0);
  if (updatedDelta !== 0) return updatedDelta;
  return String(left.name || '').localeCompare(String(right.name || ''));
})[0];

const extractAliasNames = (row) => {
  const source = `${row.name || ''}\n${row.notes || ''}\n${row.description || ''}`;
  const aliases = [];
  aliases.push(...String(row.name || '').split(/\s*\/\s*/).map(textOrNull));
  for (const match of source.matchAll(/synonyms?:\s*([^\n|]+)/gi)) {
    aliases.push(...String(match[1] || '').split(/\s*\/\s*|,\s*/).map(textOrNull));
  }
  for (const match of source.matchAll(/alias(?:es)?:\s*([^\n|]+)/gi)) {
    aliases.push(...String(match[1] || '').split(/\s*\/\s*|,\s*/).map(textOrNull));
  }
  return unique(aliases);
};

const addGroupCandidates = ({ rows, candidates, type, key, basis }) => {
  if (rows.length < 2) return;
  const master = pickMaster(rows);
  for (const duplicate of rows) {
    if (duplicate.id === master.id) continue;
    candidates.set(`${master.id}:${duplicate.id}:${type}`, {
      id: `${type}:${key}:${master.id}:${duplicate.id}`,
      type,
      confidence: basis === 'exact_name' ? 'high' : 'review',
      basis,
      master,
      duplicate,
      reasons: [basis],
    });
  }
};

const buildCandidatesForUser = (rows) => {
  const candidates = new Map();
  const byExactName = new Map();
  const bySemanticName = new Map();
  const byCas = new Map();
  const byAlias = new Map();

  for (const row of rows) {
    const exactName = normalizedText(row.name);
    const semantic = semanticName(row.name);
    const cas = validCas(row.cas_number);
    if (exactName) {
      if (!byExactName.has(exactName)) byExactName.set(exactName, []);
      byExactName.get(exactName).push(row);
    }
    if (semantic) {
      if (!bySemanticName.has(semantic)) bySemanticName.set(semantic, []);
      bySemanticName.get(semantic).push(row);
    }
    if (cas) {
      if (!byCas.has(cas)) byCas.set(cas, []);
      byCas.get(cas).push(row);
    }
    for (const alias of extractAliasNames(row)) {
      const aliasKey = semanticName(alias);
      if (!aliasKey) continue;
      if (!byAlias.has(aliasKey)) byAlias.set(aliasKey, []);
      byAlias.get(aliasKey).push({ row, alias });
    }
  }

  for (const [key, groupRows] of byExactName) {
    addGroupCandidates({ rows: groupRows, candidates, type: 'duplicate_name', key, basis: 'exact_name' });
  }

  for (const [key, groupRows] of bySemanticName) {
    const exactNames = new Set(groupRows.map((row) => normalizedText(row.name)));
    if (exactNames.size > 1) {
      addGroupCandidates({ rows: groupRows, candidates, type: 'semantic_name', key, basis: 'semantic_name' });
    }
  }

  for (const [key, groupRows] of byCas) {
    if (groupRows.length < 2) continue;
    const master = pickMaster(groupRows);
    for (const duplicate of groupRows) {
      if (duplicate.id === master.id) continue;
      const pairKey = `${master.id}:${duplicate.id}:cas`;
      const sameSemantic = semanticName(master.name) === semanticName(duplicate.name);
      candidates.set(pairKey, {
        id: `cas:${key}:${master.id}:${duplicate.id}`,
        type: 'duplicate_cas',
        confidence: sameSemantic ? 'high' : 'review',
        basis: sameSemantic ? 'cas_and_same_semantic_name' : 'cas_only',
        master,
        duplicate,
        reasons: [sameSemantic ? 'same CAS and semantic name' : 'same CAS, review name/vendor/grade'],
      });
    }
  }

  const rowsBySemanticName = new Map(rows.map((row) => [semanticName(row.name), row]));
  for (const [aliasKey, aliasRows] of byAlias) {
    const target = rowsBySemanticName.get(aliasKey);
    if (!target) continue;
    for (const aliasRow of aliasRows) {
      if (aliasRow.row.id === target.id) continue;
      const master = pickMaster([target, aliasRow.row]);
      const duplicate = master.id === target.id ? aliasRow.row : target;
      const pairKey = `${master.id}:${duplicate.id}:vendor_alias`;
      candidates.set(pairKey, {
        id: `alias:${aliasKey}:${master.id}:${duplicate.id}`,
        type: 'vendor_alias',
        confidence: validCas(master.cas_number) && validCas(master.cas_number) === validCas(duplicate.cas_number) ? 'high' : 'review',
        basis: `alias "${aliasRow.alias}"`,
        master,
        duplicate,
        reasons: [`alias "${aliasRow.alias}" resolves to another raw material name`],
      });
    }
  }

  return [...candidates.values()].map(classifyCandidate);
};

const validateMergeable = (master, duplicate) => {
  const blockers = [];
  const warnings = [];

  if (master.user_id !== duplicate.user_id) blockers.push('different_user');
  if (master.type !== duplicate.type) blockers.push('different_type');
  if (Boolean(master.is_diluted) !== Boolean(duplicate.is_diluted)) blockers.push('mixed_dilution_state');
  if (master.dilution_solvent_id === duplicate.id || duplicate.dilution_solvent_id === master.id) blockers.push('mutual_dilution_reference');
  if (master.is_diluted) {
    if (String(master.dilution_solvent_id || '') !== String(duplicate.dilution_solvent_id || '')) blockers.push('different_dilution_solvent');
    if (Number(master.dilution_percentage || 0) !== Number(duplicate.dilution_percentage || 0)) blockers.push('different_dilution_percentage');
  }

  if (textConflict(master.workbook_code, duplicate.workbook_code)) blockers.push('different_workbook_code');

  const masterCas = validCas(master.cas_number);
  const duplicateCas = validCas(duplicate.cas_number);
  if (masterCas && duplicateCas && masterCas !== duplicateCas) blockers.push('different_valid_cas');

  if (textConflict(master.vendor, duplicate.vendor)) warnings.push('different_vendor');
  if (textConflict(master.supplier_name, duplicate.supplier_name)) warnings.push('different_supplier');
  if (Number(master.stock_quantity || 0) > 0 && Number(duplicate.stock_quantity || 0) > 0) warnings.push('both_have_stock');

  return { blockers, warnings };
};

const classifyCandidate = (candidate) => {
  const { blockers, warnings } = validateMergeable(candidate.master, candidate.duplicate);
  const sameExactName = normalizedText(candidate.master.name) === normalizedText(candidate.duplicate.name);
  const sameSemanticName = semanticName(candidate.master.name) === semanticName(candidate.duplicate.name);
  const sameValidCas = validCas(candidate.master.cas_number) && validCas(candidate.master.cas_number) === validCas(candidate.duplicate.cas_number);
  const vendorConflict = warnings.includes('different_vendor');

  const autoSafe = blockers.length === 0
    && !vendorConflict
    && (
      sameExactName
      || (sameSemanticName && (sameValidCas || !validCas(candidate.master.cas_number) || !validCas(candidate.duplicate.cas_number)))
      || (sameValidCas && sameSemanticName)
    );

  return {
    ...candidate,
    confidence: autoSafe ? 'safe' : candidate.confidence,
    autoSafe,
    blockers,
    warnings,
    master: summarizeMaterial(candidate.master),
    duplicate: summarizeMaterial(candidate.duplicate),
  };
};

const summarizeMaterial = (row) => ({
  id: row.id,
  user_id: row.user_id,
  name: row.name,
  type: row.type,
  unit: row.unit,
  vendor: row.vendor,
  supplier_name: row.supplier_name,
  cas_number: row.cas_number,
  workbook_code: row.workbook_code,
  stock_quantity: row.stock_quantity,
  cost_per_unit: row.cost_per_unit,
  is_diluted: row.is_diluted,
  dilution_solvent_id: row.dilution_solvent_id,
  dilution_percentage: row.dilution_percentage,
  updated_at: row.updated_at,
});

const fetchRawMaterials = async (supabase, userId) => {
  let query = supabase
    .from('raw_materials')
    .select('*')
    .order('user_id', { ascending: true })
    .order('name', { ascending: true });
  if (userId) {
    query = query.eq('user_id', userId);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message || 'Failed to fetch raw materials');
  return data || [];
};

const fetchRowsByIds = async (supabase, ids) => {
  const { data, error } = await supabase
    .from('raw_materials')
    .select('*')
    .in('id', ids);
  if (error) throw new Error(error.message || 'Failed to fetch merge rows');
  return new Map((data || []).map((row) => [row.id, row]));
};

const mergeNotes = (master, duplicate, source) => {
  const masterNotes = textOrNull(master.notes);
  const duplicateNotes = textOrNull(duplicate.notes);
  const mergeNote = `Merged duplicate raw material "${duplicate.name}" (${duplicate.id}) into "${master.name}" (${master.id}) via live duplicate audit: ${source}.`;
  return unique([
    masterNotes,
    duplicateNotes && `Merged duplicate note from ${duplicate.name}:\n${duplicateNotes}`,
    mergeNote,
  ]).join('\n\n') || null;
};

const buildMergedPayload = (master, duplicate, source) => ({
  workbook_code: preferText(master.workbook_code, duplicate.workbook_code),
  category: preferText(master.category, duplicate.category),
  unit: preferText(master.unit, duplicate.unit),
  stock_quantity: Number(master.stock_quantity || 0) || Number(duplicate.stock_quantity || 0) || 0,
  minimum_stock: Number(master.minimum_stock || 0) || Number(duplicate.minimum_stock || 0) || 0,
  low_stock_threshold: preferNumber(master.low_stock_threshold, duplicate.low_stock_threshold),
  cost_per_unit: positiveOrNull(master.cost_per_unit) ?? positiveOrNull(duplicate.cost_per_unit) ?? Number(master.cost_per_unit || 0),
  description: preferText(master.description, duplicate.description),
  notes: mergeNotes(master, duplicate, source),
  scent_family: preferText(master.scent_family, duplicate.scent_family),
  supplier_name: preferText(master.supplier_name, duplicate.supplier_name),
  vendor: preferText(master.vendor, duplicate.vendor),
  cas_number: preferText(master.cas_number, duplicate.cas_number),
  ifra_limit: preferNumber(master.ifra_limit, duplicate.ifra_limit),
  reference_abc_primary_family: preferText(master.reference_abc_primary_family, duplicate.reference_abc_primary_family),
  reference_impact: preferPositive(master.reference_impact, duplicate.reference_impact),
  reference_life_hours: preferPositive(master.reference_life_hours, duplicate.reference_life_hours),
  reference_use_level_typical_percent: preferNumber(master.reference_use_level_typical_percent, duplicate.reference_use_level_typical_percent),
  reference_use_level_max_percent: preferNumber(master.reference_use_level_max_percent, duplicate.reference_use_level_max_percent),
});

const selectMaybe = async (query) => {
  const { data, error } = await query;
  if (error) {
    if (String(error.message || '').includes('Could not find the table')) return [];
    throw error;
  }
  return data || [];
};

const updateMaybe = async (query) => {
  const { error } = await query;
  if (error) {
    if (String(error.message || '').includes('Could not find the table')) return;
    throw error;
  }
};

const moveConflictAwareRows = async ({ supabase, relation, masterId, duplicateId }) => {
  if (!relation.conflictColumns?.length) {
    let query = supabase
      .from(relation.table)
      .update({ [relation.payloadColumn]: masterId })
      .eq(relation.column, duplicateId);
    if (relation.filter) query = relation.filter(query);
    await updateMaybe(query);
    return;
  }

  const selectColumns = unique(['id', ...relation.conflictColumns]).join(', ');
  const [duplicateRows, masterRows] = await Promise.all([
    selectMaybe(supabase.from(relation.table).select(selectColumns).eq(relation.column, duplicateId)),
    selectMaybe(supabase.from(relation.table).select(selectColumns).eq(relation.column, masterId)),
  ]);
  const masterKeys = new Set(masterRows.map((row) => relation.conflictColumns.map((column) => String(row[column] || '')).join('::')));
  const conflictIds = duplicateRows
    .filter((row) => masterKeys.has(relation.conflictColumns.map((column) => String(row[column] || '')).join('::')))
    .map((row) => row.id);
  if (conflictIds.length) {
    await updateMaybe(supabase.from(relation.table).delete().in('id', conflictIds));
  }
  const remainingIds = duplicateRows.map((row) => row.id).filter((id) => !conflictIds.includes(id));
  if (remainingIds.length) {
    await updateMaybe(supabase.from(relation.table).update({ [relation.payloadColumn]: masterId }).in('id', remainingIds));
  }
};

const mergeReferenceLinks = async ({ supabase, masterId, duplicateId }) => {
  const links = await selectMaybe(
    supabase
      .from('raw_material_reference_links')
      .select('id, raw_material_id, reference_profile_id, is_primary')
      .in('raw_material_id', [masterId, duplicateId]),
  );
  const masterLinks = links.filter((row) => row.raw_material_id === masterId);
  const duplicateLinks = links.filter((row) => row.raw_material_id === duplicateId);
  const masterReferences = new Set(masterLinks.map((row) => row.reference_profile_id));
  let masterHasPrimary = masterLinks.some((row) => row.is_primary);

  for (const link of duplicateLinks) {
    if (masterReferences.has(link.reference_profile_id) || (link.is_primary && masterHasPrimary)) {
      await updateMaybe(supabase.from('raw_material_reference_links').delete().eq('id', link.id));
      continue;
    }
    const nextPrimary = Boolean(link.is_primary) && !masterHasPrimary;
    await updateMaybe(
      supabase
        .from('raw_material_reference_links')
        .update({ raw_material_id: masterId, is_primary: nextPrimary })
        .eq('id', link.id),
    );
    if (nextPrimary) masterHasPrimary = true;
  }
};

const mergeManualProfiles = async ({ supabase, masterId, duplicateId }) => {
  const profiles = await selectMaybe(
    supabase
      .from('material_reference_profiles')
      .select('id, source_raw_material_id')
      .eq('source_kind', 'manual')
      .in('source_raw_material_id', [masterId, duplicateId]),
  );
  const masterProfile = profiles.find((row) => row.source_raw_material_id === masterId);
  const duplicateProfile = profiles.find((row) => row.source_raw_material_id === duplicateId);
  if (!duplicateProfile) return;
  if (masterProfile) {
    await updateMaybe(supabase.from('material_reference_profiles').delete().eq('id', duplicateProfile.id));
    return;
  }
  await updateMaybe(
    supabase
      .from('material_reference_profiles')
      .update({ source_raw_material_id: masterId })
      .eq('id', duplicateProfile.id),
  );
};

const applySafeMerge = async ({ supabase, action }) => {
  const rowsById = await fetchRowsByIds(supabase, [action.master.id, action.duplicate.id]);
  const master = rowsById.get(action.master.id);
  const duplicate = rowsById.get(action.duplicate.id);
  if (!master || !duplicate) {
    return { status: 'skipped', reason: 'master_or_duplicate_missing', action_id: action.id };
  }

  const liveCandidate = classifyCandidate({ ...action, master, duplicate });
  if (!liveCandidate.autoSafe) {
    return { status: 'skipped', reason: 'no_longer_auto_safe', action_id: action.id, blockers: liveCandidate.blockers, warnings: liveCandidate.warnings };
  }

  for (const relation of RELATION_MOVES) {
    if (relation.special === 'reference_links') {
      await mergeReferenceLinks({ supabase, masterId: master.id, duplicateId: duplicate.id });
    } else if (relation.special === 'manual_profiles') {
      await mergeManualProfiles({ supabase, masterId: master.id, duplicateId: duplicate.id });
    } else {
      await moveConflictAwareRows({ supabase, relation, masterId: master.id, duplicateId: duplicate.id });
    }
  }

  const { error: updateError } = await supabase
    .from('raw_materials')
    .update(buildMergedPayload(master, duplicate, liveCandidate.basis))
    .eq('id', master.id)
    .eq('user_id', master.user_id);
  if (updateError) throw updateError;

  const { error: deleteError } = await supabase
    .from('raw_materials')
    .delete()
    .eq('id', duplicate.id)
    .eq('user_id', duplicate.user_id);
  if (deleteError) throw deleteError;

  return {
    status: 'applied',
    action_id: action.id,
    master_id: master.id,
    master_name: master.name,
    duplicate_id: duplicate.id,
    duplicate_name: duplicate.name,
  };
};

const candidateToMarkdown = (candidate) => (
  `| ${candidate.autoSafe ? 'SAFE' : 'REVIEW'} | ${candidate.type} | ${candidate.master.name} | ${candidate.duplicate.name} | ${candidate.master.cas_number || ''} | ${candidate.duplicate.cas_number || ''} | ${candidate.master.vendor || ''} | ${candidate.duplicate.vendor || ''} | ${[...candidate.blockers, ...candidate.warnings].join(', ')} |`
);

const writeMarkdownReport = ({ outDir, summary, candidates, applyResults }) => {
  const lines = [
    '# Live Raw Materials Duplicate Audit',
    '',
    `Generated: ${summary.generated_at}`,
    `Raw materials scanned: ${summary.raw_material_count}`,
    `Users scanned: ${summary.user_count}`,
    `Candidates: ${summary.candidate_count}`,
    `Auto-safe candidates: ${summary.auto_safe_count}`,
    `Applied merges: ${summary.applied_count}`,
    '',
    '## Candidates',
    '',
    '| Disposition | Type | Master | Duplicate | Master CAS | Duplicate CAS | Master vendor | Duplicate vendor | Blockers / warnings |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...candidates.map(candidateToMarkdown),
    '',
    '## Apply Results',
    '',
    '```json',
    JSON.stringify(applyResults || [], null, 2),
    '```',
    '',
  ];
  fs.writeFileSync(path.join(outDir, 'report.md'), `${lines.join('\n')}\n`, 'utf8');
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(String(args.get('out-dir') || DEFAULT_OUT_DIR));
  const envPath = path.resolve(String(args.get('env-path') || DEFAULT_ENV_PATH));
  const userId = textOrNull(args.get('user-id'));
  const shouldApply = Boolean(args.get('apply'));
  ensureDirectoryExists(outDir);

  const supabase = createAdminClientFromEnv(envPath);
  const rawMaterials = await fetchRawMaterials(supabase, userId);
  const rowsByUser = new Map();
  for (const row of rawMaterials) {
    if (!rowsByUser.has(row.user_id)) rowsByUser.set(row.user_id, []);
    rowsByUser.get(row.user_id).push(row);
  }

  const candidates = [...rowsByUser.values()]
    .flatMap((rows) => buildCandidatesForUser(rows))
    .sort((left, right) => Number(right.autoSafe) - Number(left.autoSafe) || left.type.localeCompare(right.type) || left.master.name.localeCompare(right.master.name));
  const autoSafeCandidates = candidates.filter((candidate) => candidate.autoSafe);

  const applyResults = [];
  if (shouldApply) {
    for (const action of autoSafeCandidates) {
      try {
        applyResults.push(await applySafeMerge({ supabase, action }));
      } catch (error) {
        applyResults.push({
          status: 'failed',
          action_id: action.id,
          master_id: action.master.id,
          duplicate_id: action.duplicate.id,
          error: String(error.message || error),
        });
        break;
      }
    }
  }

  const postApplyRawMaterials = shouldApply ? await fetchRawMaterials(supabase, userId) : rawMaterials;
  const summary = {
    generated_at: new Date().toISOString(),
    applied_at: shouldApply ? new Date().toISOString() : null,
    raw_material_count: rawMaterials.length,
    post_apply_raw_material_count: postApplyRawMaterials.length,
    user_count: rowsByUser.size,
    candidate_count: candidates.length,
    auto_safe_count: autoSafeCandidates.length,
    review_count: candidates.length - autoSafeCandidates.length,
    attempted_count: applyResults.length,
    applied_count: applyResults.filter((item) => item.status === 'applied').length,
    skipped_count: applyResults.filter((item) => item.status === 'skipped').length,
    failed_count: applyResults.filter((item) => item.status === 'failed').length,
  };

  writeJsonFile(path.join(outDir, 'summary.json'), summary);
  writeJsonFile(path.join(outDir, 'candidates.json'), candidates);
  writeJsonFile(path.join(outDir, 'auto-safe-candidates.json'), autoSafeCandidates);
  writeJsonFile(path.join(outDir, 'apply-results.json'), applyResults);
  writeMarkdownReport({ outDir, summary, candidates, applyResults });

  console.log(JSON.stringify({
    ...summary,
    wrote: [
      path.join(outDir, 'summary.json'),
      path.join(outDir, 'candidates.json'),
      path.join(outDir, 'auto-safe-candidates.json'),
      path.join(outDir, 'apply-results.json'),
      path.join(outDir, 'report.md'),
    ],
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
