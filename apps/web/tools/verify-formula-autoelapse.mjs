#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { ensureDirectoryExists, parseArgs } from './material-reference-common.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_BASE_URL = 'http://127.0.0.1:3002';
const DEFAULT_OUTPUT_DIR = path.resolve(__dirname, '../../../docs/browser-e2e-formula-autoelapse');

const getAutoElapseChipText = async (page) => page
  .locator('[data-testid="autoelapse-chip"]')
  .first()
  .textContent()
  .catch(() => null);

const getAutoElapseHour = async (page) => page
  .locator('[data-testid="autoelapse-chip"]')
  .first()
  .getAttribute('data-elapsed-hour')
  .catch(() => null);

const getMetricCardValue = async (page, testId) => {
  const card = page.locator(`[data-testid="${testId}"]`);
  if (!await card.count()) {
    return null;
  }

  const lines = (await card.innerText().catch(() => ''))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines[1] || lines[0] || null;
};

const getElapsedLoadSummary = async (page) => {
  const card = page.locator('[data-testid="elapsed-load-card"]').first();
  if (!await card.count()) {
    return {
      card_text: null,
      value: null,
      hint: null,
    };
  }

  const cardText = await card.innerText().catch(() => null);
  const value = await page.locator('[data-testid="elapsed-load-value"]').first().innerText().catch(() => null);
  const hint = await page.locator('[data-testid="elapsed-load-hint"]').first().innerText().catch(() => null);
  return {
    card_text: cardText,
    value,
    hint,
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = String(args.get('base-url') || DEFAULT_BASE_URL).replace(/\/$/, '');
  const outputDir = path.resolve(String(args.get('out-dir') || DEFAULT_OUTPUT_DIR));
  const email = String(args.get('email') || '');
  const password = String(args.get('password') || '');
  const formulaId = String(args.get('formula-id') || '');

  if (!email || !password) {
    throw new Error('Missing --email or --password');
  }

  ensureDirectoryExists(outputDir);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
  });
  const page = await context.newPage();
  const consoleIssues = [];
  const pageErrors = [];

  page.on('console', (message) => {
    const type = message.type();
    if (type === 'error' || type === 'warning') {
      consoleIssues.push({ type, text: message.text() });
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push({ message: error.message });
  });

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });

  if (formulaId) {
    await page.goto(`${baseUrl}/formulas/${formulaId}/edit`, { waitUntil: 'networkidle' });
  } else {
    await page.goto(`${baseUrl}/formulas`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(outputDir, 'formulas-list.png'), fullPage: true });

    const viewButton = page.locator('button[aria-label^="View "]').first();
    if (await viewButton.count()) {
      await viewButton.click();
    } else {
      const fallbackFormulaButton = page.locator('button.w-full.text-left').first();
      if (!await fallbackFormulaButton.count()) {
        throw new Error('No formula entry found on /formulas');
      }
      await fallbackFormulaButton.click();
    }
  }
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('text=Graphic odour display', { timeout: 20000 });
  await page.locator('text=Graphic odour display').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outputDir, 'formula-composer-loaded.png'), fullPage: true });

  const slider = page.locator('input[type="range"]').first();
  const beforeAutoElapse = await getAutoElapseChipText(page);
  const beforeAutoElapseHour = await getAutoElapseHour(page);
  const beforeElapsedLoad = await getElapsedLoadSummary(page);
  const beforeSlicePaths = await page.locator('[data-testid="odour-display-chart"] svg path').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('d')).filter(Boolean)
  );
  const sliderMax = Number(await slider.getAttribute('max') || 0);
  const targetHour = Math.min(Math.max(Math.round(sliderMax * 0.5), 1), sliderMax);

  await page.screenshot({ path: path.join(outputDir, 'formula-detail-before.png'), fullPage: true });

  await slider.evaluate((element, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    descriptor?.set?.call(element, String(value));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, targetHour);

  await page.waitForTimeout(600);

  const afterAutoElapse = await getAutoElapseChipText(page);
  const afterAutoElapseHour = await getAutoElapseHour(page);
  const afterElapsedLoad = await getElapsedLoadSummary(page);
  const afterSlicePaths = await page.locator('[data-testid="odour-display-chart"] svg path').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('d')).filter(Boolean)
  );

  await page.screenshot({ path: path.join(outputDir, 'formula-detail-after.png'), fullPage: true });

  const summary = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    final_url: page.url(),
    slider_max: sliderMax,
    target_hour: targetHour,
    before_autoelapse_chip: beforeAutoElapse,
    after_autoelapse_chip: afterAutoElapse,
    before_autoelapse_hour: beforeAutoElapseHour,
    after_autoelapse_hour: afterAutoElapseHour,
    before_elapsed_load: beforeElapsedLoad.card_text,
    after_elapsed_load: afterElapsedLoad.card_text,
    before_elapsed_load_value: beforeElapsedLoad.value,
    after_elapsed_load_value: afterElapsedLoad.value,
    before_elapsed_load_hint: beforeElapsedLoad.hint,
    after_elapsed_load_hint: afterElapsedLoad.hint,
    life_value: await getMetricCardValue(page, 'life-card'),
    impact_value: await getMetricCardValue(page, 'impact-card'),
    chart_paths_changed: JSON.stringify(beforeSlicePaths) !== JSON.stringify(afterSlicePaths),
    console_issues: consoleIssues,
    page_errors: pageErrors,
  };

  fs.writeFileSync(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));

  await browser.close();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
