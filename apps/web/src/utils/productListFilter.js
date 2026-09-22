import { getProductLowStock, getProductPublishStatus } from '@/services/productCatalogService.js';

/**
 * The chips above the product list, and what each one means — in one place, because there are two
 * product lists and a dashboard card that points at them.
 *
 * "Hampir habis" is the reason this file exists. The dashboard counted 8 products running low and sent
 * Dekito to a list that could not show them: its filters are publish states, and the nearest one, "Stok
 * habis", is a DIFFERENT set — stock 0, which getProductLowStock explicitly excludes. Eight products to
 * find by eye among eighteen.
 *
 * Low stock is a stock level, not a publish state, so it cannot come from getProductPublishStatus. That
 * is exactly why it had to be added rather than looked up.
 */
export const PRODUCT_LIST_FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'live', label: 'Live' },
  { key: 'draft', label: 'Draft' },
  { key: 'blocked', label: 'Belum siap' },
  { key: 'stockout', label: 'Stok habis' },
  { key: 'lowstock', label: 'Hampir habis' },
];

export const isProductListFilter = (value) => PRODUCT_LIST_FILTERS.some((filter) => filter.key === value);

export const matchesProductFilter = (product, filter = 'all') => {
  if (!product) return false;
  if (filter === 'all') return true;
  if (filter === 'lowstock') return getProductLowStock(product);
  return getProductPublishStatus(product).key === filter;
};

export const countProductsByFilter = (products = []) => Object.fromEntries(
  PRODUCT_LIST_FILTERS.map((filter) => [
    filter.key,
    (products || []).filter((product) => matchesProductFilter(product, filter.key)).length,
  ]),
);
