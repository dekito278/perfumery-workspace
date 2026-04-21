#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import {
  chunkArray,
  ensureDirectoryExists,
  normalizeLookupValue,
  parseArgs,
  writeJsonFile,
} from './material-reference-common.mjs';

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);
const DEFAULT_ENV_PATH = path.resolve(CURRENT_DIR, '../.env');
const DEFAULT_OUT_DIR = path.resolve('.codex-temp/live-material-alias-audit');
const INVALID_CAS = new Set(['', 'mixture', '*mixture', 'mix', 'na', 'n/a', 'unknown']);

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

const createUserClient = async ({ envPath, email, password }) => {
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
  };
};

const collapseName = (value) => normalizeLookupValue(value).replace(/\s+/g, '');

const cleanCas = (value) => {
  const normalized = normalizeLookupValue(value);
  return INVALID_CAS.has(normalized) ? null : normalized;
};

const scoreRow = (row) => {
  let score = 0;
  if (row.workbook_code) score += 6;
  if (cleanCas(row.cas_number)) score += 4;
  if (row.primary_reference_code) score += 5;
  if (row.reference_impact && Number(row.reference_impact) > 0) score += 2;
  if (row.reference_life_hours && Number(row.reference_life_hours) > 0) score += 2;
  if (row.reference_use_level_typical_percent && Number(row.reference_use_level_typical_percent) > 0) score += 1;
  if (row.reference_use_level_max_percent && Number(row.reference_use_level_max_percent) > 0) score += 1;
  if (row.ifra_limit && Number(row.ifra_limit) > 0) score += 1;
  if (row.vendor) score += 1;
  if (row.supplier_name) score += 1;
  if (row.description) score += 1;
  if (row.notes && /seeded from perfumer's workbook/i.test(row.notes)) score += 3;
  if (row.notes && /imported from ecofragrantica/i.test(row.notes)) score -= 1;
  return score;
};

const fetchRawMaterials = async (supabase, userId) => {
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

const fetchPrimaryLinks = async (supabase, rawMaterialIds) => {
  const rows = [];
  for (const chunk of chunkArray(rawMaterialIds, 200)) {
    const { data, error } = await supabase
      .from('raw_material_reference_links')
      .select('raw_material_id, is_primary, material_reference_profiles(reference_code)')
      .eq('is_primary', true)
      .in('raw_material_id', chunk);

    if (error) {
      throw new Error(error.message || 'Failed to fetch primary reference links');
    }
    rows.push(...(data || []));
  }
  return rows;
};

const groupBy = (items, keyFn) => {
  const result = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (!result.has(key)) {
      result.set(key, []);
    }
    result.get(key).push(item);
  }
  return result;
};

const pickMasterAndDuplicate = (rows) => {
  const sorted = [...rows].sort((left, right) => {
    const scoreDiff = scoreRow(right) - scoreRow(left);
    if (scoreDiff !== 0) return scoreDiff;
    return String(left.name).localeCompare(String(right.name));
  });

  return {
    master: sorted[0],
    duplicates: sorted.slice(1),
  };
};

const buildCollapsedNameCandidates = (rows) => {
  const groups = [...groupBy(rows, (row) => collapseName(row.name)).entries()]
    .filter(([, group]) => group.length > 1);

  return groups.map(([collapsedName, group], index) => {
    const { master, duplicates } = pickMasterAndDuplicate(group);
    const duplicate = duplicates[0];
    const sameCas = cleanCas(master.cas_number) && cleanCas(master.cas_number) === cleanCas(duplicate.cas_number);
    const safeByShape = master.name.replace(/[^A-Za-z0-9]/g, '').toLowerCase()
      === duplicate.name.replace(/[^A-Za-z0-9]/g, '').toLowerCase();

    return {
      candidate_id: `collapsed-name-${index + 1}`,
      basis: 'collapsed_name_exact',
      collapsed_name: collapsedName,
      confidence: sameCas || safeByShape ? 'high' : 'medium',
      safe_auto_merge: Boolean(safeByShape),
      master,
      duplicates,
    };
  });
};

const buildCasCandidates = (rows) => {
  const groups = [...groupBy(rows, (row) => cleanCas(row.cas_number)).entries()]
    .filter(([cas, group]) => cas && group.length > 1);

  return groups.map(([casNumber, group], index) => {
    const { master, duplicates } = pickMasterAndDuplicate(group);
    return {
      candidate_id: `cas-${index + 1}`,
      basis: 'cas_exact',
      cas_number: casNumber,
      confidence: 'review',
      safe_auto_merge: false,
      master,
      duplicates,
    };
  });
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const envPath = path.resolve(String(args.get('env-path') || DEFAULT_ENV_PATH));
  const outDir = path.resolve(String(args.get('out-dir') || DEFAULT_OUT_DIR));
  const email = String(args.get('email') || '');
  const password = String(args.get('password') || '');

  if (!email || !password) {
    throw new Error('Missing --email or --password');
  }

  ensureDirectoryExists(outDir);

  const { supabase, userId } = await createUserClient({ envPath, email, password });
  const rawMaterials = await fetchRawMaterials(supabase, userId);
  const primaryLinks = await fetchPrimaryLinks(supabase, rawMaterials.map((row) => row.id));
  const primaryReferenceCodeByRawMaterialId = new Map(
    primaryLinks.map((row) => [row.raw_material_id, row.material_reference_profiles?.reference_code || null]),
  );

  const enrichedRows = rawMaterials.map((row) => ({
    ...row,
    primary_reference_code: primaryReferenceCodeByRawMaterialId.get(row.id) || null,
  }));

  const collapsedNameCandidates = buildCollapsedNameCandidates(enrichedRows);
  const casCandidates = buildCasCandidates(enrichedRows);
  const safeCollapsedNameCandidates = collapsedNameCandidates
    .filter((candidate) => candidate.safe_auto_merge)
    .map((candidate) => ({
      ...candidate,
      duplicate: candidate.duplicates[0],
    }));

  const summary = {
    generated_at: new Date().toISOString(),
    user_id: userId,
    total_raw_materials: enrichedRows.length,
    collapsed_name_candidate_groups: collapsedNameCandidates.length,
    safe_auto_merge_collapsed_groups: safeCollapsedNameCandidates.length,
    exact_cas_duplicate_groups: casCandidates.length,
  };

  writeJsonFile(path.join(outDir, 'summary.json'), summary);
  writeJsonFile(path.join(outDir, 'collapsed-name-candidates.json'), collapsedNameCandidates);
  writeJsonFile(path.join(outDir, 'safe-auto-merge-candidates.json'), safeCollapsedNameCandidates);
  writeJsonFile(path.join(outDir, 'cas-duplicate-candidates.json'), casCandidates);

  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
