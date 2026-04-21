#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ensureDirectoryExists, parseArgs, writeJsonFile } from './material-reference-common.mjs';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3002';
const DEFAULT_OUTPUT_DIR = path.resolve('.codex-temp/browser-auth-audit');

const safeFileName = (value) =>
  String(value || 'route')
    .replace(/^\/+/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    || 'home';

const collectRouteState = async ({ page, route, outputDir, consoleMessages, pageErrors, beforeConsole, beforeErrors }) => {
  const contentLength = await page.locator('body').innerText().then((text) => text.trim().length).catch(() => 0);
  const title = await page.title().catch(() => '');
  const finalUrl = page.url();
  const screenshotName = `${safeFileName(route)}.png`;
  const screenshotPath = path.join(outputDir, screenshotName);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  return {
    route,
    finalUrl,
    title,
    contentLength,
    screenshotPath,
    consoleIssues: consoleMessages.slice(beforeConsole),
    pageErrors: pageErrors.slice(beforeErrors),
  };
};

const gotoAndCapture = async ({ page, baseUrl, route, outputDir, consoleMessages, pageErrors }) => {
  const beforeConsole = consoleMessages.length;
  const beforeErrors = pageErrors.length;
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  return collectRouteState({
    page,
    route,
    outputDir,
    consoleMessages,
    pageErrors,
    beforeConsole,
    beforeErrors,
  });
};

const getFirstHref = async (page, selector) => {
  const locator = page.locator(selector);
  const count = await locator.count();
  if (!count) {
    return null;
  }
  return locator.first().getAttribute('href');
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = String(args.get('base-url') || DEFAULT_BASE_URL).replace(/\/$/, '');
  const outputDir = path.resolve(String(args.get('out-dir') || DEFAULT_OUTPUT_DIR));
  const email = String(args.get('email') || '');
  const password = String(args.get('password') || '');
  const extraRoutes = String(args.get('extra-routes') || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!email || !password) {
    throw new Error('Missing --email or --password');
  }

  ensureDirectoryExists(outputDir);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();

  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', (message) => {
    const type = message.type();
    if (type === 'error' || type === 'warning') {
      consoleMessages.push({
        type,
        text: message.text(),
        location: message.location(),
      });
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push({
      message: error.message,
      stack: error.stack,
    });
  });

  const reports = [];

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /login|sign in/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  reports.push(await collectRouteState({
    page,
    route: '/dashboard',
    outputDir,
    consoleMessages,
    pageErrors,
    beforeConsole: 0,
    beforeErrors: 0,
  }));

  for (const route of ['/raw-materials', '/formulas', '/formulas/new', '/production-costing']) {
    reports.push(await gotoAndCapture({
      page,
      baseUrl,
      route,
      outputDir,
      consoleMessages,
      pageErrors,
    }));
  }

  await page.goto(`${baseUrl}/raw-materials`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const rawMaterialHref = await getFirstHref(page, 'a[href^="/raw-material/"]');
  if (rawMaterialHref) {
    reports.push(await gotoAndCapture({
      page,
      baseUrl,
      route: rawMaterialHref,
      outputDir,
      consoleMessages,
      pageErrors,
    }));
  }

  await page.goto(`${baseUrl}/formulas`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const formulaHref = await getFirstHref(page, 'a[href^="/formulas/"]:not([href$="/edit"])');
  if (formulaHref && formulaHref !== '/formulas/new') {
    reports.push(await gotoAndCapture({
      page,
      baseUrl,
      route: formulaHref,
      outputDir,
      consoleMessages,
      pageErrors,
    }));

    reports.push(await gotoAndCapture({
      page,
      baseUrl,
      route: `${formulaHref}/edit`,
      outputDir,
      consoleMessages,
      pageErrors,
    }));
  }

  for (const route of extraRoutes) {
    reports.push(await gotoAndCapture({
      page,
      baseUrl,
      route,
      outputDir,
      consoleMessages,
      pageErrors,
    }));
  }

  await browser.close();

  const summary = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    total_routes_checked: reports.length,
    total_console_issues: consoleMessages.length,
    total_page_errors: pageErrors.length,
    routes: reports,
  };

  writeJsonFile(path.join(outputDir, 'summary.json'), summary);
  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
