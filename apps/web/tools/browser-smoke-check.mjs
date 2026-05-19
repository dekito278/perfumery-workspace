#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { ensureDirectoryExists, parseArgs, writeJsonFile } from './material-reference-common.mjs';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3002';
const DEFAULT_OUTPUT_DIR = path.resolve('../../docs/browser-smoke-check');
const DEFAULT_ENV_PATH = path.resolve('apps/web/.env');
const DESKTOP_VIEWPORT = { width: 1440, height: 960 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const protectedDesktopRoutes = [
  { id: 'dashboard', route: '/dashboard', titlePattern: /dashboard|studio|solivagant/i },
  { id: 'materials', route: '/raw-materials', titlePattern: /raw materials|materials|solivagant/i },
  { id: 'formulas', route: '/formulas', titlePattern: /formulas|formula|solivagant/i },
  { id: 'journal', route: '/journal', titlePattern: /journal|solivagant/i },
];

const smokeSteps = [
  { id: 'login', label: 'Login page', route: '/login', viewport: DESKTOP_VIEWPORT, auth: 'public', titlePattern: /login|solivagant/i },
  ...protectedDesktopRoutes.map((step) => ({ ...step, viewport: DESKTOP_VIEWPORT, auth: 'protected' })),
  { id: 'mobile-dashboard', label: 'Mobile dashboard', route: '/mobile/dashboard', viewport: MOBILE_VIEWPORT, auth: 'public', titlePattern: /katalog|beranda|solivagant/i },
  { id: 'mobile-journal', label: 'Mobile journal', route: '/mobile/journal', viewport: MOBILE_VIEWPORT, auth: 'protected-mobile', titlePattern: /journal|mobile login|solivagant/i },
];

const readEnvFile = (targetPath) => {
  if (!fs.existsSync(targetPath)) {
    return {};
  }

  return Object.fromEntries(
    fs.readFileSync(targetPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
      }),
  );
};

const safeFileName = (value) =>
  String(value || 'route')
    .replace(/^\/+/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    || 'home';

const buildUrl = (baseUrl, route) => `${baseUrl}${route.startsWith('/') ? route : `/${route}`}`;

const envFirst = (env, keys) => {
  for (const key of keys) {
    const value = process.env[key] || env[key];
    if (String(value || '').trim()) {
      return String(value).trim();
    }
  }
  return '';
};

const discoverPublicArticleRoute = async (env, explicitRoute = '') => {
  if (explicitRoute) {
    return {
      route: explicitRoute.startsWith('/') ? explicitRoute : `/articles/${encodeURIComponent(explicitRoute)}`,
      discovery: 'explicit_route',
    };
  }

  const supabaseUrl = envFirst(env, ['VITE_SUPABASE_URL', 'SUPABASE_URL']);
  const anonKey = envFirst(env, ['VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY']);
  if (!supabaseUrl || !anonKey) {
    return {
      route: '/articles/smoke-public-article',
      discovery: 'fallback_missing_supabase_env',
    };
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase
    .from('journal_posts')
    .select('slug')
    .eq('status', 'published')
    .not('slug', 'is', null)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.slug) {
    return {
      route: '/articles/smoke-public-article',
      discovery: error ? `fallback_query_error:${error.message}` : 'fallback_no_published_article',
    };
  }

  return {
    route: `/articles/${encodeURIComponent(data.slug)}`,
    discovery: 'published_article_slug',
  };
};

const installPageListeners = (page, consoleMessages, pageErrors) => {
  page.on('console', (message) => {
    if (message.type() !== 'error') {
      return;
    }

    consoleMessages.push({
      type: message.type(),
      text: message.text(),
      location: message.location(),
    });
  });

  page.on('pageerror', (error) => {
    pageErrors.push({
      message: error.message,
      stack: error.stack,
    });
  });
};

const getPageState = async (page) => page.evaluate(() => {
  const overlay = Boolean(document.querySelector('.vite-error-overlay, [data-nextjs-dialog], #webpack-dev-server-client-overlay'));
  const root = document.querySelector('#root');
  return {
    overlay,
    rootChildCount: root?.children.length ?? 0,
    textLength: document.body.innerText.trim().length,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  };
});

const captureStep = async ({
  baseUrl,
  consoleMessages,
  outputDir,
  page,
  pageErrors,
  step,
}) => {
  await page.setViewportSize(step.viewport);
  const beforeConsole = consoleMessages.length;
  const beforeErrors = pageErrors.length;
  const targetUrl = buildUrl(baseUrl, step.route);

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);

  const title = await page.title().catch(() => '');
  const finalUrl = page.url();
  const pageState = await getPageState(page).catch(() => ({
    overlay: true,
    rootChildCount: 0,
    textLength: 0,
    horizontalOverflow: true,
  }));
  const screenshotPath = path.join(outputDir, `${safeFileName(step.id || step.route)}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const stepConsoleIssues = consoleMessages.slice(beforeConsole);
  const stepPageErrors = pageErrors.slice(beforeErrors);
  const failures = [];

  if (pageState.overlay) failures.push('framework_error_overlay');
  if (pageState.textLength <= 0 || pageState.rootChildCount <= 0) failures.push('blank_or_empty_page');
  if (step.failOnHorizontalOverflow !== false && pageState.horizontalOverflow) failures.push('horizontal_overflow');
  if (step.titlePattern && !step.titlePattern.test(title)) failures.push(`unexpected_title:${title}`);
  if (stepConsoleIssues.length) failures.push('console_error');
  if (stepPageErrors.length) failures.push('page_error');

  return {
    id: step.id,
    label: step.label || step.id,
    auth: step.auth,
    route: step.route,
    targetUrl,
    finalUrl,
    title,
    viewport: step.viewport,
    screenshotPath,
    pageState,
    consoleIssues: stepConsoleIssues,
    pageErrors: stepPageErrors,
    status: failures.length ? 'failed' : 'passed',
    failures,
  };
};

const performLogin = async ({ baseUrl, email, page, password }) => {
  if (!email || !password) {
    return {
      attempted: false,
      authenticated: false,
      reason: 'missing_credentials',
    };
  }

  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /login|sign in/i }).click();

  try {
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  } catch {
    const mfaVisible = await page.getByText(/verification|authenticator|mfa|kode|code/i).first().isVisible().catch(() => false);
    return {
      attempted: true,
      authenticated: false,
      reason: mfaVisible ? 'mfa_required' : 'login_timeout',
      finalUrl: page.url(),
    };
  }

  return {
    attempted: true,
    authenticated: !page.url().includes('/login'),
    finalUrl: page.url(),
  };
};

const assertProtectedRedirects = async ({ baseUrl, page, routes }) => {
  const reports = [];
  for (const route of routes) {
    const loginRoute = route.startsWith('/mobile') ? '/mobile/login' : '/login';
    await page.goto(buildUrl(baseUrl, route), { waitUntil: 'networkidle' });
    reports.push({
      route,
      finalUrl: page.url(),
      expectedLoginRoute: loginRoute,
      status: page.url().includes(loginRoute) ? 'passed' : 'failed',
    });
  }
  return reports;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = String(args.get('base-url') || DEFAULT_BASE_URL).replace(/\/$/, '');
  const outputDir = path.resolve(String(args.get('out-dir') || DEFAULT_OUTPUT_DIR));
  const envPath = path.resolve(String(args.get('env-path') || DEFAULT_ENV_PATH));
  const shouldRequireAuth = Boolean(args.get('require-auth'));
  const env = readEnvFile(envPath);
  const email = String(args.get('email') || envFirst(env, ['SMOKE_TEST_EMAIL', 'E2E_EMAIL', 'TEST_USER_EMAIL']) || '');
  const password = String(args.get('password') || envFirst(env, ['SMOKE_TEST_PASSWORD', 'E2E_PASSWORD', 'TEST_USER_PASSWORD']) || '');
  const explicitPublicArticleRoute = String(args.get('public-article-route') || envFirst(env, ['SMOKE_PUBLIC_ARTICLE_ROUTE', 'E2E_PUBLIC_ARTICLE_ROUTE']) || '');

  ensureDirectoryExists(outputDir);

  const publicArticle = await discoverPublicArticleRoute(env, explicitPublicArticleRoute);
  const mobilePublicArticleRoute = publicArticle.route.startsWith('/articles/')
    ? publicArticle.route.replace(/^\/articles\//, '/mobile/articles/')
    : `/mobile${publicArticle.route}`;
  const steps = [
    ...smokeSteps,
    {
      id: 'public-article',
      label: 'Public article',
      route: publicArticle.route,
      viewport: DESKTOP_VIEWPORT,
      auth: 'public',
      titlePattern: /journal|article|solivagant/i,
    },
    {
      id: 'mobile-public-article',
      label: 'Mobile public article',
      route: mobilePublicArticleRoute,
      viewport: MOBILE_VIEWPORT,
      auth: 'public',
      titlePattern: /journal|article|solivagant/i,
    },
  ];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  installPageListeners(page, consoleMessages, pageErrors);

  const reports = [];
  const loginPageStep = steps.find((step) => step.id === 'login');
  reports.push(await captureStep({
    baseUrl,
    consoleMessages,
    outputDir,
    page,
    pageErrors,
    step: loginPageStep,
  }));

  const loginResult = await performLogin({ baseUrl, email, page, password });

  if (loginResult.authenticated) {
    for (const step of steps.filter((item) => item.id !== 'login')) {
      reports.push(await captureStep({
        baseUrl,
        consoleMessages,
        outputDir,
        page,
        pageErrors,
        step,
      }));
    }
  } else {
    for (const step of steps.filter((item) => item.auth === 'public' && item.id !== 'login')) {
      reports.push(await captureStep({
        baseUrl,
        consoleMessages,
        outputDir,
        page,
        pageErrors,
        step,
      }));
    }

    const protectedRedirects = await assertProtectedRedirects({
      baseUrl,
      page,
      routes: steps
        .filter((item) => item.auth === 'protected' || item.auth === 'protected-mobile')
        .map((item) => item.route),
    });
    for (const redirect of protectedRedirects) {
      reports.push({
        id: `redirect-${safeFileName(redirect.route)}`,
        label: `Protected redirect ${redirect.route}`,
        auth: 'protected-redirect',
        route: redirect.route,
        targetUrl: buildUrl(baseUrl, redirect.route),
        finalUrl: redirect.finalUrl,
        title: '',
        viewport: redirect.route.startsWith('/mobile') ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT,
        screenshotPath: null,
        pageState: null,
        consoleIssues: [],
        pageErrors: [],
        status: redirect.status,
        failures: redirect.status === 'passed' ? [] : [`expected_redirect:${redirect.expectedLoginRoute}`],
      });
    }
  }

  await browser.close();

  const failedReports = reports.filter((report) => report.status === 'failed');
  const skippedProtectedFlows = !loginResult.authenticated
    ? steps.filter((step) => step.auth === 'protected' || step.auth === 'protected-mobile').map((step) => step.route)
    : [];
  const summary = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    output_dir: outputDir,
    public_article_discovery: publicArticle.discovery,
    login: loginResult,
    total_steps: reports.length,
    passed_steps: reports.length - failedReports.length,
    failed_steps: failedReports.length,
    skipped_protected_flows: skippedProtectedFlows,
    total_console_errors: consoleMessages.length,
    total_page_errors: pageErrors.length,
    reports,
  };

  writeJsonFile(path.join(outputDir, 'summary.json'), summary);
  console.log(JSON.stringify(summary, null, 2));

  if (failedReports.length || (shouldRequireAuth && !loginResult.authenticated)) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
