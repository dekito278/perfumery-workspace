// `node src/utils/e2eAdminScope.selfcheck.mjs`
//
// production-flow-e2e.mjs seeds a fake admin session, and the app only accepts it if that address is on
// VITE_ADMIN_EMAILS — the authoritative admin gate, baked into the bundle at build time.
//
// So the address lives in apps/web/.env.e2e, loaded only by `npm run dev:e2e` (vite --mode e2e). Moving it
// to .env would be the obvious "fix" for a failing run and would ship a working admin address to
// production. Verified once by building both ways: `npm run build` leaves no trace of it in dist/, while
// `vite build --mode e2e` does bake it in.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const E2E_ADDRESS = 'admin-e2e@solivagant.test';

const e2eEnvPath = join(webRoot, '.env.e2e');
assert.ok(existsSync(e2eEnvPath), '.env.e2e is missing — the admin half of production-flow-e2e cannot run without it');
const e2eEnv = readFileSync(e2eEnvPath, 'utf8');
assert.match(e2eEnv, new RegExp(`VITE_ADMIN_EMAILS=.*${E2E_ADDRESS.replace('.', '\\.')}`),
  '.env.e2e must put the e2e address on VITE_ADMIN_EMAILS; that is the whole reason the file exists');

// The mode-scoped file may only carry this override. Real keys belong in .env, which it is layered on.
const overrides = e2eEnv.split('\n').filter((line) => line.trim() && !line.trim().startsWith('#'));
assert.deepEqual(overrides.map((line) => line.split('=')[0].trim()), ['VITE_ADMIN_EMAILS'],
  `.env.e2e may only override VITE_ADMIN_EMAILS, found: ${overrides.map((l) => l.split('=')[0]).join(', ')}`);

// The dangerous move: the same address in the env every build reads.
const envPath = join(webRoot, '.env');
if (existsSync(envPath)) {
  const env = readFileSync(envPath, 'utf8');
  const adminLine = env.split('\n').find((line) => line.trim().startsWith('VITE_ADMIN_EMAILS='));
  assert.ok(
    !adminLine || !adminLine.includes(E2E_ADDRESS),
    `${E2E_ADDRESS} is on VITE_ADMIN_EMAILS in apps/web/.env. That file feeds every build, so this would `
    + 'ship a real admin address whose session anyone can forge. It belongs in .env.e2e, which only '
    + '`npm run dev:e2e` loads.',
  );
}

assert.match(readFileSync(join(webRoot, 'package.json'), 'utf8'), /"dev:e2e": "vite[^"]*--mode e2e"/,
  'npm run dev:e2e must start vite in e2e mode, or .env.e2e is never loaded');

console.log('e2eAdminScope selfcheck OK (the e2e admin address is scoped to `npm run dev:e2e`)');
