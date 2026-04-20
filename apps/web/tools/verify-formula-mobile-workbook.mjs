#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { ensureDirectoryExists, parseArgs } from './material-reference-common.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_BASE_URL = 'http://127.0.0.1:3002';
const DEFAULT_OUTPUT_DIR = path.resolve(__dirname, '../../../docs/mobile-visual-check-2026-04-20');

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = String(args.get('base-url') || DEFAULT_BASE_URL).replace(/\/$/, '');
  const outputDir = path.resolve(String(args.get('out-dir') || DEFAULT_OUTPUT_DIR));
  const email = String(args.get('email') || '');
  const password = String(args.get('password') || '');
  const formulaId = String(args.get('formula-id') || '');

  if (!email || !password || !formulaId) {
    throw new Error('Missing --email, --password, or --formula-id');
  }

  ensureDirectoryExists(outputDir);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });

  await page.goto(`${baseUrl}/formulas/${formulaId}/edit`, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Workbook' }).click();
  await page.waitForTimeout(700);

  const chartPaths = await page.locator('[data-testid="odour-display-chart"] svg path').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('d')).filter(Boolean),
  );

  const summary = {
    generated_at: new Date().toISOString(),
    final_url: page.url(),
    chart_path_count: chartPaths.length,
    has_visible_chart: chartPaths.length > 0,
  };

  await page.screenshot({ path: path.join(outputDir, '18-mobile-workbook-chart-check.png'), fullPage: true });
  fs.writeFileSync(path.join(outputDir, 'mobile-workbook-chart-check.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));

  await browser.close();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
