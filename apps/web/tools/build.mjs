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

const BRAND_SUMMARY = 'An artisan perfume atelier by Dekito, crafting quiet olfactive works from raw materials, memory, and personal ritual. Public storefront with a fragrance collection, bespoke consultation, a raw material archive, and an editorial journal.';

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
    route: '/materials',
    title: 'Raw Material Archive - SOLIVAGANT',
    description: 'A public SOLIVAGANT raw material storytelling archive with origin, olfactive family, sensory description, mood, and usage story.',
    eyebrow: 'Raw Material Archive',
    heading: 'Raw Material Archive',
    headline: 'Materials as stories, not inventory.',
    intro: 'A public archive for material storytelling: origin, olfactive family, sensory texture, mood, usage story, and related fragrance references.',
    sections: [
      ['Orris butter', 'Powdered woods with cool violet dust, suede, and cosmetic softness.'],
      ['Green fig leaf', 'Green aromatic material direction with milky leaf, pear skin, and wet stem.'],
      ['Tuberose absolute', 'White floral material with creamed petals, warm skin, and night air.'],
      ['Amberwood accord', 'Amber woods for dry resin, modern woods, and polished depth.'],
    ],
    items: ['Origin', 'Olfactive family', 'Sensory description', 'Mood'],
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
\t\t\t\t\t\t\t<a href="/materials">Materials</a>
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
    resolveEnv, fetchPublicProducts, fetchPublishedJournal,
    writeProductPages, writeSitemap, finalizeRobots,
  } = await import('./seo-artifacts.mjs');

  const env = resolveEnv(webRoot);
  if (!env.siteUrl) {
    console.warn('[seo] No site URL configured (set VITE_PUBLIC_SITE_URL). Skipping canonical URLs, product prerender, and sitemap.');
  }

  writeStaticPublicPages(env.siteUrl);
  writeLlmsTxt(distRoot, env.siteUrl);

  let products = [];
  let journal = [];
  try {
    [products, journal] = await Promise.all([fetchPublicProducts(env), fetchPublishedJournal(env)]);
  } catch (error) {
    console.warn('[seo] Supabase fetch failed, skipping product prerender/sitemap products:', error.message || error);
  }

  if (env.siteUrl && products.length) {
    const baseHtml = fs.readFileSync(indexPath, 'utf8');
    const written = writeProductPages(distRoot, baseHtml, products, env.siteUrl);
    console.log(`[seo] Prerendered ${written} product page(s).`);
  }

  const urls = writeSitemap(distRoot, env.siteUrl, { products, journal });
  if (urls) {
    finalizeRobots(distRoot, env.siteUrl);
    console.log(`[seo] Wrote sitemap.xml with ${urls} URL(s).`);
  }
};

if (viteResult.status === 0) {
  await generateSeoArtifacts();
}

process.exit(viteResult.status ?? 1);
