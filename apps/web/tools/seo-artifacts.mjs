// Build-time SEO artifacts: per-product prerendered HTML (baked meta + JSON-LD for
// no-JS crawlers/social scrapers) and sitemap.xml. Runs after `vite build` from
// tools/build.mjs. Never throws in a way that fails the build — SEO is best-effort.

import fs from 'node:fs';
import path from 'node:path';

const DRAFT_TAG = 'studio draft';
const BRAND = 'SOLIVAGANT';
// Canonical production origin (overridable via VITE_PUBLIC_SITE_URL / SITE_URL env).
const DEFAULT_SITE_URL = 'https://www.solivagantscent.com';

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// --- env ---------------------------------------------------------------

const loadDotEnv = (webRoot) => {
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
  // Mirrors src/utils/seo.js getSiteOrigin() exactly — one canonical origin, two places.
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
    'storefront_products?select=slug,name,category,price_number,notes,description,top_notes,heart_notes,base_notes,image_url,image_urls,tags,concentration,updated_at&order=created_at.desc',
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
      description: String(row.notes || row.description || `Objek parfum ${BRAND} oleh Dekito.`).trim(),
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
    'journal_posts?select=slug,published_at,updated_at&status=eq.published&order=published_at.desc',
  );
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && row.slug)
    .map((row) => ({ slug: String(row.slug), updatedAt: row.updated_at || row.published_at || '' }));
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

const productJsonLd = (product, siteUrl, canonical) => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    category: product.category,
    brand: { '@type': 'Brand', name: BRAND },
    url: canonical,
  };
  const image = abs(siteUrl, product.image);
  if (image) jsonLd.image = [image];
  if (product.priceNumber > 0) {
    jsonLd.offers = {
      '@type': 'Offer',
      priceCurrency: 'IDR',
      price: product.priceNumber,
      availability: 'https://schema.org/InStock',
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
    const canonical = abs(siteUrl, `/catalog/${product.slug}`);
    const title = `${product.name} - ${BRAND}`;
    const description = `${product.name} — ${product.description}`.slice(0, 155);
    const image = abs(siteUrl, product.image);

    let html = baseHtml.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
    html = upsertMeta(html, 'name', 'description', description);
    html = upsertCanonical(html, canonical);
    html = upsertMeta(html, 'property', 'og:type', 'product');
    html = upsertMeta(html, 'property', 'og:site_name', BRAND);
    html = upsertMeta(html, 'property', 'og:url', canonical);
    html = upsertMeta(html, 'property', 'og:title', title);
    html = upsertMeta(html, 'property', 'og:description', description);
    if (image) {
      html = upsertMeta(html, 'property', 'og:image', image);
      html = upsertMeta(html, 'name', 'twitter:image', image);
    }
    html = upsertMeta(html, 'name', 'twitter:card', 'summary_large_image');
    html = upsertMeta(html, 'name', 'twitter:title', title);
    html = upsertMeta(html, 'name', 'twitter:description', description);
    if (product.priceNumber > 0) {
      html = upsertMeta(html, 'property', 'product:price:amount', String(product.priceNumber));
      html = upsertMeta(html, 'property', 'product:price:currency', 'IDR');
    }
    html = injectJsonLd(html, [
      productJsonLd(product, siteUrl, canonical),
      breadcrumbJsonLd([
        { name: 'Beranda', path: '/home' },
        { name: 'Koleksi', path: '/catalog' },
        { name: product.name, path: `/catalog/${product.slug}` },
      ], siteUrl),
    ]);

    const dir = path.join(distRoot, 'catalog', product.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    written += 1;
  }
  return written;
};

// --- sitemap + robots --------------------------------------------------

const urlEntry = (loc, lastmod) => {
  const mod = lastmod ? `\n    <lastmod>${escapeHtml(String(lastmod).slice(0, 10))}</lastmod>` : '';
  return `  <url>\n    <loc>${escapeHtml(loc)}</loc>${mod}\n  </url>`;
};

export const writeSitemap = (distRoot, siteUrl, { products = [], journal = [] } = {}) => {
  if (!siteUrl) return 0;
  const staticRoutes = ['/home', '/catalog', '/journal', '/bespoke', '/materials'];
  const entries = [
    ...staticRoutes.map((r) => urlEntry(abs(siteUrl, r))),
    ...products.map((p) => urlEntry(abs(siteUrl, `/catalog/${p.slug}`), p.updatedAt)),
    ...journal.map((j) => urlEntry(abs(siteUrl, `/articles/${j.slug}`), j.updatedAt)),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
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
