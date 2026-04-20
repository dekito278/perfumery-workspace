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

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const email = String(args.get('email') || '');
  const password = String(args.get('password') || '');
  const formulaId = String(args.get('formula-id') || '');

  if (!email || !password || !formulaId) {
    throw new Error('Missing --email, --password, or --formula-id');
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

  const { error: deleteError } = await supabase
    .from('formulas')
    .delete()
    .eq('id', formulaId)
    .eq('user_id', userId);

  if (deleteError) {
    throw new Error(deleteError.message || 'Failed to delete formula');
  }

  console.log(JSON.stringify({ deleted_formula_id: formulaId }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
