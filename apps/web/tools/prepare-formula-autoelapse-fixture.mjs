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

const REQUIRED_MATERIAL_NAMES = [
  ['Iso E Super'],
  ['Galaxolide 100 (Undiliuted)', 'Galaxolide 100 (Undiluted)', 'Galaxolide 100', 'Galaxolide'],
  ['Alpha Ionone'],
  ['Hedione'],
];

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

const findMaterialByNames = async (supabase, candidateNames) => {
  for (const candidateName of candidateNames) {
    const { data, error } = await supabase
      .from('raw_materials')
      .select('id, name, workbook_code')
      .ilike('name', candidateName)
      .limit(1);

    if (error) {
      throw new Error(error.message || `Failed to query raw material ${candidateName}`);
    }

    if (data?.[0]) {
      return data[0];
    }
  }

  return null;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const email = String(args.get('email') || '');
  const password = String(args.get('password') || '');
  const name = String(args.get('name') || 'Codex AutoElapse Fixture');
  const code = String(args.get('code') || `AUTOELAPSE-${Date.now()}`);
  const materialIds = String(args.get('material-ids') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!email || !password) {
    throw new Error('Missing --email or --password');
  }

  const supabase = buildSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    throw new Error(authError.message || 'Failed to sign in');
  }

  const userId = authData.user?.id;
  if (!userId) {
    throw new Error('Authenticated user id is missing');
  }

  const materials = [];

  if (materialIds.length) {
    const { data: selectedMaterials, error: selectedMaterialsError } = await supabase
      .from('raw_materials')
      .select('id, name, workbook_code')
      .in('id', materialIds);

    if (selectedMaterialsError) {
      throw new Error(selectedMaterialsError.message || 'Failed to query selected raw materials');
    }

    for (const materialId of materialIds) {
      const material = (selectedMaterials || []).find((row) => row.id === materialId);
      if (!material) {
        throw new Error(`Could not find raw material with id: ${materialId}`);
      }
      materials.push(material);
    }
  } else {
    for (const candidateNames of REQUIRED_MATERIAL_NAMES) {
      const material = await findMaterialByNames(supabase, candidateNames);
      if (!material) {
        throw new Error(`Could not find any raw material matching: ${candidateNames.join(', ')}`);
      }
      materials.push(material);
    }
  }

  const { data: formula, error: formulaError } = await supabase
    .from('formulas')
    .insert({
      user_id: userId,
      name,
      code,
      category: 'perfume',
      status: 'draft',
      notes: 'Temporary formula fixture for AutoElapse browser verification.',
    })
    .select('id, name, code')
    .single();

  if (formulaError) {
    throw new Error(formulaError.message || 'Failed to create formula fixture');
  }

  const grams = 1;
  const totalGrams = materials.length * grams;
  const items = materials.map((material, index) => ({
    formula_id: formula.id,
    item_type: 'raw_material',
    item_id: material.id,
    grams,
    percentage: (grams / totalGrams) * 100,
    sort_order: index,
  }));

  const { error: itemsError } = await supabase
    .from('formula_items')
    .insert(items);

  if (itemsError) {
    throw new Error(itemsError.message || 'Failed to create formula fixture items');
  }

  console.log(JSON.stringify({
    formula_id: formula.id,
    formula_name: formula.name,
    formula_code: formula.code,
    materials,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
