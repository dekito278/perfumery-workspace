#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from './material-reference-common.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

const readEnv = (filePath) => {
  const text = fs.readFileSync(filePath, 'utf8');
  return text.split(/\r?\n/).reduce((accumulator, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return accumulator;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      return accumulator;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, '$1');
    accumulator[key] = value;
    return accumulator;
  }, {});
};

const buildSupabaseClient = () => {
  const env = readEnv(envPath);
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase credentials in apps/web/.env');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};

const hasManualGuidance = (row) => [
  row?.cas_number,
  row?.ifra_limit,
  row?.reference_abc_primary_family,
  row?.reference_impact,
  row?.reference_life_hours,
  row?.reference_use_level_typical_percent,
  row?.reference_use_level_max_percent,
].some((value) => value !== null && value !== undefined && value !== '');

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const email = String(args.get('email') || '');
  const password = String(args.get('password') || '');

  if (!email || !password) {
    throw new Error('Missing --email or --password');
  }

  const supabase = buildSupabaseClient();
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    throw new Error(authError.message || 'Failed to sign in');
  }

  const { data: materials, error } = await supabase
    .from('raw_materials')
    .select(`
      id,
      name,
      workbook_code,
      cas_number,
      ifra_limit,
      reference_abc_primary_family,
      reference_impact,
      reference_life_hours,
      reference_use_level_typical_percent,
      reference_use_level_max_percent,
      raw_material_reference_links (
        id,
        is_primary,
        material_reference_profiles (
          id,
          reference_code,
          impact,
          life_hours,
          abc_primary_family
        )
      )
    `)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Failed to inspect raw materials');
  }

  const rows = (materials || []).map((row) => {
    const primaryLink = (row.raw_material_reference_links || []).find((link) => link.is_primary);
    return {
      id: row.id,
      name: row.name,
      workbook_code: row.workbook_code,
      has_manual_guidance: hasManualGuidance(row),
      linked_reference_code: primaryLink?.material_reference_profiles?.reference_code || null,
      linked_reference_impact: primaryLink?.material_reference_profiles?.impact || null,
      linked_reference_life_hours: primaryLink?.material_reference_profiles?.life_hours || null,
      linked_reference_family: primaryLink?.material_reference_profiles?.abc_primary_family || null,
      manual_reference_impact: row.reference_impact,
      manual_reference_life_hours: row.reference_life_hours,
      manual_reference_family: row.reference_abc_primary_family,
    };
  });

  const summary = {
    total_materials: rows.length,
    linked_reference_count: rows.filter((row) => row.linked_reference_code).length,
    manual_guidance_count: rows.filter((row) => row.has_manual_guidance).length,
    candidates: rows
      .filter((row) => row.linked_reference_code || row.has_manual_guidance)
      .slice(0, 20),
  };

  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
