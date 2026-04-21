#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { normalizeLookupValue, parseArgs, writeJsonFile, ensureDirectoryExists } from './material-reference-common.mjs';

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);
const DEFAULT_ENV_PATH = path.resolve(CURRENT_DIR, '../.env');
const DEFAULT_OUT_DIR = path.resolve('.codex-temp/slash-alias-audit');

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

const collapse = (value) => normalizeLookupValue(value).replace(/\s+/g, '');
const tokenize = (value) => normalizeLookupValue(value).split(' ').filter(Boolean);

const splitAliasSegments = (value) => String(value || '')
  .split('/')
  .map((item) => item.trim())
  .filter(Boolean);

const scoreAlias = (aliasRow, masterRow) => {
  let score = 0;
  const aliasName = String(aliasRow.name || '');
  const masterName = String(masterRow.name || '');
  const aliasNorm = normalizeLookupValue(aliasName);
  const masterNorm = normalizeLookupValue(masterName);
  const aliasCollapsed = collapse(aliasName);
  const masterCollapsed = collapse(masterName);
  const aliasSegments = splitAliasSegments(aliasName);
  const aliasSegmentNorms = aliasSegments.map((item) => normalizeLookupValue(item));
  const aliasSegmentCollapsed = aliasSegments.map((item) => collapse(item));
  const aliasTokens = new Set(tokenize(aliasName));
  const masterTokens = new Set(tokenize(masterName));
  const overlap = [...aliasTokens].filter((token) => masterTokens.has(token)).length;
  const aliasCas = normalizeLookupValue(aliasRow.cas_number);
  const masterCas = normalizeLookupValue(masterRow.cas_number);

  if (aliasCas && masterCas && aliasCas === masterCas) score += 20;
  if (aliasSegmentNorms.includes(masterNorm)) score += 18;
  if (aliasSegmentCollapsed.includes(masterCollapsed)) score += 18;
  if (aliasNorm.includes(masterNorm) || masterNorm.includes(aliasNorm)) score += 5;
  if (aliasCollapsed.includes(masterCollapsed) || masterCollapsed.includes(aliasCollapsed)) score += 6;
  if (overlap > 0) score += overlap;
  if ((aliasRow.scent_family || '').toLowerCase() === (masterRow.scent_family || '').toLowerCase()) score += 2;
  if ((aliasRow.category || '').toLowerCase() === (masterRow.category || '').toLowerCase()) score += 1;
  if (masterRow.workbook_code) score += 3;
  if (/imported from eco fragrantica/i.test(aliasRow.notes || '')) score += 1;
  if (/seeded from perfumer's workbook/i.test(masterRow.notes || '')) score += 2;
  if (/10[- ]?(tec|dpg|dep)/i.test(aliasName) && /10[- ]?(tec|dpg|dep)/i.test(masterName)) score += 2;
  if (/10[- ]?(tec|dpg|dep)/i.test(aliasName) && !/10[- ]?(tec|dpg|dep)/i.test(masterName)) score -= 2;

  return score;
};

const classify = (aliasRow, masterRow) => {
  const aliasName = String(aliasRow.name || '');
  const masterName = String(masterRow.name || '');
  const aliasHasDilution = /(?:^|\b)(\d+[- ]?(tec|dpg|dep)|50 dep|100\b|10 tec)\b/i.test(aliasName);
  const masterHasDilution = /(?:^|\b)(\d+[- ]?(tec|dpg|dep)|50 dep|100\b|10 tec)\b/i.test(masterName);
  const sameDilutionShape = aliasHasDilution === masterHasDilution;

  if (aliasHasDilution && !masterHasDilution) {
    return 'variant_keep_separate';
  }

  if (!aliasHasDilution && !masterHasDilution) {
    return 'safe_merge_candidate';
  }

  if (sameDilutionShape) {
    return 'manual_review';
  }

  return 'manual_review';
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
  const { data, error } = await supabase
    .from('raw_materials')
    .select('id, name, workbook_code, vendor, cost_per_unit, cas_number, category, scent_family, notes')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message || 'Failed to load raw materials');

  const rows = data || [];
  const ecoSlashRows = rows.filter((row) =>
    /imported from eco fragrantica/i.test(row.notes || '')
    && /\//.test(row.name || ''),
  );
  const workbookRows = rows.filter((row) =>
    /seeded from perfumer's workbook/i.test(row.notes || '')
    || row.workbook_code,
  );

  const candidates = ecoSlashRows.map((aliasRow) => {
    const ranked = workbookRows
      .map((masterRow) => ({
        master: masterRow,
        score: scoreAlias(aliasRow, masterRow),
      }))
      .filter((item) => item.score >= 18)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);

    const best = ranked[0] || null;
    return {
      alias: aliasRow,
      best_match: best ? {
        ...best,
        classification: classify(aliasRow, best.master),
      } : null,
      alternatives: ranked.slice(1),
    };
  }).filter((item) => item.best_match);

  const summary = {
    generated_at: new Date().toISOString(),
    user_id: userId,
    slash_alias_rows: ecoSlashRows.length,
    matched_candidates: candidates.length,
    safe_merge_candidates: candidates.filter((item) => item.best_match.classification === 'safe_merge_candidate').length,
    variant_keep_separate: candidates.filter((item) => item.best_match.classification === 'variant_keep_separate').length,
    manual_review: candidates.filter((item) => item.best_match.classification === 'manual_review').length,
  };

  writeJsonFile(path.join(outDir, 'summary.json'), summary);
  writeJsonFile(path.join(outDir, 'candidates.json'), candidates);

  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
