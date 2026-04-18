#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

const runNode = (args, options = {}) =>
  spawnSync(process.execPath, args, {
    cwd: webRoot,
    stdio: 'inherit',
    env: process.env,
    ...options,
  });

const llmsResult = runNode([path.join('tools', 'generate-llms.js')]);

if (llmsResult.status !== 0) {
  console.warn('llms.txt generation failed, continuing with Vite build');
}

const viteBinPath = path.join(webRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const viteResult = runNode([viteBinPath, 'build', '--outDir', 'dist']);

process.exit(viteResult.status ?? 1);
