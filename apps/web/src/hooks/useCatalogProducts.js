import { useEffect, useState } from 'react';
import { getCatalogProducts, getEditableProducts } from '@/services/productCatalogService.js';

export const useCatalogProducts = ({ editableOnly = false } = {}) => {
  const readProducts = () => (editableOnly ? getEditableProducts() : getCatalogProducts());
  const [products, setProducts] = useState(readProducts);

  useEffect(() => {
    const syncProducts = () => setProducts(readProducts());
    window.addEventListener('storage', syncProducts);
    window.addEventListener('dekito:products-updated', syncProducts);
    syncProducts();

    return () => {
      window.removeEventListener('storage', syncProducts);
      window.removeEventListener('dekito:products-updated', syncProducts);
    };
  }, [editableOnly]);

  return products;
};

export const useCatalogProduct = (slug) => {
  const products = useCatalogProducts();
  return products.find((product) => product.slug === slug);
};
