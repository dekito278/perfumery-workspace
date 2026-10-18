import { schemaAvailability } from './schemaAvailability.js';
// Shared SEO helpers: canonical URLs + JSON-LD structured data builders.

export const SITE_NAME = 'SOLIVAGANT';
export const SITE_TAGLINE = 'Atelier Parfum Artisan oleh Dekito';
export const BRAND_LOGO_PATH = '/brand/solivagant-logo.png';
// One share image for the whole site. There used to be two — seo.js pointed at the raw-material photo
// while the journal page had its own — so a link preview looked different depending on what was shared.
export const DEFAULT_SHARE_IMAGE = '/brand/home/perfumer-at-work.jpg';
// Canonical production origin. Overridable via env, but defaults to the live domain
// so canonical/OG URLs always point at production — even when viewed on a Vercel
// preview URL or localhost (both of which should not be the canonical target).
export const DEFAULT_SITE_URL = 'https://www.solivagantscent.com';

export const getSiteOrigin = () => {
  const configured = String(
    import.meta.env.VITE_PUBLIC_SITE_URL || import.meta.env.VITE_SITE_URL || ''
  ).trim();
  return (configured || DEFAULT_SITE_URL).replace(/\/+$/, '');
};

export const toAbsoluteUrl = (value, origin = getSiteOrigin()) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const path = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return origin ? `${origin}${path}` : path;
};

/**
 * The canonical for the shop the visitor is ACTUALLY in.
 *
 * Every runtime canonical was built as toAbsoluteUrl('/catalog') — the Indonesian path, on both shops.
 * So /en/catalog told a crawler its canonical home was /catalog: the English shop asking to be dropped
 * in favour of the Indonesian one. The prerendered /en/*\/index.html files carry the right canonical,
 * which is why this never showed up in the built output; it is the tag React writes afterwards that is
 * wrong, and Google runs the JavaScript.
 *
 * The journal is the one page that SHOULD canonical across shops: journal_posts has no English columns,
 * so /en/journal would be a second address for the same Indonesian articles, and robots.txt keeps
 * crawlers off it. Those pages pass region 'id' on purpose.
 */
export const shopCanonicalUrl = (path, region, origin = getSiteOrigin()) => {
  const bare = String(path || '').trim();
  if (!bare) return '';
  const prefix = region === 'en' ? '/en' : '';
  return toAbsoluteUrl(`${prefix}${bare.startsWith('/') ? bare : `/${bare}`}`, origin);
};

// The mobile storefront is a SECOND set of URLs for the same shop. RootRedirect sends every phone to
// /mobile/dashboard, and Google crawls mobile-first — so the crawler lands on the duplicate, not on the
// prerendered page the sitemap advertises. Measured on the live site: /mobile/dashboard, /mobile/catalog
// and /mobile/products/<slug> carried no canonical and no robots meta at all.
//
// One mapping, here, so a page cannot declare a canonical the routes do not have.
const MOBILE_TO_DESKTOP = {
  '/mobile/dashboard': '/home',
  '/mobile/home': '/home',
  '/mobile/catalog': '/catalog',
  '/mobile/bespoke': '/bespoke',
  '/mobile/articles': '/journal',
};

/** The desktop URL a mobile storefront page is a copy of, or '' when there is no twin. */
export const desktopCanonicalPath = (mobilePath) => {
  const path = String(mobilePath || '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (MOBILE_TO_DESKTOP[path]) return MOBILE_TO_DESKTOP[path];

  const product = path.match(/^\/mobile\/products\/([^/]+)$/);
  if (product) return `/catalog/${product[1]}`;

  const article = path.match(/^\/mobile\/articles\/([^/]+)$/);
  if (article) return `/articles/${article[1]}`;

  return '';
};

// Shared with the build-time prerender so the two cannot drift again.
const availabilityUrl = (product) => schemaAvailability({
  status: product?.availability || product?.publicStatus || '',
  stock: product?.stock,
  variants: product?.variants,
});

export const buildOrganizationJsonLd = (origin = getSiteOrigin()) => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  description: SITE_TAGLINE,
  url: origin || undefined,
  logo: toAbsoluteUrl(BRAND_LOGO_PATH, origin),
  founder: { '@type': 'Person', name: 'Dekito' },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    telephone: '+6287774026625',
    availableLanguage: ['id', 'en'],
  },
});

export const buildWebSiteJsonLd = (origin = getSiteOrigin()) => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: origin || undefined,
  inLanguage: 'id-ID',
  potentialAction: {
    '@type': 'SearchAction',
    target: `${origin}/catalog?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
});

export const buildBreadcrumbJsonLd = (crumbs = [], origin = getSiteOrigin()) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((crumb, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: crumb.name,
    item: crumb.path ? toAbsoluteUrl(crumb.path, origin) : undefined,
  })),
});

export const buildProductJsonLd = (product, { origin = getSiteOrigin(), canonicalUrl } = {}) => {
  if (!product) return null;
  const image = toAbsoluteUrl(product.imageUrl || product.images?.[0] || DEFAULT_SHARE_IMAGE, origin);
  const url = canonicalUrl || toAbsoluteUrl(`/catalog/${product.slug}`, origin);
  const priceNumber = Number(product.priceNumber || 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || product.story || product.subtitle,
    image: image ? [image] : undefined,
    category: product.category || product.publicCategory || undefined,
    brand: { '@type': 'Brand', name: SITE_NAME },
    url,
  };

  if (priceNumber > 0) {
    jsonLd.offers = {
      '@type': 'Offer',
      priceCurrency: 'IDR',
      price: priceNumber,
      availability: availabilityUrl(product),
      url,
      seller: { '@type': 'Organization', name: SITE_NAME },
    };
  }

  return jsonLd;
};
