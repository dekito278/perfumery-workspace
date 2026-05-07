import { useEffect, useState } from 'react';
import {
  getCatalogProductsAsync,
  getEditableProducts,
  getLocalCatalogProducts,
} from '@/services/productCatalogService.js';

export const useCatalogProducts = ({ editableOnly = false } = {}) => {
  const [products, setProducts] = useState(() => (editableOnly ? [] : getLocalCatalogProducts()));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const syncProducts = async () => {
      setLoading(true);
      const nextProducts = editableOnly ? await getEditableProducts() : await getCatalogProductsAsync();
      if (isMounted) {
        setProducts(nextProducts);
        setLoading(false);
      }
    };

    window.addEventListener('storage', syncProducts);
    window.addEventListener('dekito:products-updated', syncProducts);
    syncProducts();

    return () => {
      isMounted = false;
      window.removeEventListener('storage', syncProducts);
      window.removeEventListener('dekito:products-updated', syncProducts);
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
