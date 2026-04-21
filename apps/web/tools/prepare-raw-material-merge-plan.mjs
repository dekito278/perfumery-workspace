#!/usr/bin/env node

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  chunkArray,
  createSupabaseAdminClient,
  ensureDirectoryExists,
  hasSupabaseAdminEnv,
  normalizeLookupValue,
  parseArgs,
  readJsonFile,
  writeJsonFile,
} from './material-reference-common.mjs';

const DEFAULT_REVIEW_XLSX = 'C:\\Users\\user\\Downloads\\material_merge_review_ecofragrantica3.xlsx';
const DEFAULT_APPLY_PLAN_JSON = path.resolve('.codex-temp/live-material-apply-plan.json');
const DEFAULT_OUT_DIR = path.resolve('.codex-temp/raw-material-merge-plan');
const DEFAULT_PYTHON = process.env.CODEX_PYTHON
  || process.env.PYTHON
  || 'C:\\Users\\user\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe'
  || 'python';
const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);
const DEFAULT_ENV_PATH = path.resolve(CURRENT_DIR, '../.env');

const collapseLookupValue = (value) => normalizeLookupValue(value).replace(/\s+/g, '');

const toNumber = (value) => {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
};

const toSafeText = (value) => {
  const normalizedValue = String(value ?? '').trim();
  return normalizedValue || null;
};

const unique = (items) => [...new Set(items.filter(Boolean))];

const escapeSqlText = (value) => String(value ?? '').replace(/'/g, "''");

const readEnvFile = (targetPath) => Object.fromEntries(
  fs.readFileSync(targetPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separatorIndex = line.indexOf('=');
      return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
    }),
);

const buildAuthenticatedUserClient = async ({ envPath, email, password }) => {
  const env = readEnvFile(envPath);
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase credentials in apps/web/.env');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(error.message || 'Failed to sign in');
  }

  if (!data.user?.id) {
    throw new Error('Authenticated user id is missing');
  }

  return {
    supabase,
    userId: data.user.id,
    authKind: 'user',
  };
};

const readHighConfidenceRows = ({ reviewXlsxPath, pythonExecutable }) => {
  const pythonProgram = `
import json
from openpyxl import load_workbook

wb = load_workbook(r"""${reviewXlsxPath.replace(/\\/g, '\\\\')}""", data_only=True)
ws = wb["high_confidence_merge"]
rows = list(ws.iter_rows(values_only=True))
header = rows[0]
payload = []
for row in rows[1:]:
    if not row:
        continue
    item = {}
    has_value = False
    for index, key in enumerate(header):
        value = row[index] if index < len(row) else None
        if value is not None and value != "":
            has_value = True
        item[key] = value
    if has_value:
        payload.append(item)
print(json.dumps(payload, ensure_ascii=False))
`;

  const stdout = execFileSync(pythonExecutable, ['-c', pythonProgram], {
    encoding: 'utf8',
  });

  return JSON.parse(stdout);
};

const extractSynonymsFromNotes = (notes) => {
  const normalizedNotes = String(notes || '');
  const synonymMatch = normalizedNotes.match(/synonym:\s*([^\n]+)/i);
  if (!synonymMatch?.[1]) {
    return [];
  }

  return unique(
    synonymMatch[1]
      .replace(/\s+profile:\s*https?:\/\/\S+/gi, '')
      .split(/\s*\/\s*/)
      .map((item) => toSafeText(item))
      .filter(Boolean),
  );
};

const buildReviewCandidates = (rows) => rows
  .filter((row) => String(row.match_confidence || '').toUpperCase() === 'HIGH')
  .map((row, index) => ({
    candidate_id: `review-${index + 1}`,
    source: 'high_confidence_merge',
    confidence: 'high',
    resolution_hint: 'keep_json_master_merge_eco_duplicate',
    master: {
      workbook_code: toSafeText(row.json_reference),
      name: toSafeText(row.json_material_name),
      cas_number: toSafeText(row.json_cas),
    },
    duplicate: {
      name: toSafeText(row.eco_material_name),
      cas_number: toSafeText(row.eco_cas),
      eco_row_no: toNumber(row.eco_row_no),
    },
    note: toSafeText(row.note),
    recommended_action: toSafeText(row.recommended_action),
    match_basis: toSafeText(row.match_basis),
  }));

const buildMissingImportCandidates = (missingImports) => missingImports
  .flatMap((item, index) => {
    const missingName = toSafeText(item.name);
    const synonyms = extractSynonymsFromNotes(item.notes);
    const missingCollapse = collapseLookupValue(missingName);

    return synonyms
      .filter((synonym) => collapseLookupValue(synonym) === missingCollapse)
      .map((synonym, synonymIndex) => ({
        candidate_id: `missing-import-${index + 1}-${synonymIndex + 1}`,
        source: 'missing_import_synonym',
        confidence: 'high',
        resolution_hint: 'keep_existing_master_merge_missing_import_alias',
        master: {
          workbook_code: null,
          name: synonym,
          cas_number: null,
        },
        duplicate: {
          name: missingName,
          cas_number: toSafeText(item.cas_number),
          eco_row_no: null,
        },
        note: `Missing import alias candidate from notes: ${item.notes || ''}`.trim(),
        recommended_action: 'Merge imported alias into existing workbook/master row when live names resolve to different raw materials.',
        match_basis: 'synonym collapse exact',
      }));
  });

const fetchUserRawMaterials = async (supabase, userId) => {
  const { data, error } = await supabase
    .from('raw_materials')
    .select([
      'id',
      'user_id',
      'name',
      'type',
      'category',
      'unit',
      'cost_per_unit',
      'stock_quantity',
      'vendor',
      'supplier_name',
      'description',
      'notes',
      'workbook_code',
      'cas_number',
      'ifra_limit',
      'scent_family',
      'reference_abc_primary_family',
      'reference_impact',
      'reference_life_hours',
      'reference_use_level_typical_percent',
      'reference_use_level_max_percent',
    ].join(', '))
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Failed to fetch raw materials');
  }

  return data || [];
};

const fetchManualProfiles = async (supabase, rawMaterialIds) => {
  if (!rawMaterialIds.length) {
    return [];
  }

  const rows = [];
  for (const chunk of chunkArray(rawMaterialIds, 200)) {
    const { data, error } = await supabase
      .from('material_reference_profiles')
      .select('id, source_raw_material_id, source_kind')
      .eq('source_kind', 'manual')
      .in('source_raw_material_id', chunk);

    if (error) {
      throw new Error(error.message || 'Failed to fetch manual material reference profiles');
    }

    rows.push(...(data || []));
  }

  return rows;
};

const nullIfEmpty = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  return value;
};

const positiveNumberOrNull = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
};

const buildIndexes = (rawMaterials) => {
  const byId = new Map();
  const byWorkbookCode = new Map();
  const byCas = new Map();
  const byName = new Map();
  const byCollapsedName = new Map();

  for (const rawMaterial of rawMaterials) {
    byId.set(rawMaterial.id, rawMaterial);

    const workbookCodeKey = normalizeLookupValue(rawMaterial.workbook_code);
    if (workbookCodeKey) {
      if (!byWorkbookCode.has(workbookCodeKey)) {
        byWorkbookCode.set(workbookCodeKey, []);
      }
      byWorkbookCode.get(workbookCodeKey).push(rawMaterial);
    }

    const casKey = normalizeLookupValue(rawMaterial.cas_number);
    if (casKey) {
      if (!byCas.has(casKey)) {
        byCas.set(casKey, []);
      }
      byCas.get(casKey).push(rawMaterial);
    }

    const nameKey = normalizeLookupValue(rawMaterial.name);
    if (nameKey) {
      if (!byName.has(nameKey)) {
        byName.set(nameKey, []);
      }
      byName.get(nameKey).push(rawMaterial);
    }

    const collapsedNameKey = collapseLookupValue(rawMaterial.name);
    if (collapsedNameKey) {
      if (!byCollapsedName.has(collapsedNameKey)) {
        byCollapsedName.set(collapsedNameKey, []);
      }
      byCollapsedName.get(collapsedNameKey).push(rawMaterial);
    }
  }

  return {
    byId,
    byWorkbookCode,
    byCas,
    byName,
    byCollapsedName,
  };
};

const resolveSide = ({ target, indexes, excludeIds = [] }) => {
  const excludedIdSet = new Set(excludeIds);
  const attempts = [
    {
      kind: 'workbook_code',
      key: normalizeLookupValue(target.workbook_code),
      source: indexes.byWorkbookCode,
    },
    {
      kind: 'cas_number',
      key: normalizeLookupValue(target.cas_number),
      source: indexes.byCas,
    },
    {
      kind: 'name',
      key: normalizeLookupValue(target.name),
      source: indexes.byName,
    },
    {
      kind: 'collapsed_name',
      key: collapseLookupValue(target.name),
      source: indexes.byCollapsedName,
    },
  ];

  for (const attempt of attempts) {
    if (!attempt.key) {
      continue;
    }

    const matches = (attempt.source.get(attempt.key) || []).filter((item) => !excludedIdSet.has(item.id));
    if (matches.length === 1) {
      return {
        status: 'resolved',
        resolution_kind: attempt.kind,
        raw_material: matches[0],
      };
    }

    if (matches.length > 1) {
      return {
        status: 'ambiguous',
        resolution_kind: attempt.kind,
        matches: matches.map((item) => ({
          id: item.id,
          name: item.name,
          workbook_code: item.workbook_code,
          cas_number: item.cas_number,
        })),
      };
    }
  }

  return {
    status: 'missing',
  };
};

const resolveCandidates = ({ candidates, rawMaterials }) => {
  const indexes = buildIndexes(rawMaterials);

  return candidates.map((candidate) => {
    const masterResolution = resolveSide({
      target: candidate.master,
      indexes,
    });

    const duplicateResolution = resolveSide({
      target: candidate.duplicate,
      indexes,
      excludeIds: masterResolution.status === 'resolved' ? [masterResolution.raw_material.id] : [],
    });

    const status = masterResolution.status === 'resolved' && duplicateResolution.status === 'resolved'
      ? 'ready'
      : 'needs_review';

    return {
      ...candidate,
      resolution_status: status,
      master_resolution: masterResolution,
      duplicate_resolution: duplicateResolution,
    };
  });
};

const buildResolvedMergeActions = ({ resolvedCandidates, manualProfilesByRawMaterialId }) => {
  const duplicateTargetIds = new Set();
  const actions = [];
  const skipped = [];

  for (const candidate of resolvedCandidates) {
    if (candidate.resolution_status !== 'ready') {
      skipped.push({
        candidate_id: candidate.candidate_id,
        reason: 'candidate_not_ready',
      });
      continue;
    }

    const master = candidate.master_resolution.raw_material;
    const duplicate = candidate.duplicate_resolution.raw_material;

    if (master.id === duplicate.id) {
      skipped.push({
        candidate_id: candidate.candidate_id,
        reason: 'master_and_duplicate_resolved_to_same_row',
        raw_material_id: master.id,
      });
      continue;
    }

    if (duplicateTargetIds.has(duplicate.id)) {
      skipped.push({
        candidate_id: candidate.candidate_id,
        reason: 'duplicate_row_already_claimed_by_previous_candidate',
        duplicate_id: duplicate.id,
      });
      continue;
    }

    const masterManualProfileId = manualProfilesByRawMaterialId.get(master.id) || null;
    const duplicateManualProfileId = manualProfilesByRawMaterialId.get(duplicate.id) || null;

    if (masterManualProfileId && duplicateManualProfileId) {
      skipped.push({
        candidate_id: candidate.candidate_id,
        reason: 'both_rows_have_manual_profiles',
        master_id: master.id,
        duplicate_id: duplicate.id,
      });
      continue;
    }

    duplicateTargetIds.add(duplicate.id);
    actions.push({
      candidate_id: candidate.candidate_id,
      source: candidate.source,
      resolution_hint: candidate.resolution_hint,
      master,
      duplicate,
      transfer_duplicate_manual_profile: Boolean(!masterManualProfileId && duplicateManualProfileId),
      note: candidate.note,
      recommended_action: candidate.recommended_action,
    });
  }

  return {
    actions,
    skipped,
  };
};

const buildMergeSqlBlock = (action) => {
  const masterId = action.master.id;
  const duplicateId = action.duplicate.id;
  const sourceLabel = escapeSqlText(`${action.source}:${action.candidate_id}`);
  const mergeNote = escapeSqlText(
    `Merged duplicate raw material "${action.duplicate.name}" (${duplicateId}) into "${action.master.name}" (${masterId}) via ${action.source}.`,
  );

  return [
    'begin;',
    `-- ${action.candidate_id}: ${action.duplicate.name} -> ${action.master.name}`,
    `update public.raw_materials as master`,
    'set',
    `    cas_number = coalesce(nullif(master.cas_number, ''), nullif(duplicate.cas_number, '')),`,
    `    ifra_limit = coalesce(nullif(master.ifra_limit, 0), nullif(duplicate.ifra_limit, 0)),`,
    `    scent_family = coalesce(nullif(master.scent_family, ''), nullif(duplicate.scent_family, '')),`,
    `    reference_abc_primary_family = coalesce(nullif(master.reference_abc_primary_family, ''), nullif(duplicate.reference_abc_primary_family, '')),`,
    `    reference_impact = coalesce(nullif(master.reference_impact, 0), nullif(duplicate.reference_impact, 0)),`,
    `    reference_life_hours = coalesce(nullif(master.reference_life_hours, 0), nullif(duplicate.reference_life_hours, 0)),`,
    `    reference_use_level_typical_percent = coalesce(nullif(master.reference_use_level_typical_percent, 0), nullif(duplicate.reference_use_level_typical_percent, 0)),`,
    `    reference_use_level_max_percent = coalesce(nullif(master.reference_use_level_max_percent, 0), nullif(duplicate.reference_use_level_max_percent, 0)),`,
    `    vendor = coalesce(nullif(master.vendor, ''), nullif(duplicate.vendor, '')),`,
    `    supplier_name = coalesce(nullif(master.supplier_name, ''), nullif(duplicate.supplier_name, '')),`,
    `    unit = coalesce(nullif(master.unit, ''), nullif(duplicate.unit, '')),`,
    `    description = coalesce(nullif(master.description, ''), nullif(duplicate.description, '')),`,
    `    cost_per_unit = case`,
    `      when '${escapeSqlText(action.source)}' = 'high_confidence_merge' and coalesce(duplicate.cost_per_unit, 0) > 0 then duplicate.cost_per_unit`,
    `      else coalesce(nullif(master.cost_per_unit, 0), nullif(duplicate.cost_per_unit, 0), master.cost_per_unit)`,
    '    end,',
    `    stock_quantity = case`,
    `      when coalesce(master.stock_quantity, 0) > 0 then master.stock_quantity`,
    `      else coalesce(nullif(duplicate.stock_quantity, 0), master.stock_quantity)`,
    '    end,',
    `    notes = trim(both from concat_ws(E'\\n', nullif(master.notes, ''), '${mergeNote}', 'Merge source: ${sourceLabel}'))`,
    `from public.raw_materials as duplicate`,
    `where master.id = '${masterId}'::uuid`,
    `  and duplicate.id = '${duplicateId}'::uuid;`,
    '',
    `update public.material_reference_profiles`,
    `set source_raw_material_id = '${masterId}'::uuid`,
    `where source_kind = 'manual'`,
    `  and source_raw_material_id = '${duplicateId}'::uuid`,
    `  and not exists (`,
    `    select 1`,
    `    from public.material_reference_profiles as existing_manual`,
    `    where existing_manual.source_kind = 'manual'`,
    `      and existing_manual.source_raw_material_id = '${masterId}'::uuid`,
    '  );',
    '',
    `delete from public.raw_material_reference_links as duplicate_primary`,
    `where duplicate_primary.raw_material_id = '${duplicateId}'::uuid`,
    `  and duplicate_primary.is_primary = true`,
    `  and exists (`,
    `    select 1`,
    `    from public.raw_material_reference_links as master_primary`,
    `    where master_primary.raw_material_id = '${masterId}'::uuid`,
    `      and master_primary.is_primary = true`,
    '  );',
    '',
    `update public.raw_material_reference_links`,
    `set raw_material_id = '${masterId}'::uuid`,
    `where raw_material_id = '${duplicateId}'::uuid;`,
    '',
    `update public.accord_items`,
    `set raw_material_id = '${masterId}'::uuid`,
    `where raw_material_id = '${duplicateId}'::uuid;`,
    '',
    `update public.formula_items`,
    `set item_id = '${masterId}'::uuid`,
    `where item_id = '${duplicateId}'::uuid`,
    `  and item_type in ('raw_material', 'solvent');`,
    '',
    `update public.batches`,
    `set solvent_id = '${masterId}'::uuid`,
    `where solvent_id = '${duplicateId}'::uuid;`,
    '',
    `update public.batch_usage_records`,
    `set raw_material_id = '${masterId}'::uuid`,
    `where raw_material_id = '${duplicateId}'::uuid;`,
    '',
    `update public.raw_materials`,
    `set dilution_solvent_id = '${masterId}'::uuid`,
    `where dilution_solvent_id = '${duplicateId}'::uuid;`,
    '',
    `delete from public.raw_materials`,
    `where id = '${duplicateId}'::uuid;`,
    'commit;',
    '',
  ].join('\n');
};

const buildMergeSql = ({ userId, actions, skipped }) => {
  const lines = [
    '-- Raw material duplicate merge plan',
    `-- user_id: ${userId || 'unknown'}`,
    `-- generated_at: ${new Date().toISOString()}`,
    `-- ready_actions: ${actions.length}`,
    `-- skipped_actions: ${skipped.length}`,
    '',
  ];

  for (const action of actions) {
    lines.push(buildMergeSqlBlock(action));
  }

  return `${lines.join('\n')}\n`;
};

const mergeMasterPayload = ({ master, duplicate, source }) => {
  const nextPayload = {};

  nextPayload.cas_number = nullIfEmpty(master.cas_number) || nullIfEmpty(duplicate.cas_number);
  nextPayload.ifra_limit = positiveNumberOrNull(master.ifra_limit) || positiveNumberOrNull(duplicate.ifra_limit);
  nextPayload.scent_family = nullIfEmpty(master.scent_family) || nullIfEmpty(duplicate.scent_family);
  nextPayload.reference_abc_primary_family = nullIfEmpty(master.reference_abc_primary_family)
    || nullIfEmpty(duplicate.reference_abc_primary_family);
  nextPayload.reference_impact = positiveNumberOrNull(master.reference_impact)
    || positiveNumberOrNull(duplicate.reference_impact);
  nextPayload.reference_life_hours = positiveNumberOrNull(master.reference_life_hours)
    || positiveNumberOrNull(duplicate.reference_life_hours);
  nextPayload.reference_use_level_typical_percent = positiveNumberOrNull(master.reference_use_level_typical_percent)
    || positiveNumberOrNull(duplicate.reference_use_level_typical_percent);
  nextPayload.reference_use_level_max_percent = positiveNumberOrNull(master.reference_use_level_max_percent)
    || positiveNumberOrNull(duplicate.reference_use_level_max_percent);
  nextPayload.vendor = nullIfEmpty(master.vendor) || nullIfEmpty(duplicate.vendor);
  nextPayload.supplier_name = nullIfEmpty(master.supplier_name) || nullIfEmpty(duplicate.supplier_name);
  nextPayload.unit = nullIfEmpty(master.unit) || nullIfEmpty(duplicate.unit);
  nextPayload.description = nullIfEmpty(master.description) || nullIfEmpty(duplicate.description);
  nextPayload.cost_per_unit = source === 'high_confidence_merge'
    ? (positiveNumberOrNull(duplicate.cost_per_unit) || positiveNumberOrNull(master.cost_per_unit) || master.cost_per_unit || 0)
    : (positiveNumberOrNull(master.cost_per_unit) || positiveNumberOrNull(duplicate.cost_per_unit) || master.cost_per_unit || 0);
  nextPayload.stock_quantity = positiveNumberOrNull(master.stock_quantity)
    || positiveNumberOrNull(duplicate.stock_quantity)
    || master.stock_quantity
    || 0;

  const mergeNote = `Merged duplicate raw material "${duplicate.name}" (${duplicate.id}) into "${master.name}" (${master.id}) via ${source}.`;
  nextPayload.notes = unique([
    nullIfEmpty(master.notes),
    mergeNote,
  ]).join('\n');

  return nextPayload;
};

const maybeSingleByEq = async (query, missingMessage) => {
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(error.message || missingMessage);
  }
  return data || null;
};

const applyMergeAction = async ({ supabase, action }) => {
  const masterId = action.master.id;
  const duplicateId = action.duplicate.id;

  const [{ data: liveMaster, error: liveMasterError }, { data: liveDuplicate, error: liveDuplicateError }] = await Promise.all([
    supabase
      .from('raw_materials')
      .select('*')
      .eq('id', masterId)
      .maybeSingle(),
    supabase
      .from('raw_materials')
      .select('*')
      .eq('id', duplicateId)
      .maybeSingle(),
  ]);

  if (liveMasterError) {
    throw new Error(liveMasterError.message || `Failed to load master raw material ${masterId}`);
  }
  if (liveDuplicateError) {
    throw new Error(liveDuplicateError.message || `Failed to load duplicate raw material ${duplicateId}`);
  }
  if (!liveMaster) {
    throw new Error(`Master raw material is missing: ${masterId}`);
  }
  if (!liveDuplicate) {
    return {
      status: 'skipped',
      reason: 'duplicate_missing',
      candidate_id: action.candidate_id,
      master_id: masterId,
      duplicate_id: duplicateId,
    };
  }

  const updatePayload = mergeMasterPayload({
    master: liveMaster,
    duplicate: liveDuplicate,
    source: action.source,
  });

  const { error: updateMasterError } = await supabase
    .from('raw_materials')
    .update(updatePayload)
    .eq('id', masterId);

  if (updateMasterError) {
    throw new Error(updateMasterError.message || `Failed to update master raw material ${masterId}`);
  }

  const [masterPrimaryLink, duplicatePrimaryLink, duplicateManualProfile] = await Promise.all([
    maybeSingleByEq(
      supabase
        .from('raw_material_reference_links')
        .select('id, reference_profile_id')
        .eq('raw_material_id', masterId)
        .eq('is_primary', true),
      `Failed to load primary reference link for master ${masterId}`,
    ),
    maybeSingleByEq(
      supabase
        .from('raw_material_reference_links')
        .select('id, reference_profile_id')
        .eq('raw_material_id', duplicateId)
        .eq('is_primary', true),
      `Failed to load primary reference link for duplicate ${duplicateId}`,
    ),
    maybeSingleByEq(
      supabase
        .from('material_reference_profiles')
        .select('id')
        .eq('source_kind', 'manual')
        .eq('source_raw_material_id', duplicateId),
      `Failed to load manual profile for duplicate ${duplicateId}`,
    ),
  ]);

  if (masterPrimaryLink && duplicatePrimaryLink) {
    const { error: deleteDuplicatePrimaryLinkError } = await supabase
      .from('raw_material_reference_links')
      .delete()
      .eq('id', duplicatePrimaryLink.id);

    if (deleteDuplicatePrimaryLinkError) {
      throw new Error(deleteDuplicatePrimaryLinkError.message || `Failed to delete duplicate primary reference link ${duplicatePrimaryLink.id}`);
    }
  }

  if (action.transfer_duplicate_manual_profile && duplicateManualProfile) {
    const { error: moveManualProfileError } = await supabase
      .from('material_reference_profiles')
      .update({ source_raw_material_id: masterId })
      .eq('id', duplicateManualProfile.id);

    if (moveManualProfileError) {
      throw new Error(moveManualProfileError.message || `Failed to transfer manual profile ${duplicateManualProfile.id}`);
    }
  }

  const relationUpdates = [
    {
      table: 'raw_material_reference_links',
      payload: { raw_material_id: masterId },
      column: 'raw_material_id',
      value: duplicateId,
    },
    {
      table: 'accord_items',
      payload: { raw_material_id: masterId },
      column: 'raw_material_id',
      value: duplicateId,
    },
    {
      table: 'formula_items',
      payload: { item_id: masterId },
      column: 'item_id',
      value: duplicateId,
      extraFilters: (query) => query.in('item_type', ['raw_material', 'solvent']),
    },
    {
      table: 'batches',
      payload: { solvent_id: masterId },
      column: 'solvent_id',
      value: duplicateId,
    },
    {
      table: 'batch_usage_records',
      payload: { raw_material_id: masterId },
      column: 'raw_material_id',
      value: duplicateId,
    },
    {
      table: 'raw_materials',
      payload: { dilution_solvent_id: masterId },
      column: 'dilution_solvent_id',
      value: duplicateId,
    },
  ];

  for (const relationUpdate of relationUpdates) {
    let query = supabase
      .from(relationUpdate.table)
      .update(relationUpdate.payload)
      .eq(relationUpdate.column, relationUpdate.value);

    if (relationUpdate.extraFilters) {
      query = relationUpdate.extraFilters(query);
    }

    const { error } = await query;
    if (error) {
      if (String(error.message || '').includes("Could not find the table")) {
        continue;
      }
      throw new Error(error.message || `Failed to update ${relationUpdate.table} for duplicate ${duplicateId}`);
    }
  }

  const { error: deleteDuplicateError } = await supabase
    .from('raw_materials')
    .delete()
    .eq('id', duplicateId);

  if (deleteDuplicateError) {
    throw new Error(deleteDuplicateError.message || `Failed to delete duplicate raw material ${duplicateId}`);
  }

  return {
    status: 'applied',
    candidate_id: action.candidate_id,
    master_id: masterId,
    duplicate_id: duplicateId,
    master_name: liveMaster.name,
    duplicate_name: liveDuplicate.name,
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const reviewXlsxPath = path.resolve(String(args.get('review-xlsx') || DEFAULT_REVIEW_XLSX));
  const applyPlanPath = path.resolve(String(args.get('apply-plan-json') || DEFAULT_APPLY_PLAN_JSON));
  const outDir = path.resolve(String(args.get('out-dir') || DEFAULT_OUT_DIR));
  const pythonExecutable = String(args.get('python') || DEFAULT_PYTHON);
  const envPath = path.resolve(String(args.get('env-path') || DEFAULT_ENV_PATH));
  const explicitUserId = toSafeText(args.get('user-id'));
  const email = toSafeText(args.get('email'));
  const password = toSafeText(args.get('password'));
  const shouldApply = Boolean(args.get('apply'));

  ensureDirectoryExists(outDir);

  const highConfidenceRows = readHighConfidenceRows({
    reviewXlsxPath,
    pythonExecutable,
  });
  const applyPlan = readJsonFile(applyPlanPath);
  const missingImports = Array.isArray(applyPlan?.missing_imports) ? applyPlan.missing_imports : [];
  const userId = explicitUserId || toSafeText(applyPlan?.user_id);

  const reviewCandidates = buildReviewCandidates(highConfidenceRows);
  const missingImportCandidates = buildMissingImportCandidates(missingImports);
  const offlineCandidates = [...reviewCandidates, ...missingImportCandidates];

  const offlineSummary = {
    generated_at: new Date().toISOString(),
    review_xlsx_path: reviewXlsxPath,
    apply_plan_path: applyPlanPath,
    user_id: userId,
    review_high_confidence_rows: reviewCandidates.length,
    missing_import_synonym_candidates: missingImportCandidates.length,
    offline_candidate_count: offlineCandidates.length,
  };

  writeJsonFile(path.join(outDir, 'offline-candidates.json'), offlineCandidates);
  writeJsonFile(path.join(outDir, 'offline-summary.json'), offlineSummary);

  const result = {
    ...offlineSummary,
    resolved_candidate_count: 0,
    ready_merge_count: 0,
    skipped_ready_merge_count: 0,
    wrote: [
      path.join(outDir, 'offline-candidates.json'),
      path.join(outDir, 'offline-summary.json'),
    ],
  };

  if (userId) {
    try {
      let clientState;
      if (hasSupabaseAdminEnv()) {
        clientState = {
          supabase: createSupabaseAdminClient(),
          userId,
          authKind: 'service_role',
        };
      } else if (email && password) {
        clientState = await buildAuthenticatedUserClient({
          envPath,
          email,
          password,
        });
      } else {
        throw new Error('Missing Supabase admin env and no authenticated user credentials were provided');
      }

      const supabase = clientState.supabase;
      const effectiveUserId = clientState.authKind === 'user' ? clientState.userId : userId;
      const rawMaterials = await fetchUserRawMaterials(supabase, effectiveUserId);
      const resolvedCandidates = resolveCandidates({
        candidates: offlineCandidates,
        rawMaterials,
      });

      const manualProfiles = await fetchManualProfiles(supabase, rawMaterials.map((item) => item.id));
      const manualProfilesByRawMaterialId = new Map(
        manualProfiles.map((profile) => [profile.source_raw_material_id, profile.id]),
      );

      const { actions, skipped } = buildResolvedMergeActions({
        resolvedCandidates,
        manualProfilesByRawMaterialId,
      });

      const resolvedSummary = {
        generated_at: new Date().toISOString(),
        user_id: userId,
        live_raw_material_count: rawMaterials.length,
        resolved_candidate_count: resolvedCandidates.length,
        ready_merge_count: actions.length,
        skipped_ready_merge_count: skipped.length,
      };

      writeJsonFile(path.join(outDir, 'resolved-candidates.json'), resolvedCandidates);
      writeJsonFile(path.join(outDir, 'resolved-summary.json'), resolvedSummary);
      writeJsonFile(path.join(outDir, 'ready-merge-actions.json'), actions);
      writeJsonFile(path.join(outDir, 'skipped-merge-actions.json'), skipped);

      const sqlText = buildMergeSql({
        userId,
        actions,
        skipped,
      });
      ensureDirectoryExists(outDir);
      writeJsonFile(path.join(outDir, 'sql-metadata.json'), {
        generated_at: new Date().toISOString(),
        user_id: userId,
        sql_target_path: path.join(outDir, 'ready-merge-actions.sql'),
        ready_merge_count: actions.length,
      });
      await import('node:fs/promises').then((fs) =>
        fs.writeFile(path.join(outDir, 'ready-merge-actions.sql'), sqlText, 'utf8'));

      result.resolved_candidate_count = resolvedCandidates.length;
      result.ready_merge_count = actions.length;
      result.skipped_ready_merge_count = skipped.length;
      result.wrote.push(
        path.join(outDir, 'resolved-candidates.json'),
        path.join(outDir, 'resolved-summary.json'),
        path.join(outDir, 'ready-merge-actions.json'),
        path.join(outDir, 'skipped-merge-actions.json'),
        path.join(outDir, 'sql-metadata.json'),
        path.join(outDir, 'ready-merge-actions.sql'),
      );

      if (shouldApply) {
        if (clientState.authKind !== 'user') {
          throw new Error('Apply mode currently requires an authenticated user client');
        }

        if (effectiveUserId !== userId) {
          throw new Error(`Authenticated user id mismatch. Expected ${userId}, got ${effectiveUserId}`);
        }

        const applyResults = [];
        for (const action of actions) {
          try {
            const applyResult = await applyMergeAction({
              supabase,
              action,
            });
            applyResults.push(applyResult);
          } catch (error) {
            applyResults.push({
              status: 'failed',
              candidate_id: action.candidate_id,
              master_id: action.master.id,
              duplicate_id: action.duplicate.id,
              error: String(error.message || error),
            });
            break;
          }
        }

        const applySummary = {
          generated_at: new Date().toISOString(),
          user_id: effectiveUserId,
          attempted: applyResults.length,
          applied: applyResults.filter((item) => item.status === 'applied').length,
          skipped: applyResults.filter((item) => item.status === 'skipped').length,
          failed: applyResults.filter((item) => item.status === 'failed').length,
        };

        writeJsonFile(path.join(outDir, 'apply-results.json'), applyResults);
        writeJsonFile(path.join(outDir, 'apply-summary.json'), applySummary);
        result.wrote.push(
          path.join(outDir, 'apply-results.json'),
          path.join(outDir, 'apply-summary.json'),
        );
      }
    } catch (error) {
      result.live_resolution_skipped = true;
      result.live_resolution_error = String(error.message || error);
    }
  }

  console.log(JSON.stringify(result, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
