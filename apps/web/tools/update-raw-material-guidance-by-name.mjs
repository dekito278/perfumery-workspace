#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from './material-reference-common.mjs';

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

const maybeSingle = async (query, label) => {
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(error.message || label);
  }
  return data || null;
};

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const envPath = path.resolve(String(args.get('env-path') || DEFAULT_ENV_PATH));
  const email = String(args.get('email') || '');
  const password = String(args.get('password') || '');
  const name = String(args.get('name') || '');
  const workbookCode = String(args.get('workbook-code') || '');
  const casNumber = String(args.get('cas-number') || '');
  const family = String(args.get('family') || '');
  const impact = toNumber(args.get('impact'));
  const lifeHours = toNumber(args.get('life-hours'));
  const typicalUse = toNumber(args.get('typical-use'));
  const maxUse = toNumber(args.get('max-use'));
  const ifraLimit = toNumber(args.get('ifra-limit'));

  if (!email || !password || !name) {
    throw new Error('Missing --email, --password, or --name');
  }

  const { supabase, userId } = await createUserClient({ envPath, email, password });
  const rawMaterial = await maybeSingle(
    supabase
      .from('raw_materials')
      .select('id, name, workbook_code')
      .eq('user_id', userId)
      .eq('name', name),
    `Failed to load raw material ${name}`,
  );

  if (!rawMaterial) {
    throw new Error(`Raw material not found: ${name}`);
  }

  const updatePayload = {
    workbook_code: workbookCode || rawMaterial.workbook_code || null,
    cas_number: casNumber || null,
    ifra_limit: ifraLimit,
    reference_abc_primary_family: family || null,
    reference_impact: impact,
    reference_life_hours: lifeHours,
    reference_use_level_typical_percent: typicalUse,
    reference_use_level_max_percent: maxUse,
  };

  const { error: rawMaterialUpdateError } = await supabase
    .from('raw_materials')
    .update(updatePayload)
    .eq('id', rawMaterial.id);

  if (rawMaterialUpdateError) {
    throw new Error(rawMaterialUpdateError.message || `Failed to update raw material ${name}`);
  }

  const primaryLink = await maybeSingle(
    supabase
      .from('raw_material_reference_links')
      .select('id, reference_profile_id')
      .eq('raw_material_id', rawMaterial.id)
      .eq('is_primary', true),
    `Failed to load primary reference link for ${name}`,
  );

  if (primaryLink?.reference_profile_id) {
    const { error: profileUpdateError } = await supabase
      .from('material_reference_profiles')
      .update({
        reference_code: workbookCode || rawMaterial.workbook_code || null,
        cas_no: casNumber || null,
        ifra_limit_percent: ifraLimit,
        abc_primary_family: family || null,
        impact,
        life_hours: lifeHours,
        use_level_typical_percent: typicalUse,
        use_level_max_percent: maxUse,
      })
      .eq('id', primaryLink.reference_profile_id);

    if (profileUpdateError) {
      throw new Error(profileUpdateError.message || `Failed to update reference profile for ${name}`);
    }
  }

  console.log(JSON.stringify({
    updated: true,
    id: rawMaterial.id,
    name,
    workbook_code: workbookCode || rawMaterial.workbook_code || null,
    cas_number: casNumber || null,
    family: family || null,
    impact,
    life_hours: lifeHours,
    typical_use: typicalUse,
    max_use: maxUse,
    ifra_limit: ifraLimit,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
