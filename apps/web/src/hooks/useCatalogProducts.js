import { useEffect, useState } from 'react';
import {
  getCatalogProducts,
  getEditableProducts,
  getLocalCatalogProducts,
  prefetchCatalogProducts,
} from '@/services/productCatalogService.js';

export const useCatalogProducts = ({ editableOnly = false, active = true } = {}) => {
  const [products, setProducts] = useState(() => (editableOnly ? [] : getLocalCatalogProducts()));
  const [loading, setLoading] = useState(active);
  // Starts false on purpose. The first render shows this browser's stored catalogue while the fetch is
  // still in flight, and calling that stale would warn about every single page load. It becomes true
  // only once a fetch has actually failed.
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!active) {
      setLoading(false);
      return undefined;
    }

    let isMounted = true;
    const syncProducts = async ({ force = false } = {}) => {
      if (isMounted) {
        setLoading(true);
      }

      try {
        const nextProducts = editableOnly
          ? await getEditableProducts({ useLastValidFallback: false, timeoutMs: 8000 })
          : await prefetchCatalogProducts({ force });
        if (isMounted) {
          setProducts(Array.isArray(nextProducts) ? nextProducts : []);
          setStale(Boolean(nextProducts?.stale));
        }
      } catch (error) {
        console.warn('Catalog product sync failed, using local fallback:', error.message || error);
        if (isMounted) {
          setProducts(editableOnly ? [] : getCatalogProducts());
          setStale(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const refreshProducts = () => {
      syncProducts({ force: true }).catch((error) => {
        console.warn('Catalog product refresh failed:', error.message || error);
        if (isMounted) {
          setLoading(false);
        }
      });
    };

    window.addEventListener('storage', refreshProducts);
    window.addEventListener('dekito:products-updated', refreshProducts);
    syncProducts().catch((error) => {
      console.warn('Initial catalog product sync failed:', error.message || error);
    });

    return () => {
      isMounted = false;
      window.removeEventListener('storage', refreshProducts);
      window.removeEventListener('dekito:products-updated', refreshProducts);
    };
  }, [active, editableOnly]);

  Object.defineProperty(products, 'loading', {
    configurable: true,
    enumerable: false,
    value: loading,
  });
  Object.defineProperty(products, 'stale', {
    configurable: true,
    enumerable: false,
    value: stale,
  });
  return products;
};

export const useCatalogProduct = (slug) => {
  const products = useCatalogProducts();
  return products.find((product) => product.slug === slug);
};
