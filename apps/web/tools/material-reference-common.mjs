import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

export const DEFAULT_SOURCE_DIR = 'C:\\webapp\\perfumers-workbook\\exports';

export const normalizeWhitespace = (value) =>
  String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeLookupValue = (value) =>
  normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const parseArgs = (argv) => {
  const flags = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) {
      continue;
    }

    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      flags.set(key, true);
      continue;
    }

    flags.set(key, next);
    index += 1;
  }

  return flags;
};

export const ensureDirectoryExists = (targetDir) => {
  if (!targetDir) {
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });
};

export const readJsonFile = (targetPath) => JSON.parse(fs.readFileSync(targetPath, 'utf8'));

export const writeJsonFile = (targetPath, payload) => {
  ensureDirectoryExists(path.dirname(targetPath));
  fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

export const parseCsv = (rawContent) => {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < rawContent.length; index += 1) {
    const char = rawContent[index];
    const next = rawContent[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  if (!rows.length) {
    return [];
  }

  const [header, ...dataRows] = rows;
  return dataRows
    .filter((dataRow) => dataRow.some((cell) => String(cell || '').trim() !== ''))
    .map((dataRow) => Object.fromEntries(header.map((column, index) => [column, dataRow[index] ?? ''])));
};

export const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

export const toPercentOrNull = (value) => {
  const numericValue = toNumberOrNull(value);
  if (numericValue === null) {
    return null;
  }

  if (numericValue < 0 || numericValue > 100) {
    return null;
  }

  return numericValue;
};

export const toTextOrNull = (value) => {
  const normalizedValue = normalizeWhitespace(value);
  return normalizedValue || null;
};

export const createSupabaseAdminClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase-backed planning or --apply mode');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const hasSupabaseAdminEnv = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export const chunkArray = (items, chunkSize = 500) => {
  const result = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    result.push(items.slice(index, index + chunkSize));
  }
  return result;
};
