#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { parseArgs, readJsonFile, writeJsonFile, ensureDirectoryExists } from './material-reference-common.mjs';

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);
const DEFAULT_ENV_PATH = path.resolve(CURRENT_DIR, '../.env');
const DEFAULT_CANDIDATES_PATH = path.resolve('.codex-temp/slash-alias-audit-v2/candidates.json');
const DEFAULT_OUT_DIR = path.resolve('.codex-temp/slash-alias-apply');

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
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message || 'Failed to sign in');
  if (!data.user?.id) throw new Error('Authenticated user id is missing');
  return { supabase, userId: data.user.id };
};

const cleanText = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
};

const positiveNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const maybeSingle = async (query, label) => {
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message || label);
  return data || null;
};

const buildMasterUpdate = ({ master, duplicate, reason }) => ({
  cas_number: cleanText(master.cas_number) || cleanText(duplicate.cas_number),
  ifra_limit: positiveNumber(master.ifra_limit) || positiveNumber(duplicate.ifra_limit),
  scent_family: cleanText(master.scent_family) || cleanText(duplicate.scent_family),
  reference_abc_primary_family: cleanText(master.reference_abc_primary_family) || cleanText(duplicate.reference_abc_primary_family),
  reference_impact: positiveNumber(master.reference_impact) || positiveNumber(duplicate.reference_impact),
  reference_life_hours: positiveNumber(master.reference_life_hours) || positiveNumber(duplicate.reference_life_hours),
  reference_use_level_typical_percent: positiveNumber(master.reference_use_level_typical_percent) || positiveNumber(duplicate.reference_use_level_typical_percent),
  reference_use_level_max_percent: positiveNumber(master.reference_use_level_max_percent) || positiveNumber(duplicate.reference_use_level_max_percent),
  vendor: cleanText(master.vendor) || cleanText(duplicate.vendor),
  supplier_name: cleanText(master.supplier_name) || cleanText(duplicate.supplier_name),
  description: cleanText(master.description) || cleanText(duplicate.description),
  unit: cleanText(master.unit) || cleanText(duplicate.unit),
  cost_per_unit: positiveNumber(master.cost_per_unit) || positiveNumber(duplicate.cost_per_unit) || master.cost_per_unit || 0,
  stock_quantity: positiveNumber(master.stock_quantity) || positiveNumber(duplicate.stock_quantity) || master.stock_quantity || 0,
  notes: [
    cleanText(master.notes),
    `Merged duplicate raw material "${duplicate.name}" (${duplicate.id}) into "${master.name}" (${master.id}).`,
    cleanText(reason),
  ].filter(Boolean).join('\n'),
});

const applyMerge = async ({ supabase, userId, masterId, duplicateId, reason }) => {
  const [master, duplicate] = await Promise.all([
    maybeSingle(supabase.from('raw_materials').select('*').eq('id', masterId).eq('user_id', userId), `Failed to load master ${masterId}`),
    maybeSingle(supabase.from('raw_materials').select('*').eq('id', duplicateId).eq('user_id', userId), `Failed to load duplicate ${duplicateId}`),
  ]);

  if (!master) throw new Error(`Master raw material not found: ${masterId}`);
  if (!duplicate) throw new Error(`Duplicate raw material not found: ${duplicateId}`);

  const { error: updateMasterError } = await supabase
    .from('raw_materials')
    .update(buildMasterUpdate({ master, duplicate, reason }))
    .eq('id', masterId);
  if (updateMasterError) throw new Error(updateMasterError.message || `Failed to update master ${masterId}`);

  const [masterPrimaryLink, duplicatePrimaryLink, duplicateManualProfile] = await Promise.all([
    maybeSingle(supabase.from('raw_material_reference_links').select('id').eq('raw_material_id', masterId).eq('is_primary', true), `Failed to load master link ${masterId}`),
    maybeSingle(supabase.from('raw_material_reference_links').select('id').eq('raw_material_id', duplicateId).eq('is_primary', true), `Failed to load duplicate link ${duplicateId}`),
    maybeSingle(supabase.from('material_reference_profiles').select('id').eq('source_kind', 'manual').eq('source_raw_material_id', duplicateId), `Failed to load duplicate profile ${duplicateId}`),
  ]);

  if (masterPrimaryLink && duplicatePrimaryLink) {
    const { error } = await supabase.from('raw_material_reference_links').delete().eq('id', duplicatePrimaryLink.id);
    if (error) throw new Error(error.message || `Failed to delete duplicate link ${duplicatePrimaryLink.id}`);
  }

  if (duplicateManualProfile) {
    const existingMasterManual = await maybeSingle(
      supabase.from('material_reference_profiles').select('id').eq('source_kind', 'manual').eq('source_raw_material_id', masterId),
      `Failed to inspect master profile ${masterId}`,
    );
    if (!existingMasterManual) {
      const { error } = await supabase
        .from('material_reference_profiles')
        .update({ source_raw_material_id: masterId })
        .eq('id', duplicateManualProfile.id);
      if (error) throw new Error(error.message || `Failed to transfer manual profile ${duplicateManualProfile.id}`);
    }
  }

  const relationUpdates = [
    ['raw_material_reference_links', { raw_material_id: masterId }, 'raw_material_id', duplicateId],
    ['formula_items', { item_id: masterId }, 'item_id', duplicateId, (query) => query.in('item_type', ['raw_material', 'solvent'])],
    ['batches', { solvent_id: masterId }, 'solvent_id', duplicateId],
    ['batch_usage_records', { raw_material_id: masterId }, 'raw_material_id', duplicateId],
    ['raw_materials', { dilution_solvent_id: masterId }, 'dilution_solvent_id', duplicateId],
  ];

  for (const [table, payload, column, value, extra] of relationUpdates) {
    let query = supabase.from(table).update(payload).eq(column, value);
    if (extra) query = extra(query);
    const { error } = await query;
    if (error) {
      if (String(error.message || '').includes("Could not find the table")) continue;
      throw new Error(error.message || `Failed to update ${table}`);
    }
  }

  const { error: deleteError } = await supabase.from('raw_materials').delete().eq('id', duplicateId);
  if (deleteError) throw new Error(deleteError.message || `Failed to delete duplicate ${duplicateId}`);

  return { applied: true, action: 'merge', master_id: masterId, duplicate_id: duplicateId, master_name: master.name, duplicate_name: duplicate.name };
};

const renameVariant = async ({ supabase, userId, id, nextName, reason }) => {
  const row = await maybeSingle(
    supabase.from('raw_materials').select('id, name, notes').eq('id', id).eq('user_id', userId),
    `Failed to load raw material ${id}`,
  );
  if (!row) throw new Error(`Raw material not found: ${id}`);

  const { error } = await supabase
    .from('raw_materials')
    .update({
      name: nextName,
      notes: [row.notes, reason].filter(Boolean).join('\n'),
    })
    .eq('id', id);
  if (error) throw new Error(error.message || `Failed to rename ${id}`);

  return { applied: true, action: 'rename', id, previous_name: row.name, name: nextName };
};

const buildVariantName = ({ aliasName, masterName }) => {
  const dilutionMatch = aliasName.match(/(\d+[- ]?(?:TEC|DPG|DEP))/i);
  if (dilutionMatch?.[1]) {
    return `${masterName} ${dilutionMatch[1].toUpperCase().replace(/\s+/g, '-')}`;
  }
  return aliasName;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const envPath = path.resolve(String(args.get('env-path') || DEFAULT_ENV_PATH));
  const candidatesPath = path.resolve(String(args.get('candidates-path') || DEFAULT_CANDIDATES_PATH));
  const outDir = path.resolve(String(args.get('out-dir') || DEFAULT_OUT_DIR));
  const email = String(args.get('email') || '');
  const password = String(args.get('password') || '');

  if (!email || !password) {
    throw new Error('Missing --email or --password');
  }

  ensureDirectoryExists(outDir);
  const { supabase, userId } = await createUserClient({ envPath, email, password });
  const candidates = readJsonFile(candidatesPath);
  const results = [];

  for (const candidate of candidates) {
    const classification = candidate?.best_match?.classification;
    try {
      if (classification === 'safe_merge_candidate') {
        const result = await applyMerge({
          supabase,
          userId,
          masterId: candidate.best_match.master.id,
          duplicateId: candidate.alias.id,
          reason: `Slash-alias cleanup: ${candidate.alias.name} -> ${candidate.best_match.master.name}`,
        });
        results.push(result);
        continue;
      }

      if (classification === 'variant_keep_separate') {
        const nextName = buildVariantName({
          aliasName: candidate.alias.name,
          masterName: candidate.best_match.master.name,
        });
        const result = await renameVariant({
          supabase,
          userId,
          id: candidate.alias.id,
          nextName,
          reason: `Renamed during slash-alias cleanup to keep this variant distinct from ${candidate.best_match.master.name}.`,
        });
        results.push(result);
        continue;
      }

      results.push({
        applied: false,
        action: 'skip',
        alias_id: candidate.alias.id,
        alias_name: candidate.alias.name,
        reason: classification || 'unknown_classification',
      });
    } catch (error) {
      results.push({
        applied: false,
        action: 'error',
        alias_id: candidate.alias.id,
        alias_name: candidate.alias.name,
        error: String(error.message || error),
      });
      break;
    }
  }

  const summary = {
    generated_at: new Date().toISOString(),
    applied_merges: results.filter((item) => item.action === 'merge' && item.applied).length,
    applied_renames: results.filter((item) => item.action === 'rename' && item.applied).length,
    errors: results.filter((item) => item.action === 'error').length,
    total_results: results.length,
  };

  writeJsonFile(path.join(outDir, 'summary.json'), summary);
  writeJsonFile(path.join(outDir, 'results.json'), results);
  console.log(JSON.stringify({ summary, results }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
