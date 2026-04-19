#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ensureDirectoryExists, parseArgs } from './material-reference-common.mjs';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3002';
const DEFAULT_OUTPUT_DIR = path.resolve('../../docs/browser-smoke-check');
const DEFAULT_ROUTES = ['/login', '/dashboard', '/formulas', '/raw-materials', '/production-costing'];

const safeFileName = (value) =>
  String(value || 'route')
    .replace(/^\/+/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    || 'home';

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = String(args.get('base-url') || DEFAULT_BASE_URL).replace(/\/$/, '');
  const outputDir = path.resolve(String(args.get('out-dir') || DEFAULT_OUTPUT_DIR));
  const routes = String(args.get('routes') || DEFAULT_ROUTES.join(','))
    .split(',')
    .map((route) => route.trim())
    .filter(Boolean);

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

  const routeReports = [];

  for (const route of routes) {
    const errorsBefore = consoleMessages.length;
    const pageErrorsBefore = pageErrors.length;
    const targetUrl = `${baseUrl}${route.startsWith('/') ? route : `/${route}`}`;

    await page.goto(targetUrl, { waitUntil: 'networkidle' });

    const contentLength = await page.locator('body').innerText().then((text) => text.trim().length);
    const title = await page.title();
    const finalUrl = page.url();
    const screenshotName = `${safeFileName(route)}.png`;
    const screenshotPath = path.join(outputDir, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    routeReports.push({
      route,
      targetUrl,
      finalUrl,
      title,
      contentLength,
      screenshotPath,
      consoleIssues: consoleMessages.slice(errorsBefore),
      pageErrors: pageErrors.slice(pageErrorsBefore),
    });
  }

  await browser.close();

  const summary = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    routes: routeReports,
    total_console_issues: consoleMessages.length,
    total_page_errors: pageErrors.length,
  };

  fs.writeFileSync(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
