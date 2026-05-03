import { chromium, devices } from 'playwright';
const browser = await chromium.launch({ headless: true });
const iphone = devices['iPhone 13'];
const page = await browser.newPage({ ...iphone, locale: 'en-US' });
const results = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') results.push({ type: 'console-error', message: msg.text() });
});
page.on('pageerror', (error) => results.push({ type: 'page-error', message: error.message }));
await page.goto('http://127.0.0.1:3005/', { waitUntil: 'networkidle', timeout: 30000 });
results.push({ type: 'url-after-root', value: page.url() });
results.push({ type: 'root-text', value: (await page.locator('body').innerText({ timeout: 10000 })).slice(0, 500) });
await page.locator('#mobile-email').fill('dekito@techteam.id');
await page.locator('#mobile-password').fill('Lunatic2127@');
await Promise.all([
  page.waitForURL('**/mobile/dashboard', { timeout: 30000 }),
  page.getByRole('button', { name: 'Sign in' }).click(),
]);
results.push({ type: 'url-after-login', value: page.url() });
results.push({ type: 'dashboard-text', value: (await page.locator('body').innerText({ timeout: 15000 })).slice(0, 800) });
for (const path of ['/formulas', '/raw-materials', '/validation']) {
  await page.goto(`http://127.0.0.1:3005${path}`, { waitUntil: 'networkidle', timeout: 30000 });
  results.push({ type: `redirect-${path}`, value: page.url() });
  results.push({ type: `content-${path}`, value: (await page.locator('body').innerText({ timeout: 10000 })).slice(0, 300) });
}
const overlayCount = await page.locator('.vite-error-overlay, #webpack-dev-server-client-overlay, [data-nextjs-dialog]').count();
results.push({ type: 'overlay-count', value: overlayCount });
await browser.close();
console.log(JSON.stringify(results, null, 2));
