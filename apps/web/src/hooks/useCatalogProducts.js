import { useEffect, useState } from 'react';
import {
  getCatalogProducts,
  getEditableProducts,
  getLocalCatalogProducts,
  prefetchCatalogProducts,
} from '@/services/productCatalogService.js';

export const useCatalogProducts = ({ editableOnly = false } = {}) => {
  const [products, setProducts] = useState(() => (editableOnly ? [] : getLocalCatalogProducts()));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        }
      } catch (error) {
        console.warn('Catalog product sync failed, using local fallback:', error.message || error);
        if (isMounted) {
          setProducts(editableOnly ? [] : getCatalogProducts());
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
  }, [editableOnly]);

  Object.defineProperty(products, 'loading', {
    configurable: true,
    enumerable: false,
    value: loading,
  });
  return products;
};

export const useCatalogProduct = (slug) => {
  const products = useCatalogProducts();
  return products.find((product) => product.slug === slug);
};
