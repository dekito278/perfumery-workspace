// Build-time SEO artifacts: per-product prerendered HTML (baked meta + JSON-LD for
// no-JS crawlers/social scrapers) and sitemap.xml. Runs after `vite build` from
// tools/build.mjs. Never throws in a way that fails the build — SEO is best-effort.

import fs from 'node:fs';
import { getOptimizedStorageImageUrl } from '../src/utils/storageImage.js';
import { DEFAULT_SHARE_IMAGE as SHARE_IMAGE_PATH } from '../src/utils/seo.js';
import { schemaAvailability } from '../src/utils/schemaAvailability.js';
import path from 'node:path';

// The public routes the sitemap, the prerendered pages and llms.txt all advertise. build.mjs checks
// each one against App.jsx before a deploy can ship a link to a 404.
export const STATIC_PUBLIC_ROUTES = ['/home', '/catalog', '/journal', '/bespoke'];

// The English shop is a second address for the same app (see utils/storefrontRegion.js). A prerendered
// file carries ONE title, description and og:image, so the Indonesian file could never speak for the
// English shop: /catalog/hug-n-1?lang=en previewed in Indonesian wherever it was pasted. These are the
// twins that can.
export const EN_PREFIX = '/en';

// The journal is deliberately NOT twinned. journal_posts has no English columns, so an /en/articles/...
// page would be English chrome around an Indonesian article — the same text at a second address, which
// is a duplicate, not a translation. robots.txt keeps crawlers off the English journal instead.

const DRAFT_TAG = 'studio draft';
const BRAND = 'SOLIVAGANT';
// Canonical production origin (overridable via VITE_PUBLIC_SITE_URL / SITE_URL env).
const DEFAULT_SITE_URL = 'https://www.solivagantscent.com';

// 155 characters is what a search result shows. Cut at a word, not mid-word, and never leave the reader
// staring at half of one.
const snippet = (value, limit = 155) => {
  const flat = String(value || '').replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return flat;
  const cut = flat.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:—-]+$/, '')}…`;
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// --- env ---------------------------------------------------------------

export const loadDotEnv = (webRoot) => {
  const envPath = path.join(webRoot, '.env');
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
};

export const resolveEnv = (webRoot) => {
  const fileEnv = loadDotEnv(webRoot);
  const get = (key) => process.env[key] || fileEnv[key] || '';
  // Deliberately NOT falling back to VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL: those
  // resolve to whatever hostname Vercel assigned (the bare apex, or a preview URL), so
  // they emitted canonicals pointing at a 307 redirect instead of the live www origin.
  // NOT an exact mirror of src/utils/seo.js getSiteOrigin(): that chain cannot include SITE_URL, because a
  // non-VITE variable never reaches the bundle. assertCanonicalOriginAgrees() in tools/build.mjs compares
  // the two resolved origins and refuses to build when they differ.
  const siteUrl = (
    get('VITE_PUBLIC_SITE_URL')
    || get('SITE_URL')
    || get('VITE_SITE_URL')
    || DEFAULT_SITE_URL
  ).replace(/\/+$/, '');
  return {
    siteUrl,
    supabaseUrl: get('VITE_SUPABASE_URL').replace(/\/+$/, ''),
    supabaseKey: get('VITE_SUPABASE_ANON_KEY'),
  };
};

// --- supabase REST -----------------------------------------------------

const restGet = async (env, pathAndQuery) => {
  if (!env.supabaseUrl || !env.supabaseKey) return null;
  const url = `${env.supabaseUrl}/rest/v1/${pathAndQuery}`;
  const res = await fetch(url, {
    headers: { apikey: env.supabaseKey, Authorization: `Bearer ${env.supabaseKey}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} for ${pathAndQuery}`);
  return res.json();
};

const toList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).map((v) => String(v).trim());
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try { return toList(JSON.parse(trimmed)); } catch { /* fall through */ }
    }
    return trimmed ? trimmed.split(',').map((v) => v.trim()).filter(Boolean) : [];
  }
  return [];
};

const firstImage = (row) => {
  if (row.image_url) return String(row.image_url);
  const imgs = toList(row.image_urls);
  return imgs[0] || '';
};

export const fetchPublicProducts = async (env) => {
  const rows = await restGet(
    env,
    // storefront_products_public, NOT storefront_products. The base table became admin-only when write
    // and read RLS moved to is_admin(), so this build-time fetch — which authenticates with the anon key —
    // started answering 200 with zero rows. Not an error, just an empty shop: every product silently
    // dropped out of the sitemap and lost its prerendered title, description and JSON-LD, while the
    // journal still resolved and made the sitemap look populated. The view exists for exactly this and
    // already drops drafts and strips internal tags.
    'storefront_products_public?select=slug,name,category,price_number,stock,variants,notes,description,notes_en,description_en,top_notes,heart_notes,base_notes,image_url,image_urls,tags,concentration,updated_at&order=created_at.desc',
  );
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && row.slug && row.name)
    .filter((row) => !toList(row.tags).some((tag) => tag.toLowerCase() === DRAFT_TAG))
    .map((row) => ({
      slug: String(row.slug),
      name: String(row.name).trim(),
      category: row.category || 'Atelier fragrance',
      priceNumber: Number(row.price_number || 0),
      // Carried so the Offer can state real availability instead of assuming every product is in stock.
      stock: row.stock,
      variants: Array.isArray(row.variants) ? row.variants : [],
      // BOTH shops describe themselves with the STORY, and fall back to the note list.
      //
      // The Indonesian page used to lead with `notes`, which is perfume vocabulary and is already
      // English in 16 of the 18 rows — so the main shop's search result read "HUG N°1 — Metallic, milky,
      // musky", three English words, while the English shop had a whole sentence. Somebody searching in
      // Indonesian was shown the worse half in the wrong language.
      //
      // The fallback still reaches the other language rather than nothing: a snippet a reader has to
      // translate still says which perfume it is, and an empty one says nothing at all.
      description: String(row.description || row.notes || `Objek parfum ${BRAND} oleh Dekito.`).trim(),
      descriptionEn: String(row.description_en || row.notes_en || row.description || row.notes || '').trim(),
      image: firstImage(row),
      topNotes: toList(row.top_notes),
      heartNotes: toList(row.heart_notes),
      baseNotes: toList(row.base_notes),
      concentration: row.concentration || 'Eau de Parfum',
      updatedAt: row.updated_at || '',
    }));
};

export const fetchPublishedJournal = async (env) => {
  const rows = await restGet(
    env,
    'journal_posts?select=slug,title,seo_title,excerpt,cover_image_url,category,published_at,updated_at&status=eq.published&order=published_at.desc',
  );
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && row.slug)
    .map((row) => ({
      slug: String(row.slug),
      title: String(row.title || ''),
      seoTitle: String(row.seo_title || ''),
      excerpt: String(row.excerpt || ''),
      image: String(row.cover_image_url || ''),
      category: String(row.category || ''),
      publishedAt: row.published_at || '',
      updatedAt: row.updated_at || row.published_at || '',
    }));
};

// --- head-tag upsert ---------------------------------------------------

const abs = (siteUrl, value) => {
  const v = String(value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  const p = v.startsWith('/') ? v : `/${v}`;
  return siteUrl ? `${siteUrl}${p}` : p;
};

// Replace an existing <meta name|property="key"> content, or insert before </head>.
const upsertMeta = (html, attr, key, content) => {
  const esc = escapeHtml(content);
  const pattern = new RegExp(`<meta ${attr}="${key}"[^>]*>`, 'i');
  const tag = `<meta ${attr}="${key}" content="${esc}" />`;
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace('</head>', `\t\t${tag}\n\t</head>`);
};

/**
 * The two addresses this page lives at, each pointing at the other and at itself.
 *
 * Self-referential on purpose: a page that names only the other one is telling Google it is not the real
 * home of anything, and Google drops it. That is precisely what the ?lang=en version could never avoid —
 * one file, one canonical, and it had to be the Indonesian address.
 *
 * x-default goes to the Indonesian page: this is an Indonesian atelier, and a visitor whose language we
 * do not have should land where the whole shop is, not on the smaller half of it.
 */
export const alternateLinks = (siteUrl, route) => [
  `<link rel="alternate" hreflang="id" href="${escapeHtml(abs(siteUrl, route))}" />`,
  `<link rel="alternate" hreflang="en" href="${escapeHtml(abs(siteUrl, `${EN_PREFIX}${route}`))}" />`,
  `<link rel="alternate" hreflang="x-default" href="${escapeHtml(abs(siteUrl, route))}" />`,
].join('\n\t\t');

export const upsertAlternates = (html, tags) => {
  const stripped = html.replace(/[\t ]*<link rel="alternate"[^>]*>\n?/gi, '');
  return stripped.replace('</head>', `\t\t${tags}\n\t</head>`);
};

// index.html ships lang="id". A twin that keeps it hands a screen reader English words to pronounce with
// Indonesian phonetics, and tells Chrome to offer a translation of a page already in the reader's
// language — before any JavaScript runs, which is the only state a crawler sees.
export const setDocumentLanguage = (html, lang) => html.replace(/<html lang="[^"]*"/i, `<html lang="${lang}"`);

const upsertCanonical = (html, href) => {
  const tag = `<link rel="canonical" href="${escapeHtml(href)}" />`;
  if (/<link rel="canonical"[^>]*>/i.test(html)) {
    return html.replace(/<link rel="canonical"[^>]*>/i, tag);
  }
  return html.replace('</head>', `\t\t${tag}\n\t</head>`);
};

const injectJsonLd = (html, objects) => {
  const scripts = objects
    .filter(Boolean)
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join('\n\t\t');
  if (!scripts) return html;
  return html.replace('</head>', `\t\t${scripts}\n\t</head>`);
};

const productJsonLd = (product, siteUrl, canonical, { withOffer = true, description } = {}) => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: description || product.description,
    category: product.category,
    brand: { '@type': 'Brand', name: BRAND },
    url: canonical,
  };
  const image = abs(siteUrl, product.image);
  if (image) jsonLd.image = [image];
  if (withOffer && product.priceNumber > 0) {
    jsonLd.offers = {
      '@type': 'Offer',
      priceCurrency: 'IDR',
      price: product.priceNumber,
      availability: schemaAvailability({ stock: product.stock, variants: product.variants }),
      url: canonical,
      seller: { '@type': 'Organization', name: BRAND },
    };
  }
  return jsonLd;
};

const breadcrumbJsonLd = (crumbs, siteUrl) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: c.name,
    item: abs(siteUrl, c.path),
  })),
});

export const writeProductPages = (distRoot, baseHtml, products, siteUrl) => {
  let written = 0;
  for (const product of products) {
    const route = `/catalog/${product.slug}`;
    const alternates = alternateLinks(siteUrl, route);
    // The page renders its images through the transform; the share tag pointed at the raw object, so a
    // preview fetch pulled 600 kB-1.2 MB. 1200px is the size social scrapers actually want.
    const image = getOptimizedStorageImageUrl(abs(siteUrl, product.image), 1200);

    for (const lang of ['id', 'en']) {
      const english = lang === 'en';
      const canonical = abs(siteUrl, english ? `${EN_PREFIX}${route}` : route);
      const title = `${product.name} - ${BRAND}`;
      const description = snippet(`${product.name} — ${english ? product.descriptionEn : product.description}`);

      let html = setDocumentLanguage(baseHtml, lang);
      html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
      html = upsertMeta(html, 'name', 'description', description);
      html = upsertCanonical(html, canonical);
      html = upsertAlternates(html, alternates);
      html = upsertMeta(html, 'property', 'og:type', 'product');
      html = upsertMeta(html, 'property', 'og:site_name', BRAND);
      html = upsertMeta(html, 'property', 'og:url', canonical);
      html = upsertMeta(html, 'property', 'og:locale', english ? 'en_US' : 'id_ID');
      html = upsertMeta(html, 'property', 'og:title', title);
      html = upsertMeta(html, 'property', 'og:description', description);
      if (image) {
        html = upsertMeta(html, 'property', 'og:image', image);
        html = upsertMeta(html, 'name', 'twitter:image', image);
      }
      html = upsertMeta(html, 'name', 'twitter:card', 'summary_large_image');
      html = upsertMeta(html, 'name', 'twitter:title', title);
      html = upsertMeta(html, 'name', 'twitter:description', description);
      // Price tags on the Indonesian page only. price_number is the DOMESTIC price; the English page
      // quotes the export price, which lives in storefront_product_prices and is resolved per variant at
      // runtime — reachable from the app, not from this build. A product:price of Rp 750.000 on a page
      // showing Rp 2.630.000 would put the wrong number in a search result and in a shopping card, and
      // "no price stated" is the honest version of "I cannot reach it".
      if (!english && product.priceNumber > 0) {
        html = upsertMeta(html, 'property', 'product:price:amount', String(product.priceNumber));
        html = upsertMeta(html, 'property', 'product:price:currency', 'IDR');
      }
      html = injectJsonLd(html, [
        productJsonLd(product, siteUrl, canonical, { withOffer: !english, description }),
        breadcrumbJsonLd(english
          ? [
            { name: 'Home', path: `${EN_PREFIX}/home` },
            { name: 'Collection', path: `${EN_PREFIX}/catalog` },
            { name: product.name, path: `${EN_PREFIX}${route}` },
          ]
          : [
            { name: 'Beranda', path: '/home' },
            { name: 'Koleksi', path: '/catalog' },
            { name: product.name, path: route },
          ], siteUrl),
      ]);

      const dir = path.join(distRoot, ...(english ? [EN_PREFIX.slice(1)] : []), 'catalog', product.slug);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), html);
      written += 1;
    }
  }
  return written;
};

const articleJsonLd = (post, siteUrl, canonical) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: post.title,
  ...(post.excerpt ? { description: post.excerpt } : {}),
  ...(post.image ? { image: [abs(siteUrl, post.image)] } : {}),
  ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
  ...(post.updatedAt ? { dateModified: post.updatedAt } : {}),
  author: { '@type': 'Organization', name: BRAND },
  publisher: { '@type': 'Organization', name: BRAND },
  mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
});

// Articles were in the sitemap but had no prerendered file, so every shared /articles/<slug> link — and
// every crawler — got the SPA shell and its generic site card (audit round 8). Mirrors writeProductPages;
// Vercel resolves the filesystem before the catch-all rewrite, so no vercel.json change is needed.
export const writeJournalPages = (distRoot, baseHtml, journal, siteUrl) => {
  let written = 0;
  for (const post of journal) {
    if (!post.title) continue;
    const canonical = abs(siteUrl, `/articles/${post.slug}`);
    const title = `${post.seoTitle || post.title} - ${BRAND}`;
    const description = (post.excerpt || post.title).slice(0, 155);
    // An article with no cover used to ship no og:image at all, so sharing it previewed as bare text.
    const image = getOptimizedStorageImageUrl(abs(siteUrl, post.image || SHARE_IMAGE_PATH), 1200);

    let html = baseHtml.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
    html = upsertMeta(html, 'name', 'description', description);
    html = upsertCanonical(html, canonical);
    html = upsertMeta(html, 'property', 'og:type', 'article');
    html = upsertMeta(html, 'property', 'og:site_name', BRAND);
    html = upsertMeta(html, 'property', 'og:url', canonical);
    html = upsertMeta(html, 'property', 'og:title', title);
    html = upsertMeta(html, 'property', 'og:description', description);
    if (post.publishedAt) {
      html = upsertMeta(html, 'property', 'article:published_time', post.publishedAt);
    }
    if (image) {
      html = upsertMeta(html, 'property', 'og:image', image);
      html = upsertMeta(html, 'name', 'twitter:image', image);
    }
    // Only claim a large image card when there is actually an image to show.
    html = upsertMeta(html, 'name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    html = upsertMeta(html, 'name', 'twitter:title', title);
    html = upsertMeta(html, 'name', 'twitter:description', description);
    html = injectJsonLd(html, [
      articleJsonLd(post, siteUrl, canonical),
      breadcrumbJsonLd([
        { name: 'Beranda', path: '/home' },
        { name: 'Journal', path: '/journal' },
        { name: post.title, path: `/articles/${post.slug}` },
      ], siteUrl),
    ]);

    const dir = path.join(distRoot, 'articles', post.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    written += 1;
  }
  return written;
};

// --- sitemap + robots --------------------------------------------------

const urlEntry = (loc, lastmod, alternates = '') => {
  const mod = lastmod ? `\n    <lastmod>${escapeHtml(String(lastmod).slice(0, 10))}</lastmod>` : '';
  return `  <url>\n    <loc>${escapeHtml(loc)}</loc>${mod}${alternates}\n  </url>`;
};

// Sitemap hreflang, which Google reads as readily as the tags in the head and which is the only place a
// page can be annotated without touching its HTML. Both entries of a pair carry the SAME set, including
// a link back to themselves — a set that leaves one of them out is discarded whole.
const sitemapAlternates = (siteUrl, route) => ['id', 'en', 'x-default']
  .map((hreflang) => {
    const href = abs(siteUrl, hreflang === 'en' ? `${EN_PREFIX}${route}` : route);
    return `\n    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeHtml(href)}" />`;
  })
  .join('');

// The journal is listed once, in Indonesian, with no alternates: there is no English version of an
// article, only English chrome around the same Indonesian words.
export const writeSitemap = (distRoot, siteUrl, { products = [], journal = [] } = {}) => {
  if (!siteUrl) return 0;
  const twinned = STATIC_PUBLIC_ROUTES.filter((route) => route !== '/journal');
  const pairs = [
    ...twinned.map((route) => ({ route, lastmod: '' })),
    ...products.map((p) => ({ route: `/catalog/${p.slug}`, lastmod: p.updatedAt })),
  ];
  const entries = [
    ...pairs.flatMap(({ route, lastmod }) => {
      const alternates = sitemapAlternates(siteUrl, route);
      return [
        urlEntry(abs(siteUrl, route), lastmod, alternates),
        urlEntry(abs(siteUrl, `${EN_PREFIX}${route}`), lastmod, alternates),
      ];
    }),
    urlEntry(abs(siteUrl, '/journal')),
    ...journal.map((j) => urlEntry(abs(siteUrl, `/articles/${j.slug}`), j.updatedAt)),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(distRoot, 'sitemap.xml'), xml);
  return entries.length;
};

export const finalizeRobots = (distRoot, siteUrl) => {
  if (!siteUrl) return;
  const robotsPath = path.join(distRoot, 'robots.txt');
  if (!fs.existsSync(robotsPath)) return;
  const absolute = `Sitemap: ${siteUrl}/sitemap.xml`;
  const current = fs.readFileSync(robotsPath, 'utf8');
  const next = /^Sitemap:.*/m.test(current)
    ? current.replace(/^Sitemap:.*/m, absolute)
    : `${current.trimEnd()}\n${absolute}\n`;
  fs.writeFileSync(robotsPath, next);
};
