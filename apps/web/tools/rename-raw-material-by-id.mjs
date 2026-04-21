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

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const envPath = path.resolve(String(args.get('env-path') || DEFAULT_ENV_PATH));
  const email = String(args.get('email') || '');
  const password = String(args.get('password') || '');
  const id = String(args.get('id') || '');
  const name = String(args.get('name') || '');
  const notesAppend = String(args.get('notes-append') || '');

  if (!email || !password || !id || !name) {
    throw new Error('Missing --email, --password, --id, or --name');
  }

  const { supabase, userId } = await createUserClient({ envPath, email, password });
  const { data: row, error: loadError } = await supabase
    .from('raw_materials')
    .select('id, user_id, name, notes')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (loadError) {
    throw new Error(loadError.message || `Failed to load raw material ${id}`);
  }

  if (!row) {
    throw new Error(`Raw material not found: ${id}`);
  }

  const nextNotes = [row.notes, notesAppend].filter(Boolean).join('\n');
  const { error: updateError } = await supabase
    .from('raw_materials')
    .update({
      name,
      notes: nextNotes || null,
    })
    .eq('id', id);

  if (updateError) {
    throw new Error(updateError.message || `Failed to rename raw material ${id}`);
  }

  console.log(JSON.stringify({
    updated: true,
    id,
    previous_name: row.name,
    name,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
