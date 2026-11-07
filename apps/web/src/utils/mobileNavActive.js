// Which phone Studio tab is "you are here". Import-free so the guard runs it.
//
// "Starts with" was the rule, and '/mobile/studio' — the Studio dashboard — is the start of every
// E-commerce screen too (/mobile/studio/products, /orders, /export-shipping...), so both tabs lit up on
// every E-commerce page. And the Studio list had never been told about the material detail and audit
// screens, the material categories or production costing, so on those no tab was lit at all. Measured on
// the phone layout, 2026-11-08. The most specific match wins now, and every Studio route has a home.
export const MOBILE_NAV_GROUP_PATHS = {
  commerce: [
    '/mobile/studio/products', '/mobile/studio/product-categories', '/mobile/studio/orders', '/mobile/studio/fulfillment',
    '/mobile/studio/customers', '/mobile/studio/bespoke', '/mobile/studio/vouchers', '/mobile/studio/shipping',
    '/mobile/studio/export-shipping',
  ],
  studio: [
    '/mobile/studio', '/mobile/journal', '/mobile/formulas', '/mobile/batches', '/mobile/production-costing',
    '/mobile/raw-materials', '/mobile/raw-material', '/mobile/raw-material-audit', '/mobile/materials', '/mobile/categories',
    '/mobile/validation', '/mobile/validate', '/mobile/studio/site-images', '/mobile/studio/site-facts',
  ],
};

const matchLength = (pathname, path) => (pathname === path || pathname.startsWith(`${path}/`) ? path.length : 0);

/** The path in `paths` that names `pathname` most specifically, or '' when none does. */
export const mostSpecificPath = (pathname, paths = []) => paths.reduce(
  (best, path) => (matchLength(pathname, path) > best.length ? path : best),
  '',
);

/** The id of the one group whose paths name `pathname` most specifically, or null. */
export const activeNavGroup = (pathname, groups = MOBILE_NAV_GROUP_PATHS) => {
  let winner = null;
  let length = 0;
  for (const [id, paths] of Object.entries(groups)) {
    const best = mostSpecificPath(pathname, paths).length;
    if (best > length) { winner = id; length = best; }
  }
  return winner;
};
