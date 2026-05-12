import { useEffect, useState } from 'react';
import {
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
      setLoading(true);
      const nextProducts = editableOnly
        ? await getEditableProducts({ useLastValidFallback: false, timeoutMs: 8000 })
        : await prefetchCatalogProducts({ force });
      if (isMounted) {
        setProducts(nextProducts);
        setLoading(false);
      }
    };
    const refreshProducts = () => syncProducts({ force: true });

    window.addEventListener('storage', refreshProducts);
    window.addEventListener('dekito:products-updated', refreshProducts);
    syncProducts();

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
