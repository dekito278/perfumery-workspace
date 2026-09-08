#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
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
    description: 'Explore the SOLIVAGANT fragrance collection: Hug, Chant Nocturne, Jaipong, Porte vers le Paradis, and Trace d Aventure with notes, concentration, sizes, and price.',
    eyebrow: 'Fragrance Collection',
    heading: 'Fragrance Collection',
    headline: 'Quiet signatures for skin, atmosphere, and ritual.',
    intro: 'Browse SOLIVAGANT public fragrance previews with product stories, notes pyramid, concentration, size variants, Rupiah price, and customer-facing availability.',
    sections: [
      ['Hug', 'Clean musk, iris, warm cotton. Eau de Parfum, 30 ml from Rp 289.000.'],
      ['Chant Nocturne', 'Tuberose, pink pepper, amberwood. Eau de Parfum, 30 ml from Rp 329.000.'],
      ['Jaipong', 'Calamansi, clove leaf, vetiver. Eau de Toilette, 30 ml from Rp 279.000.'],
      ['Porte vers le Paradis', 'Neroli, incense, vanilla resin. Eau de Parfum, 30 ml from Rp 349.000.'],
      ['Trace d Aventure', 'Fig leaf, cedar rain, moss. Eau de Parfum, 30 ml from Rp 309.000.'],
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

const writeStaticPublicPages = (siteUrl) => {
  const distRoot = path.join(webRoot, 'dist');
  const indexPath = path.join(distRoot, 'index.html');
  if (!fs.existsSync(indexPath)) return;

  const baseHtml = fs.readFileSync(indexPath, 'utf8');

  staticPublicPages.forEach((page) => {
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
  writeStaticPublicPages(env.siteUrl);
  writeLlmsTxt(distRoot, env.siteUrl);

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

  const urls = writeSitemap(distRoot, env.siteUrl, { products, journal });
  if (urls) {
    finalizeRobots(distRoot, env.siteUrl);
    console.log(`[seo] Wrote sitemap.xml with ${urls} URL(s).`);
  }
};

// Two environment variables decide the same deadline, and only a comment kept them together. The cron
// (api/orders/expire-reservations.js) reads PAYMENT_RESERVATION_TTL_HOURS; the browser reads
// VITE_PAYMENT_RESERVATION_TTL_HOURS, which is baked in at build time. Both actively cancel unpaid
// reservations and the studio prints the client value as "Batas reserved N jam", so a mismatch either
// cancels orders the cron would have kept or tells a buyer a deadline that is not the one enforced.
// Setting one in Vercel and forgetting the other is a silent, money-losing config drift; make it loud.
const assertReservationTtlAgrees = () => {
  const read = (name) => String(process.env[name] ?? '').trim();
  const server = read('PAYMENT_RESERVATION_TTL_HOURS');
  const client = read('VITE_PAYMENT_RESERVATION_TTL_HOURS');
  if (!server && !client) {
    console.log('[ttl] payment reservation TTL: 24h on both sides (neither override set).');
    return;
  }

  const hours = (value) => (value ? Number(value) : 24);
  if (!Number.isFinite(hours(server)) || !Number.isFinite(hours(client)) || hours(server) <= 0 || hours(client) <= 0) {
    console.error(`[ttl] PAYMENT_RESERVATION_TTL_HOURS="${server}" / VITE_PAYMENT_RESERVATION_TTL_HOURS="${client}" — both must be positive numbers.`);
    process.exit(1);
  }
  if (hours(server) !== hours(client)) {
    console.error(
      `[ttl] the cron cancels unpaid reservations after ${hours(server)}h but the browser was built for `
      + `${hours(client)}h. Set PAYMENT_RESERVATION_TTL_HOURS and VITE_PAYMENT_RESERVATION_TTL_HOURS to the `
      + 'same value — one of them is currently unset and defaulting to 24.',
    );
    process.exit(1);
  }
  console.log(`[ttl] payment reservation TTL: ${hours(server)}h on both sides.`);
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

assertReservationTtlAgrees();

if (viteResult.status === 0) {
  assertDeferredChunksStayLazy();
  await generateSeoArtifacts();
}

process.exit(viteResult.status ?? 1);
