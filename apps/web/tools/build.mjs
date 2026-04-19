#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

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

const vitePackageJsonPath = require.resolve('vite/package.json', {
  paths: [webRoot, path.resolve(webRoot, '..', '..')],
});
const viteBinPath = path.join(path.dirname(vitePackageJsonPath), 'bin', 'vite.js');
const viteResult = runNode([viteBinPath, 'build', '--outDir', 'dist']);

process.exit(viteResult.status ?? 1);
