import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.UIUX_BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT_DIR = process.env.UIUX_OUTPUT_DIR
  || path.resolve(process.cwd(), '../../docs/uiux-audit-assets');
const EMAIL = process.env.UIUX_EMAIL;
const PASSWORD = process.env.UIUX_PASSWORD;

if (!EMAIL || !PASSWORD) {
  throw new Error('UIUX_EMAIL and UIUX_PASSWORD are required');
}

await fs.mkdir(OUTPUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

const screenshot = async (name, locator = page.locator('body')) => {
  await locator.screenshot({
    path: path.join(OUTPUT_DIR, `${name}.png`),
  });
};

const waitForSettled = async () => {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
};

await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
await page.getByLabel(/email/i).fill(EMAIL);
await page.getByLabel(/password/i).fill(PASSWORD);
await page.getByRole('button', { name: /login|sign in/i }).click();
await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
await waitForSettled();
await screenshot('login-success-dashboard');

await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
await waitForSettled();
await screenshot('dashboard-page');

await page.goto(`${BASE_URL}/raw-materials`, { waitUntil: 'networkidle' });
await waitForSettled();
await screenshot('raw-materials-page');

const addRawMaterialButton = page.getByRole('button', { name: /add raw material|create material|new material/i }).first();
if (await addRawMaterialButton.isVisible().catch(() => false)) {
  await addRawMaterialButton.click();
  await page.waitForTimeout(800);
  const modal = page.locator('[role="dialog"]').last();
  if (await modal.isVisible().catch(() => false)) {
    await screenshot('raw-material-add-modal', modal);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
}

const openFirstTableRecord = async () => {
  const rows = page.locator('table tbody tr');
  const rowCount = await rows.count().catch(() => 0);
  if (rowCount > 0) {
    for (let index = 0; index < rowCount; index += 1) {
      const row = rows.nth(index);
      const text = (await row.textContent().catch(() => '') || '').trim();
      if (text) {
        await row.click({ position: { x: 32, y: 20 } }).catch(() => {});
        await page.waitForTimeout(1000);
        if (!page.url().includes('/formulas') || !page.url().endsWith('/formulas')) {
          return true;
        }
      }
    }
  }

  const rowButtons = page.locator('table tbody tr button');
  const count = await rowButtons.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const button = rowButtons.nth(index);
    const text = (await button.textContent().catch(() => '') || '').trim();
    if (text && !/edit|delete|view|open|print|export|import|refresh/i.test(text)) {
      await button.click();
      return true;
    }
  }
  return false;
};

if (await openFirstTableRecord()) {
  await page.waitForTimeout(1200);
  await page.waitForLoadState('networkidle').catch(() => {});
  await screenshot('raw-material-detail-page');

  const referenceButton = page.getByRole('button', { name: /update reference|match reference/i }).first();
  if (await referenceButton.isVisible().catch(() => false)) {
    await referenceButton.click();
    await page.waitForTimeout(800);
    const modal = page.locator('[role="dialog"]').last();
    if (await modal.isVisible().catch(() => false)) {
      await screenshot('raw-material-reference-match-modal', modal);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }
}

await page.goto(`${BASE_URL}/raw-material-audit`, { waitUntil: 'networkidle' });
await waitForSettled();
await screenshot('raw-material-audit-page');

await page.goto(`${BASE_URL}/formulas`, { waitUntil: 'networkidle' });
await waitForSettled();
await screenshot('formulas-page');

const importPdfButton = page.getByRole('button', { name: /import pdf/i }).first();
if (await importPdfButton.isVisible().catch(() => false)) {
  await importPdfButton.click();
  await page.waitForTimeout(800);
  const modal = page.locator('[role="dialog"]').last();
  if (await modal.isVisible().catch(() => false)) {
    await screenshot('formula-import-pdf-modal', modal);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
}

await page.goto(`${BASE_URL}/formulas/new`, { waitUntil: 'networkidle' });
await waitForSettled();
await screenshot('formula-create-page');

await page.goto(`${BASE_URL}/formulas`, { waitUntil: 'networkidle' });
await waitForSettled();
if (await openFirstTableRecord()) {
  await page.waitForTimeout(1200);
  await page.waitForLoadState('networkidle').catch(() => {});
  await screenshot('formula-detail-page');

  const createBatchButton = page.getByRole('button', { name: /create batch/i }).first();
  if (await createBatchButton.isVisible().catch(() => false)) {
    await createBatchButton.click();
    await page.waitForTimeout(800);
    const modal = page.locator('[role="dialog"]').last();
    if (await modal.isVisible().catch(() => false)) {
      await screenshot('formula-create-batch-modal', modal);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }

  const editButton = page.getByRole('button', { name: /^edit$/i }).first();
  if (await editButton.isVisible().catch(() => false)) {
    await editButton.click();
    await page.waitForTimeout(1200);
    await page.waitForLoadState('networkidle').catch(() => {});
    await screenshot('formula-edit-page');
  }
}

await page.goto(`${BASE_URL}/batches`, { waitUntil: 'networkidle' });
await waitForSettled();
await screenshot('batches-page');

if (await openFirstTableRecord()) {
  await page.waitForTimeout(1200);
  await page.waitForLoadState('networkidle').catch(() => {});
  await screenshot('batch-detail-page');
}

await page.goto(`${BASE_URL}/production-costing`, { waitUntil: 'networkidle' });
await waitForSettled();
await screenshot('production-costing-page');

await browser.close();
console.log(`Screenshots saved to ${OUTPUT_DIR}`);
