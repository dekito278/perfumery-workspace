#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { DEFAULT_SHARE_IMAGE as SHARE_IMAGE_PATH } from '../src/utils/seo.js';
import fs from 'node:fs';
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

const vitePackageJsonPath = require.resolve('vite/package.json', {
  paths: [webRoot, path.resolve(webRoot, '..', '..')],
});
const viteBinPath = path.join(path.dirname(vitePackageJsonPath), 'bin', 'vite.js');
const viteResult = runNode([viteBinPath, 'build', '--outDir', 'dist']);

const BRAND_SUMMARY = 'An artisan perfume atelier by Dekito, crafting quiet olfactive works from raw materials, memory, and personal ritual. Public storefront with a fragrance collection, bespoke consultation, and an editorial journal.';

const staticPublicPages = [
  {
    route: '/home',
    title: 'SOLIVAGANT - Artisan Perfumery Atelier by Dekito',
    description: 'SOLIVAGANT is an artisan perfumery atelier by Dekito, crafting quiet fragrance objects from raw materials, memory, and personal ritual.',
    eyebrow: 'Artisan Perfumery Atelier',
    heading: 'SOLIVAGANT',
    headline: 'Fragrance as a memory object.',
    intro: 'An artisan perfume atelier by Dekito, crafting quiet olfactive works from raw materials, memory, and personal ritual.',
    sections: [
      ['Fragrance Collection', 'A public catalog of perfume objects with notes, concentration, size variants, price, and availability.'],
      ['Bespoke Consultation', 'Request parfum custom through Aroma, Preferensi, Botol, Ongkir, and Bayar. Pre-order 7-14 hari.'],
      ['Raw Material Archive', 'Public material stories for origin, olfactive family, sensory description, and mood.'],
      ['Journal', 'Editorial notes on scent memory, materials, atelier process, product stories, and perfumery culture.'],
    ],
    items: ['Hero', 'Perfumer story', 'Collection preview', 'Bespoke ritual'],
  },
  {
    route: '/catalog',
    title: 'Fragrance Collection - SOLIVAGANT',
    // Deliberately names no products. The previous description listed five, and four of them —
    // Chant Nocturne, Jaipong, Porte vers le Paradis, Trace d'Aventure — had been discontinued; their
    // routes now redirect to this page. Search results were advertising perfumes that cannot be bought.
    // A description that describes the collection instead of enumerating it cannot go stale.
    description: 'Explore the SOLIVAGANT fragrance collection: limited artisan perfume objects and quiet daily signatures, each with its notes, concentration, sizes, and price.',
    eyebrow: 'Fragrance Collection',
    heading: 'Fragrance Collection',
    headline: 'Quiet signatures for skin, atmosphere, and ritual.',
    intro: 'Browse SOLIVAGANT public fragrance previews with product stories, notes pyramid, concentration, size variants, Rupiah price, and customer-facing availability.',
    // Replaced at build time by the live catalogue. This stays only for a build that cannot reach
    // Supabase, so it names no products — the previous list outlived four of the five it advertised.
    sections: [
      ['Objek terbatas', 'Small-batch artisan perfumes, released in limited runs.'],
      ['Signature harian', 'Quiet daily wear built for skin and atmosphere.'],
    ],

    items: ['Semua', 'Gourmand', 'Aquatic', 'Woody', 'Floral'],
  },
  {
    route: '/bespoke',
    title: 'Bespoke Perfume Consultation - SOLIVAGANT',
    description: 'Request a SOLIVAGANT custom perfume consultation. Public flow: Aroma, Preferensi, Botol, Ongkir, Bayar. Pre-order 7-14 hari.',
    eyebrow: 'Bespoke Perfume Consultation',
    heading: 'Bespoke Perfume Consultation',
    headline: 'Request parfum custom. Pre-order 7-14 hari.',
    intro: 'A customer-facing custom perfume request flow inspired by the studio process while keeping formulas, validation, materials cost, and production details private.',
    sections: [
      ['Aroma', 'Choose the desired scent direction, notes, mood, and memory references.'],
      ['Preferensi', 'Share purpose, skin impression, projection preference, and personal references.'],
      ['Botol', 'Select 30 ml, 50 ml, or 100 ml and bottle preference.'],
      ['Ongkir', 'Provide delivery area for shipping estimate.'],
      ['Bayar', 'Continue toward a public checkout placeholder when the request is ready.'],
    ],
    items: ['Aroma', 'Preferensi', 'Botol', 'Ongkir', 'Bayar'],
  },
  {
    route: '/journal',
    title: 'Journal - SOLIVAGANT',
    description: 'SOLIVAGANT public editorial journal about scent memory, raw materials, atelier process, product stories, and perfumery culture.',
    eyebrow: 'Journal',
    heading: 'Journal',
    headline: 'Field notes from the atelier.',
    intro: 'Editorial notes from SOLIVAGANT on scent memory, raw materials, atelier process, product stories, and the culture of wearing fragrance.',
    sections: [
      ['Fragrance as a memory object', 'How a place, gesture, or remembered person becomes the structure of a perfume brief.'],
      ['Reading woods, musks, and green shadows', 'A material note on texture, volatility, and tactile fragrance decisions.'],
      ['From lab note to finished bottle', 'The rhythm of weighing, resting, evaluating, refining, and finishing a small perfume batch.'],
      ['The small etiquette of wearing scent', 'Projection, intimacy, weather, and choosing fragrance for shared rooms.'],
    ],
    items: ['Scent memory', 'Raw materials', 'Atelier process', 'Product stories'],
  },
];

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character]);

// Replace a <meta> tag's content, or insert it before </head> if it doesn't exist.
// (index.html no longer ships static OG tags — react-helmet owns them at runtime —
// so the prerendered marketing snapshots must inject rather than only replace.)
const replaceMetaContent = (html, selector, content) => {
  const escapedContent = escapeHtml(content);
  const pattern = new RegExp(`<meta ${selector} content="[^"]*" ?\\/?>`);
  const replacement = `<meta ${selector} content="${escapedContent}" />`;
  if (html.match(pattern)) return html.replace(pattern, replacement);
  return html.replace('</head>', `\t\t${replacement}\n\t</head>`);
};

const upsertCanonical = (html, href) => {
  const tag = `<link rel="canonical" href="${escapeHtml(href)}" />`;
  if (/<link rel="canonical"[^>]*>/i.test(html)) {
    return html.replace(/<link rel="canonical"[^>]*>/i, tag);
  }
  return html.replace('</head>', `\t\t${tag}\n\t</head>`);
};

const renderStaticFallback = (page) => {
  const sections = page.sections.map(([title, text]) => `
\t\t\t\t\t\t\t<article>
\t\t\t\t\t\t\t\t<h3>${escapeHtml(title)}</h3>
\t\t\t\t\t\t\t\t<p>${escapeHtml(text)}</p>
\t\t\t\t\t\t\t</article>`).join('');
  const items = page.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

  return `<noscript>
\t\t\t\t<main class="app-boot-fallback" aria-label="SOLIVAGANT public storefront">
\t\t\t\t\t<div>
\t\t\t\t\t\t<p>${escapeHtml(page.eyebrow)}</p>
\t\t\t\t\t\t<h1>${escapeHtml(page.heading)}</h1>
\t\t\t\t\t\t<h2>${escapeHtml(page.headline)}</h2>
\t\t\t\t\t\t<p class="app-boot-description">${escapeHtml(page.intro)} The interactive storefront requires JavaScript for product browsing, cart, checkout, and order tracking.</p>
\t\t\t\t\t\t<section class="app-boot-sections" aria-label="Public storefront previews">${sections}
\t\t\t\t\t\t</section>
\t\t\t\t\t\t<ul class="app-boot-structure" aria-label="Public storefront sections">${items}</ul>
\t\t\t\t\t\t<div class="app-boot-links">
\t\t\t\t\t\t\t<a href="/">Homepage</a>
\t\t\t\t\t\t\t<a href="/catalog">Collection</a>
\t\t\t\t\t\t\t<a href="/bespoke">Bespoke</a>
\t\t\t\t\t\t\t<a href="/journal">Journal</a>
\t\t\t\t\t\t</div>
\t\t\t\t\t</div>
\t\t\t\t</main>
\t\t\t</noscript>`;
};

// `products` are the live rows the sitemap is built from. The catalogue snapshot lists them instead of a
// hand-written array: that array had gone stale and was advertising four discontinued perfumes with
// prices to every crawler and every visitor without JavaScript.
const writeStaticPublicPages = (siteUrl, products = []) => {
  const distRoot = path.join(webRoot, 'dist');
  const indexPath = path.join(distRoot, 'index.html');
  if (!fs.existsSync(indexPath)) return;

  const baseHtml = fs.readFileSync(indexPath, 'utf8');

  const catalogSections = products
    .slice(0, 12)
    .map((product) => [product.name, [product.description, product.concentration, product.priceNumber ? `Rp ${product.priceNumber.toLocaleString('id-ID')}` : ''].filter(Boolean).join('. ')]);

  staticPublicPages.forEach((rawPage) => {
    // Only the catalogue is generated; the rest are stable descriptions of the flow, not of stock.
    const page = rawPage.route === '/catalog' && catalogSections.length
      ? { ...rawPage, sections: catalogSections }
      : rawPage;
    const routeName = page.route.replace(/^\/+/, '');
    const routeDir = path.join(distRoot, routeName);
    const routePath = path.join(routeDir, 'index.html');
    const canonical = siteUrl ? `${siteUrl}${page.route}` : '';

    let html = baseHtml
      .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(page.title)}</title>`)
      .replace(/<noscript>[\s\S]*?<\/noscript>/, renderStaticFallback(page));
    html = replaceMetaContent(html, 'name="description"', page.description);
    html = replaceMetaContent(html, 'property="og:type"', 'website');
    html = replaceMetaContent(html, 'property="og:site_name"', 'SOLIVAGANT');
    html = replaceMetaContent(html, 'property="og:title"', page.title);
    html = replaceMetaContent(html, 'property="og:description"', page.description);
    // These four pages claimed a large-image card while offering no image at all, so a link shared to
    // WhatsApp or Instagram previewed as bare text — on the four pages most likely to be shared.
    const shareImage = siteUrl ? `${siteUrl}${SHARE_IMAGE_PATH}` : SHARE_IMAGE_PATH;
    html = replaceMetaContent(html, 'property="og:image"', shareImage);
    html = replaceMetaContent(html, 'name="twitter:image"', shareImage);
    html = replaceMetaContent(html, 'name="twitter:card"', 'summary_large_image');
    html = replaceMetaContent(html, 'name="twitter:title"', page.title);
    html = replaceMetaContent(html, 'name="twitter:description"', page.description);
    if (canonical) {
      html = replaceMetaContent(html, 'property="og:url"', canonical);
      html = upsertCanonical(html, canonical);
    }

    fs.mkdirSync(routeDir, { recursive: true });
    fs.writeFileSync(routePath, html);
  });
};

// llms.txt describes the site to AI crawlers, so it lists the public storefront and
// nothing else. It is built from staticPublicPages — the same curated routes,
// titles and descriptions used for the prerendered marketing snapshots — rather
// than scraped from src/pages, which is how the previous generator ended up
// publishing the studio surface (/dashboard, /orders, /customers, /vouchermanagement,
// …) under filename-derived URLs that were mostly not real routes.
// Every prerendered page must offer a share image. Four of them claimed a large-image card while
// providing none, so sharing the home page, the catalogue, the journal or the bespoke page to WhatsApp
// previewed as bare text — and those are the four most likely to be shared.
const assertEveryPageHasShareImage = (distRoot) => {
  const bare = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'index.html') {
        const html = fs.readFileSync(full, 'utf8');
        const match = html.match(/<meta property="og:image" content="([^"]*)"/);
        if (!match || !match[1].trim()) bare.push(path.relative(distRoot, full) || 'index.html');
      }
    }
  };
  walk(distRoot);

  if (bare.length) {
    throw new Error(
      `these prerendered pages ship no og:image, so a shared link previews as bare text:\n  ${bare.join('\n  ')}`,
    );
  }
};

const writeLlmsTxt = (distRoot, siteUrl) => {
  const absolute = (route) => (siteUrl ? `${siteUrl}${route}` : route);
  const body = staticPublicPages
    .map((page) => `- [${page.title}](${absolute(page.route)}): ${page.description}`)
    .join('\n');

  fs.writeFileSync(
    path.join(distRoot, 'llms.txt'),
    `# SOLIVAGANT\n\n> ${BRAND_SUMMARY}\n\n## Pages\n${body}\n`,
  );
};

const generateSeoArtifacts = async () => {
  const distRoot = path.join(webRoot, 'dist');
  const indexPath = path.join(distRoot, 'index.html');
  if (!fs.existsSync(indexPath)) return;

  const {
    STATIC_PUBLIC_ROUTES, resolveEnv, fetchPublicProducts, fetchPublishedJournal,
    writeProductPages, writeJournalPages, writeSitemap, finalizeRobots,
  } = await import('./seo-artifacts.mjs');

  const env = resolveEnv(webRoot);
  if (!env.siteUrl) {
    console.warn('[seo] No site URL configured (set VITE_PUBLIC_SITE_URL). Skipping canonical URLs, product prerender, and sitemap.');
  }

  assertAdvertisedRoutesExist(STATIC_PUBLIC_ROUTES);
  let products = [];
  let journal = [];
  try {
    [products, journal] = await Promise.all([fetchPublicProducts(env), fetchPublishedJournal(env)]);
  } catch (error) {
    console.warn('[seo] Supabase fetch failed, skipping product prerender/sitemap products:', error.message || error);
  }

  // A shop that builds with zero products is a configuration bug, not an empty catalogue: it shipped for
  // months as an unindexable storefront because nothing complained. Only fatal when the fetch itself
  // succeeded — a Supabase outage lands in the catch above and must not block an urgent deploy. The
  // escape hatch is for a genuinely empty environment.
  if (!products.length && journal.length && !process.env.SEO_ALLOW_EMPTY_CATALOG) {
    console.error(
      '[seo] Supabase answered but returned zero products, while the journal fetch worked — so this is not '
      + 'connectivity. Check that fetchPublicProducts still reads a table the anon key can see '
      + '(storefront_products_public), and that RLS on it has not changed. Set SEO_ALLOW_EMPTY_CATALOG=1 to '
      + 'build anyway.',
    );
    process.exit(1);
  }

  writeStaticPublicPages(env.siteUrl, products);
  writeLlmsTxt(distRoot, env.siteUrl);

  if (env.siteUrl && (products.length || journal.length)) {
    const baseHtml = fs.readFileSync(indexPath, 'utf8');
    if (products.length) {
      console.log(`[seo] Prerendered ${writeProductPages(distRoot, baseHtml, products, env.siteUrl)} product page(s).`);
    }
    if (journal.length) {
      console.log(`[seo] Prerendered ${writeJournalPages(distRoot, baseHtml, journal, env.siteUrl)} journal article(s).`);
    }
  }

  assertPrerenderedPagesAreIntact();
  assertEveryPageHasShareImage(distRoot);

  const urls = writeSitemap(distRoot, env.siteUrl, { products, journal });
  if (urls) {
    finalizeRobots(distRoot, env.siteUrl);
    console.log(`[seo] Wrote sitemap.xml with ${urls} URL(s).`);
  }
};

// The bespoke option prices live in storefront_bespoke_options. defaultBespokeSettings in
// services/bespokeSettingsService.js is the copy the app falls back to when that table cannot be reached,
// and it had drifted a long way: 30 ml read Rp 350.000 there against Rp 200.000 in the shop, with
// different labels besides. Nothing compared them, and nothing would have.
//
// A warning, never a failure. Prices are changed in the studio, not in a deploy, so a stale fallback must
// not block shipping an unrelated fix — and a build that cannot reach Supabase must still succeed.
const warnIfBespokeDefaultsDrifted = async () => {
  const COLLECTIONS = { bottleSizes: 'bottleSizes', bottleTypes: 'bottleTypes', capDesigns: 'capDesigns', labelDesigns: 'labelDesigns', exoticMaterials: 'exoticMaterials' };
  try {
    const { resolveEnv } = await import('./seo-artifacts.mjs');
    const { supabaseUrl, supabaseKey } = resolveEnv(webRoot);
    if (!supabaseUrl || !supabaseKey) return;

    const response = await fetch(`${supabaseUrl}/rest/v1/storefront_bespoke_options?select=collection_key,label,price,enabled`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return;
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) return;

    const source = fs.readFileSync(path.join(webRoot, 'src', 'services', 'bespokeSettingsService.js'), 'utf8');
    const block = source.slice(source.indexOf('export const defaultBespokeSettings'), source.indexOf('const toSlug'));

    const differences = [];
    for (const key of Object.keys(COLLECTIONS)) {
      const section = block.slice(block.indexOf(`${key}: [`), block.indexOf(']', block.indexOf(`${key}: [`)));
      // Accept either quote style: one description contains a newline, so those entries are written with
      // double quotes and JSON escaping rather than single quotes.
      const bundled = new Map([...section.matchAll(/label: (?:'([^']*)'|"((?:[^"\\]|\\.)*)")[\s\S]*?price: (\d+)/g)]
        .map((m) => [m[1] ?? JSON.parse(`"${m[2]}"`), Number(m[3])]));
      const live = new Map(rows.filter((row) => row.collection_key === key && row.enabled !== false).map((row) => [row.label, Number(row.price || 0)]));

      for (const [label, price] of live) {
        if (!bundled.has(label)) differences.push(`${key}: the shop has "${label}" (${price}); the fallback does not`);
        else if (bundled.get(label) !== price) differences.push(`${key}: "${label}" is ${price} in the shop, ${bundled.get(label)} in the fallback`);
      }
      for (const label of bundled.keys()) {
        if (!live.has(label)) differences.push(`${key}: the fallback still offers "${label}"; the shop does not`);
      }
    }

    if (differences.length) {
      console.warn(
        `[bespoke] WARNING: ${differences.length} difference(s) between the bundled fallback prices and the `
        + `shop. Customers only see the fallback while storefront_bespoke_options is unreachable, but while `
        + `it drifts that view is wrong:\n  ${differences.join('\n  ')}\n  Update defaultBespokeSettings in `
        + 'src/services/bespokeSettingsService.js.',
      );
    } else {
      console.log('[bespoke] fallback option prices match the shop.');
    }
  } catch {
    // Offline, timed out, or the table moved: none of that should stop a deploy.
  }
};

// Some numbers are configured twice — once for the cron or the order endpoint, once for the browser,
// where the value is baked in at build time. Each pair used to be held together by a comment asking
// whoever changed one to remember the other. Both sides act on these, so a mismatch is silent and costs
// money: an unpaid order cancelled early is a lost sale, and a shipping weight that differs from the
// buyer's quote means the order is created at a fee they never saw.
//
// Each entry resolves both sides the way the shipped code actually does, including its fallbacks.
const PAIRED_ENV = [
  {
    what: 'payment reservation TTL (hours)',
    server: (env) => env('PAYMENT_RESERVATION_TTL_HOURS'),
    client: (env) => env('VITE_PAYMENT_RESERVATION_TTL_HOURS'),
    fallback: 24,
    names: ['PAYMENT_RESERVATION_TTL_HOURS', 'VITE_PAYMENT_RESERVATION_TTL_HOURS'],
    consequence: 'the cron and the browser would cancel unpaid reservations at different times, and the studio would show the buyer a deadline nobody enforces',
  },
  {
    what: 'per-item shipping weight (grams)',
    // api/orders/create.js reads DEFAULT_ITEM_WEIGHT_GRAM and falls back to the client's own variable,
    // so setting only the VITE one keeps both sides equal — only an explicit server override can drift.
    server: (env) => env('DEFAULT_ITEM_WEIGHT_GRAM') || env('VITE_DEFAULT_ITEM_WEIGHT_GRAM'),
    client: (env) => env('VITE_DEFAULT_ITEM_WEIGHT_GRAM'),
    fallback: 300,
    names: ['DEFAULT_ITEM_WEIGHT_GRAM', 'VITE_DEFAULT_ITEM_WEIGHT_GRAM'],
    consequence: 'the buyer would be quoted one ongkir at checkout and the order created with another, because api/orders/create.js reprices shipping from its own weight',
  },
];

// The canonical origin is resolved twice, and the two chains are not the same. tools/seo-artifacts.mjs
// also honours SITE_URL, which the browser cannot see — a non-VITE variable is never exposed to the
// bundle. Set only SITE_URL and the prerendered pages carry one canonical while every runtime canonical,
// og:url and JSON-LD carries another: two different origins claiming to be the same page, which is how
// a search engine is told to ignore the hint entirely.
//
// The default is also written out as a literal in both files, so that is compared here rather than
// trusted to stay equal.
const assertCanonicalOriginAgrees = async () => {
  const { loadDotEnv } = await import('./seo-artifacts.mjs');
  const fileEnv = loadDotEnv(webRoot);
  const env = (name) => String(process.env[name] ?? fileEnv[name] ?? '').trim();

  const runtimeSource = fs.readFileSync(path.join(webRoot, 'src', 'utils', 'seo.js'), 'utf8');
  const runtimeDefault = runtimeSource.match(/DEFAULT_SITE_URL = '([^']+)'/)?.[1];
  const buildSource = fs.readFileSync(path.join(webRoot, 'tools', 'seo-artifacts.mjs'), 'utf8');
  const buildDefault = buildSource.match(/DEFAULT_SITE_URL = '([^']+)'/)?.[1];
  if (!runtimeDefault || !buildDefault) {
    console.error('[origin] could not read DEFAULT_SITE_URL from both resolvers — update this guard.');
    process.exit(1);
  }
  if (runtimeDefault !== buildDefault) {
    console.error(`[origin] DEFAULT_SITE_URL is "${buildDefault}" in tools/seo-artifacts.mjs but "${runtimeDefault}" in src/utils/seo.js.`);
    process.exit(1);
  }

  const trim = (value) => value.replace(/\/+$/, '');
  // Exactly the chains the two files use today.
  const built = trim(env('VITE_PUBLIC_SITE_URL') || env('SITE_URL') || env('VITE_SITE_URL') || buildDefault);
  const runtime = trim(env('VITE_PUBLIC_SITE_URL') || env('VITE_SITE_URL') || runtimeDefault);

  if (built !== runtime) {
    console.error(
      `[origin] prerendered pages would claim ${built} while the running app claims ${runtime}. SITE_URL is `
      + 'set but the browser cannot read it — only VITE_ variables reach the bundle. Set '
      + 'VITE_PUBLIC_SITE_URL to the origin you want.',
    );
    process.exit(1);
  }
  console.log(`[origin] canonical origin: ${built} in both the prerender and the app.`);

  // Whichever origin is configured, it has to be the one that actually answers. Pointing the sitemap and
  // every canonical at a host that 307s to another host tells a crawler the page lives somewhere it does
  // not: the URLs it is given all redirect, and a canonical aimed at a redirect is a weak signal at best.
  // A warning, never a failure — the build must not depend on the network being up.
  try {
    const probe = await fetch(`${built}/catalog`, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(4000),
    });
    if (probe.status >= 300 && probe.status < 400) {
      const target = probe.headers.get('location') || '(unknown)';
      console.warn(
        `[origin] WARNING: ${built} answers ${probe.status} and redirects to ${target}. Every sitemap URL `
        + 'and every canonical tag currently points at a redirect. Set VITE_PUBLIC_SITE_URL to the origin '
        + 'that serves 200 directly.',
      );
    }
  } catch {
    // Offline, DNS not resolving, or the site is down: none of that should stop a deploy.
  }
};

const assertPairedEnvAgrees = async () => {
  // Read what Vite will actually bake in, not just the shell: on Vercel the project variables arrive in
  // process.env, but locally they live in apps/web/.env, and comparing only process.env would report a
  // clean pair while the bundle carried a different number.
  const { loadDotEnv } = await import('./seo-artifacts.mjs');
  const fileEnv = loadDotEnv(webRoot);
  const env = (name) => process.env[name] ?? fileEnv[name];

  for (const pair of PAIRED_ENV) {
    const rawServer = String(pair.server(env) ?? '').trim();
    const rawClient = String(pair.client(env) ?? '').trim();
    const server = rawServer ? Number(rawServer) : pair.fallback;
    const client = rawClient ? Number(rawClient) : pair.fallback;

    if (!Number.isFinite(server) || !Number.isFinite(client) || server <= 0 || client <= 0) {
      console.error(`[env] ${pair.names[0]}="${rawServer}" / ${pair.names[1]}="${rawClient}" — ${pair.what} must be a positive number.`);
      process.exit(1);
    }
    if (server !== client) {
      // Name only the side that is actually missing. Saying "one of them is unset" when both are set
      // sends whoever reads this looking in the wrong place.
      const unset = [!rawServer && pair.names[0], !rawClient && pair.names[1]].filter(Boolean);
      const hint = unset.length
        ? `${unset.join(' and ')} ${unset.length > 1 ? 'are' : 'is'} unset and defaulting to ${pair.fallback}`
        : 'both are set, to different values';
      console.error(
        `[env] ${pair.what}: server ${server}, browser ${client} — ${hint}. Set ${pair.names[0]} and `
        + `${pair.names[1]} to the same value. Left as is, ${pair.consequence}.`,
      );
      process.exit(1);
    }
    console.log(`[env] ${pair.what}: ${server} on both sides${rawServer || rawClient ? '' : ' (default)'}.`);
  }
};

// Every prerendered page must still be a page. Eighteen product pages and a journal article shipped as
// blank documents because the title replacement started matching at a <title> written inside an HTML
// comment and ran to the real </title>, eating the comment's closing --> along the way. The rest of the
// file — the stylesheet, #root and the module script — was then swallowed by an unterminated comment.
// Nothing noticed: the files were the right size, returned 200, and carried correct meta tags.
const assertPrerenderedPagesAreIntact = () => {
  const distRoot = path.join(webRoot, 'dist');
  if (!fs.existsSync(distRoot)) return;

  const pages = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'assets') walk(full);
      else if (entry.name === 'index.html') pages.push(full);
    }
  };
  walk(distRoot);

  const broken = [];
  for (const page of pages) {
    const html = fs.readFileSync(page, 'utf8');
    const opens = (html.match(/<!--/g) || []).length;
    const closes = (html.match(/-->/g) || []).length;
    const rel = path.relative(distRoot, page);
    if (opens !== closes) broken.push(`${rel}: ${opens} <!-- but ${closes} --> (an unterminated comment hides the rest of the page)`);
    else if (!html.includes('id="root"')) broken.push(`${rel}: no #root element`);
    else if (!/<script[^>]+type="module"/.test(html)) broken.push(`${rel}: no module script, so the app never boots`);
    else if ((html.match(/<title>/g) || []).length !== 1) {
      // A <title> written inside a comment counts here on purpose: that is exactly what the title
      // replacement used to latch onto, and keeping the tag out of prose keeps the trap from returning.
      broken.push(`${rel}: ${(html.match(/<title>/g) || []).length} <title> tags — one of them may be inside a comment, which is what broke the prerender before; do not write the tag name as markup in prose`);
    }
  }

  if (broken.length) {
    console.error(`[prerender] ${broken.length} of ${pages.length} prerendered page(s) would render blank:\n  ${broken.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`[prerender] ${pages.length} page(s) intact.`);
};

// Everything the build advertises must be a route the app actually serves. /materials was in the sitemap,
// had a prerendered page with its own title and description, and was listed in llms.txt for AI crawlers —
// while App.jsx had no route for it, so every arrival got the 404 page. The page component exists and is
// finished; it was simply never wired up, and nothing connected the advertising to the routing.
const assertAdvertisedRoutesExist = (staticRoutes) => {
  const app = fs.readFileSync(path.join(webRoot, 'src', 'App.jsx'), 'utf8');
  const routed = new Set([...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1]));
  const missing = staticRoutes.filter((route) => !routed.has(route));
  if (missing.length) {
    console.error(
      `[routes] the build advertises ${missing.join(', ')} in the sitemap, the prerendered pages and `
      + 'llms.txt, but App.jsx has no matching <Route path>. Visitors from search land on the 404 page. '
      + 'Either add the route or stop advertising the path.',
    );
    process.exit(1);
  }
  console.log(`[routes] ${staticRoutes.length} advertised static route(s) exist in App.jsx.`);
};

// Chunks listed as deferred in vite.config.js must never be reachable from the entry by a STATIC import.
// They were not, and then Rollup hoisted Vite's preload helper into pdf-export-vendor: because every chunk
// that uses a dynamic import must statically import that helper, the entry chunk gained
// `import { _ } from './pdf-export-vendor.js'` and every visitor to a product page downloaded 520 kB of
// jspdf and html2canvas. Nothing in the bundle output showed it — the chunk was still listed as separate,
// still absent from modulepreload, and still only imported dynamically in the source.
const assertDeferredChunksStayLazy = () => {
  const distRoot = path.join(webRoot, 'dist');
  const indexPath = path.join(distRoot, 'index.html');
  if (!fs.existsSync(indexPath)) return;

  const viteConfig = fs.readFileSync(path.join(webRoot, 'vite.config.js'), 'utf8');
  const deferred = [...(viteConfig.match(/const deferredPreloadChunks = \[([\s\S]*?)\]/)?.[1] || '')
    .matchAll(/'([^']+)'/g)].map((m) => m[1]);
  if (!deferred.length) return;

  const entry = fs.readFileSync(indexPath, 'utf8').match(/<script[^>]+src="\/assets\/([^"]+\.js)"/)?.[1];
  if (!entry) return;

  // Walk only STATIC imports. `import("./x.js")` has a paren before the quote and never matches.
  const staticImports = (file) => {
    const full = path.join(distRoot, 'assets', file);
    if (!fs.existsSync(full)) return [];
    const code = fs.readFileSync(full, 'utf8');
    return [...code.matchAll(/(?:\bimport|\bfrom)\s*["']\.\/([^"']+\.js)["']/g)].map((m) => m[1]);
  };

  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const offender = deferred.find((name) => file.startsWith(name));
    if (offender) {
      console.error(
        `[bundle] "${offender}" is reachable from the entry chunk by a static import, so every visitor `
        + `downloads it. Chain reached ${file}. Check what Rollup hoisted into that chunk — the preload `
        + 'helper is the usual culprit — and pin it in getManualChunk.',
      );
      process.exit(1);
    }
    queue.push(...staticImports(file));
  }
  console.log(`[bundle] ${deferred.length} deferred chunk(s) stay out of the entry graph (${seen.size} chunks walked).`);
};

await assertPairedEnvAgrees();
await assertCanonicalOriginAgrees();
await warnIfBespokeDefaultsDrifted();

if (viteResult.status === 0) {
  assertDeferredChunksStayLazy();
  await generateSeoArtifacts();
}

process.exit(viteResult.status ?? 1);
