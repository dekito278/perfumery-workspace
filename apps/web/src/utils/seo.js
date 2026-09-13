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
