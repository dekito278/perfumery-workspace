import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEB_DIR = path.join(ROOT_DIR, 'apps', 'web');
const requireFromWeb = createRequire(path.join(WEB_DIR, 'package.json'));
const { chromium } = requireFromWeb('playwright');
const BASE_URL = String(process.env.APP_FLOW_BASE_URL || 'http://127.0.0.1:3002').replace(/\/$/, '');
const OUTPUT_DIR = path.resolve(process.env.APP_FLOW_OUTPUT_DIR || path.join(ROOT_DIR, 'docs', 'app-flow-screenshots'));
const EMAIL = process.env.APP_FLOW_EMAIL || process.env.UIUX_EMAIL || '';
const PASSWORD = process.env.APP_FLOW_PASSWORD || process.env.UIUX_PASSWORD || '';

if (!EMAIL || !PASSWORD) {
  throw new Error('Set APP_FLOW_EMAIL and APP_FLOW_PASSWORD before running this script.');
}

const desktopViewport = { width: 1440, height: 1000 };
const mobileViewport = { width: 390, height: 844, isMobile: true };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const slugify = (value) =>
  String(value || 'screen')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'screen';

const ensureDir = async (dir) => fs.mkdir(dir, { recursive: true });

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const waitForSettled = async (page) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await wait(900);
};

const login = async (page) => {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /login|sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 });
  await waitForSettled(page);
};

const openRoute = async (page, route) => {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 60000 });
  await waitForSettled(page);
};

const capture = async ({ page, entries, title, route, description = '', viewportName = 'desktop' }) => {
  const fileName = `${String(entries.length + 1).padStart(2, '0')}-${slugify(viewportName)}-${slugify(title)}.png`;
  const filePath = path.join(OUTPUT_DIR, 'screenshots', fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  entries.push({
    title,
    route,
    description,
    viewportName,
    fileName,
    filePath,
    finalUrl: page.url(),
  });
};

const maybeCaptureDialog = async ({ page, entries, title, route, description, viewportName }) => {
  const dialog = page.locator('[role="dialog"]').last();
  if (await dialog.isVisible().catch(() => false)) {
    await capture({ page, entries, title, route, description, viewportName });
    await page.keyboard.press('Escape').catch(() => {});
    await wait(500);
    return true;
  }
  return false;
};

const clickFirstVisible = async (page, locators) => {
  for (const locator of locators) {
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);
      if (await item.isVisible().catch(() => false)) {
        await item.click();
        await waitForSettled(page);
        return true;
      }
    }
  }
  return false;
};

const captureDesktopFlow = async ({ page, entries }) => {
  const screens = [
    ['Dashboard', '/dashboard', 'Ringkasan pipeline, CTA utama, dan aktivitas terbaru.'],
    ['Briefs workspace', '/briefs', 'List brief, filter, dan entry point project/brief baru.'],
    ['New brief form', '/briefs/new', 'Form untuk membuat brief sebelum project direction.'],
    ['Raw materials library', '/raw-materials', 'Master library material, filter, coverage, dan shortlist mode.'],
    ['Raw material audit', '/raw-material-audit', 'Audit duplicate/collision/CAS group.'],
    ['Categories', '/categories', 'Referensi klasifikasi material.'],
    ['Formulas list', '/formulas', 'List formula, standalone badge, import, view, duplicate, edit, delete.'],
    ['Standalone formula composer', '/formulas/new', 'Composer formula mandiri tanpa brief.'],
    ['Validation workspace', '/validation', 'Workspace validation notes dan follow-up formula.'],
  ];

  for (const [title, route, description] of screens) {
    await openRoute(page, route);
    await capture({ page, entries, title, route, description });
  }

  await openRoute(page, '/raw-materials');
  const addMaterialButton = page.getByRole('button', { name: /add material|add raw material|new material/i }).first();
  if (await addMaterialButton.isVisible().catch(() => false)) {
    await addMaterialButton.click();
    await wait(700);
    await maybeCaptureDialog({
      page,
      entries,
      title: 'Add material modal',
      route: '/raw-materials',
      description: 'Modal input material baru dari master library.',
      viewportName: 'desktop',
    });
  }

  await openRoute(page, '/formulas');
  const importButton = page.getByRole('button', { name: /import pdf/i }).first();
  if (await importButton.isVisible().catch(() => false)) {
    await importButton.click();
    await wait(700);
    await maybeCaptureDialog({
      page,
      entries,
      title: 'Import formula PDF modal',
      route: '/formulas',
      description: 'Flow import formula dari PDF workbook.',
      viewportName: 'desktop',
    });
  }

  await openRoute(page, '/formulas/new');
  await maybeCaptureDialog({
    page,
    entries,
    title: 'Formula metadata modal',
    route: '/formulas/new',
    description: 'Langkah awal memberi nama, kode, kategori, dan notes formula standalone.',
    viewportName: 'desktop',
  });

  await openRoute(page, '/formulas');
  if (await clickFirstVisible(page, [
    page.getByRole('button', { name: /^view/i }),
    page.getByRole('button', { name: /view details/i }),
    page.locator('table tbody tr').first(),
  ])) {
    if (!page.url().endsWith('/formulas')) {
      await capture({
        page,
        entries,
        title: 'Formula detail',
        route: page.url().replace(BASE_URL, ''),
        description: 'Detail formula, overview, workbook, composition, standalone/brief context, dan validation workflow.',
      });
      const formulaRoute = new URL(page.url()).pathname;
      await openRoute(page, `${formulaRoute}/edit`);
      await capture({
        page,
        entries,
        title: 'Formula edit composer',
        route: `${formulaRoute}/edit`,
        description: 'Composer edit formula dengan material library, PACE panel, dan workbook preview.',
      });
    }
  }

  await openRoute(page, '/briefs');
  if (await clickFirstVisible(page, [
    page.getByRole('button', { name: /^open/i }),
    page.getByRole('button', { name: /open project/i }),
    page.locator('table tbody tr').first(),
  ])) {
    if (!page.url().endsWith('/briefs')) {
      await capture({
        page,
        entries,
        title: 'Brief project detail',
        route: page.url().replace(BASE_URL, ''),
        description: 'Board brief, shortlist, project stage, dan entry ke formula.',
      });
    }
  }

  await openRoute(page, '/raw-materials');
  if (await clickFirstVisible(page, [
    page.locator('a[href^="/raw-material/"]').first(),
    page.locator('table tbody tr').first(),
  ])) {
    if (!page.url().endsWith('/raw-materials')) {
      await capture({
        page,
        entries,
        title: 'Raw material detail',
        route: page.url().replace(BASE_URL, ''),
        description: 'Detail material, guidance, pricing, reference, dan metadata.',
      });
    }
  }
};

const captureMobileFlow = async ({ page, entries }) => {
  const mobileScreens = [
    ['Mobile dashboard', '/dashboard', 'Dashboard dalam viewport mobile.'],
    ['Mobile formulas list', '/formulas', 'Formula card mobile dengan action View, Duplicate, Edit, Delete.'],
    ['Mobile standalone composer', '/formulas/new', 'Composer formula mandiri dalam layout mobile/tab.'],
    ['Mobile raw materials', '/raw-materials', 'Library material mobile card.'],
    ['Mobile briefs', '/briefs', 'Brief workspace mobile card.'],
  ];

  for (const [title, route, description] of mobileScreens) {
    await openRoute(page, route);
    await capture({ page, entries, title, route, description, viewportName: 'mobile' });
  }
};

const buildReportHtml = (entries) => {
  const generatedAt = new Date().toLocaleString('id-ID', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
  const flowSteps = [
    'Login -> Dashboard',
    'Dashboard -> Briefs -> Brief project -> Formula from brief',
    'Dashboard/Formulas -> New formula -> Standalone composer -> Formula detail',
    'Raw Materials -> Guidance/Audit -> Shortlist -> Formula',
    'Formula detail -> Edit/PACE revision -> Validation workspace',
  ];

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Perfumer Studio App Flow Screenshots</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; margin: 0; color: #1f2933; background: #f7f3ea; }
    .cover { min-height: 180mm; display: flex; flex-direction: column; justify-content: center; padding: 20mm; background: linear-gradient(135deg, #fffaf0, #edf5ef); border: 1px solid #ded4bf; border-radius: 18px; }
    h1 { font-size: 34px; margin: 0 0 10px; letter-spacing: 0; }
    h2 { font-size: 20px; margin: 0 0 8px; }
    p { font-size: 12px; line-height: 1.45; color: #5b6470; }
    .meta { margin-top: 14px; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: #7a6a4a; }
    .flow { display: grid; gap: 8px; margin-top: 20px; }
    .flow div { border: 1px solid #dfd5c2; border-radius: 12px; padding: 10px 12px; background: rgba(255,255,255,.72); font-size: 13px; }
    .page { break-before: page; padding: 0; }
    .header { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; margin-bottom: 8px; }
    .badge { display: inline-block; border: 1px solid #d8cfbe; border-radius: 999px; padding: 4px 8px; font-size: 10px; color: #5f523c; background: #fffaf0; }
    .route { font-family: Consolas, monospace; font-size: 10px; color: #687280; margin-top: 4px; word-break: break-all; }
    .shot { width: 100%; max-height: 164mm; object-fit: contain; object-position: top left; border: 1px solid #d9d1c4; border-radius: 10px; background: white; }
    .caption { margin-top: 5px; font-size: 10px; color: #66717e; }
    .toc { break-before: page; padding: 12mm; background: white; border-radius: 18px; border: 1px solid #e2d8c7; }
    .toc ol { columns: 2; column-gap: 24px; font-size: 11px; line-height: 1.6; }
  </style>
</head>
<body>
  <section class="cover">
    <div class="meta">Generated ${escapeHtml(generatedAt)}</div>
    <h1>Perfumer Studio</h1>
    <h2>Screenshot Web App dan Flow Lengkap</h2>
    <p>PDF ini menggabungkan halaman utama, flow formula mandiri, flow brief, material library, audit, validation, modal penting, serta viewport mobile.</p>
    <div class="flow">
      ${flowSteps.map((step) => `<div>${escapeHtml(step)}</div>`).join('')}
    </div>
  </section>
  <section class="toc">
    <h2>Daftar Screenshot</h2>
    <ol>
      ${entries.map((entry) => `<li>${escapeHtml(entry.title)} <span class="route">${escapeHtml(entry.route)}</span></li>`).join('')}
    </ol>
  </section>
  ${entries.map((entry, index) => `
    <section class="page">
      <div class="header">
        <div>
          <div class="badge">${index + 1}. ${escapeHtml(entry.viewportName)}</div>
          <h2>${escapeHtml(entry.title)}</h2>
          <p>${escapeHtml(entry.description)}</p>
          <div class="route">${escapeHtml(entry.route)} -> ${escapeHtml(entry.finalUrl)}</div>
        </div>
      </div>
      <img class="shot" src="${escapeHtml(path.join(OUTPUT_DIR, 'screenshots', entry.fileName).replaceAll('\\', '/'))}" />
      <div class="caption">${escapeHtml(entry.fileName)}</div>
    </section>
  `).join('')}
</body>
</html>`;
};

await ensureDir(path.join(OUTPUT_DIR, 'screenshots'));
const browser = await chromium.launch({ headless: true });
const entries = [];

const desktopContext = await browser.newContext({ viewport: desktopViewport });
const desktopPage = await desktopContext.newPage();
await login(desktopPage);
await captureDesktopFlow({ page: desktopPage, entries });
await desktopContext.close();

const mobileContext = await browser.newContext({ viewport: mobileViewport });
const mobilePage = await mobileContext.newPage();
await login(mobilePage);
await captureMobileFlow({ page: mobilePage, entries });
await mobileContext.close();

const html = buildReportHtml(entries);
const htmlPath = path.join(OUTPUT_DIR, 'app-flow-screenshots.html');
await fs.writeFile(htmlPath, html, 'utf8');

const reportContext = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const reportPage = await reportContext.newPage();
await reportPage.goto(`file://${htmlPath.replaceAll('\\', '/')}`, { waitUntil: 'networkidle' });
const pdfPath = path.join(OUTPUT_DIR, 'app-flow-screenshots.pdf');
await reportPage.pdf({
  path: pdfPath,
  format: 'A4',
  landscape: true,
  printBackground: true,
  preferCSSPageSize: true,
});
await reportContext.close();
await browser.close();

await fs.writeFile(
  path.join(OUTPUT_DIR, 'summary.json'),
  JSON.stringify({ generated_at: new Date().toISOString(), base_url: BASE_URL, pdf_path: pdfPath, entries }, null, 2),
  'utf8',
);

console.log(pdfPath);
