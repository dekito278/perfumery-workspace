#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { normalizeLookupValue, parseArgs, chunkArray } from './material-reference-common.mjs';

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);
const DEFAULT_ENV_PATH = path.resolve(CURRENT_DIR, '../.env');

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

const positive = (value) => Number(value) > 0;
const nonEmpty = (value) => typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined;

const hasManualGuidance = (row) => (
  nonEmpty(row.cas_number)
  || positive(row.ifra_limit)
  || nonEmpty(row.reference_abc_primary_family)
  || positive(row.reference_impact)
  || positive(row.reference_life_hours)
  || positive(row.reference_use_level_typical_percent)
  || positive(row.reference_use_level_max_percent)
);

const hasLinkedGuidance = (profile) => Boolean(
  profile
  && (
    nonEmpty(profile.cas_no)
    || positive(profile.ifra_limit_percent)
    || nonEmpty(profile.abc_primary_family)
    || positive(profile.impact)
    || positive(profile.life_hours)
    || positive(profile.use_level_typical_percent)
    || positive(profile.use_level_max_percent)
  )
);

const buildStatus = ({ row, profile }) => {
  const missing = [];
  const resolvedCas = row.cas_number || profile?.cas_no || null;
  const resolvedIfra = positive(row.ifra_limit) ? row.ifra_limit : profile?.ifra_limit_percent;
  const resolvedFamily = row.reference_abc_primary_family || profile?.abc_primary_family || null;
  const resolvedImpact = positive(row.reference_impact) ? row.reference_impact : profile?.impact;
  const resolvedLife = positive(row.reference_life_hours) ? row.reference_life_hours : profile?.life_hours;

  if (!resolvedImpact) missing.push('impact');
  if (!resolvedLife) missing.push('life');
  if (!resolvedCas) missing.push('cas');

  return {
    manual_guidance: hasManualGuidance(row),
    linked_guidance: hasLinkedGuidance(profile),
    resolved: {
      cas_number: resolvedCas,
      ifra_limit: resolvedIfra ?? null,
      family: resolvedFamily,
      impact: resolvedImpact ?? null,
      life_hours: resolvedLife ?? null,
      typical_use_level: positive(row.reference_use_level_typical_percent)
        ? row.reference_use_level_typical_percent
        : profile?.use_level_typical_percent ?? null,
      max_use_level: positive(row.reference_use_level_max_percent)
        ? row.reference_use_level_max_percent
        : profile?.use_level_max_percent ?? null,
      linked_reference_code: profile?.reference_code || null,
    },
    ui_badge: missing.length === 0 ? 'Guidance ready' : (missing.length < 3 ? 'Guidance partial' : 'Needs guidance'),
    missing,
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const envPath = path.resolve(String(args.get('env-path') || DEFAULT_ENV_PATH));
  const email = String(args.get('email') || '');
  const password = String(args.get('password') || '');
  const names = String(args.get('names') || '').split(',').map((item) => item.trim()).filter(Boolean);

  if (!email || !password) {
    throw new Error('Missing --email or --password');
  }

  const { supabase, userId } = await createUserClient({ envPath, email, password });

  let rawMaterialsQuery = supabase
    .from('raw_materials')
    .select('id, user_id, name, workbook_code, cas_number, ifra_limit, scent_family, reference_abc_primary_family, reference_impact, reference_life_hours, reference_use_level_typical_percent, reference_use_level_max_percent, notes')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  const { data: allRows, error: rowError } = await rawMaterialsQuery;
  if (rowError) {
    throw new Error(rowError.message || 'Failed to load raw materials');
  }

  const normalizedTargets = new Set(names.map((item) => normalizeLookupValue(item)));
  const targetRows = names.length
    ? (allRows || []).filter((row) => normalizedTargets.has(normalizeLookupValue(row.name)))
    : (allRows || []);

  const idChunks = chunkArray(targetRows.map((row) => row.id), 200);
  const linkRows = [];
  for (const chunk of idChunks) {
    if (!chunk.length) continue;
    const { data, error } = await supabase
      .from('raw_material_reference_links')
      .select('raw_material_id, is_primary, reference_profile_id')
      .eq('is_primary', true)
      .in('raw_material_id', chunk);
    if (error) {
      throw new Error(error.message || 'Failed to load raw material reference links');
    }
    linkRows.push(...(data || []));
  }

  const primaryLinkByRawMaterialId = new Map(linkRows.map((row) => [row.raw_material_id, row]));
  const referenceIds = [...new Set(linkRows.map((row) => row.reference_profile_id).filter(Boolean))];
  const profileRows = [];
  for (const chunk of chunkArray(referenceIds, 200)) {
    if (!chunk.length) continue;
    const { data, error } = await supabase
      .from('material_reference_profiles')
      .select('id, reference_code, cas_no, ifra_limit_percent, abc_primary_family, impact, life_hours, use_level_typical_percent, use_level_max_percent')
      .in('id', chunk);
    if (error) {
      throw new Error(error.message || 'Failed to load material reference profiles');
    }
    profileRows.push(...(data || []));
  }

  const profileById = new Map(profileRows.map((row) => [row.id, row]));
  const results = targetRows.map((row) => {
    const link = primaryLinkByRawMaterialId.get(row.id);
    const profile = link ? profileById.get(link.reference_profile_id) : null;
    return {
      id: row.id,
      name: row.name,
      workbook_code: row.workbook_code,
      ...buildStatus({ row, profile }),
    };
  });

  const summary = {
    user_id: userId,
    checked_count: results.length,
    ready_count: results.filter((item) => item.ui_badge === 'Guidance ready').length,
    partial_count: results.filter((item) => item.ui_badge === 'Guidance partial').length,
    needs_guidance_count: results.filter((item) => item.ui_badge === 'Needs guidance').length,
  };

  console.log(JSON.stringify({ summary, results }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
