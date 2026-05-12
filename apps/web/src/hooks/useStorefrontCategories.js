import { useEffect, useMemo, useState } from 'react';
import {
  buildCategoryFromProductName,
  getLocalStorefrontCategories,
  prefetchStorefrontCategories,
  STOREFRONT_CATEGORY_UPDATED_EVENT,
} from '@/services/storefrontCategoryService.js';

const mergeCategories = (managedCategories, products) => {
  const categoryMap = new Map();

  (managedCategories || []).forEach((category) => {
    if (category?.name) {
      categoryMap.set(category.name.toLowerCase(), category);
    }
  });

  (products || []).forEach((product) => {
    if (!product?.category) return;
    const derivedCategory = buildCategoryFromProductName(product.category);
    if (!categoryMap.has(derivedCategory.name.toLowerCase())) {
      categoryMap.set(derivedCategory.name.toLowerCase(), derivedCategory);
    }
  });

  return [...categoryMap.values()].sort((left, right) => {
    if ((left.sortOrder ?? 100) !== (right.sortOrder ?? 100)) {
      return (left.sortOrder ?? 100) - (right.sortOrder ?? 100);
    }
    return left.name.localeCompare(right.name);
  });
};

export const useStorefrontCategories = (products = []) => {
  const [managedCategories, setManagedCategories] = useState(() => getLocalStorefrontCategories());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const syncCategories = async ({ force = false } = {}) => {
      setLoading(true);
      const nextCategories = await prefetchStorefrontCategories({ force });
      if (isMounted) {
        setManagedCategories(nextCategories);
        setLoading(false);
      }
    };
    const refreshCategories = () => syncCategories({ force: true });

    window.addEventListener('storage', refreshCategories);
    window.addEventListener(STOREFRONT_CATEGORY_UPDATED_EVENT, refreshCategories);
    window.addEventListener('dekito:products-updated', refreshCategories);
    syncCategories();

    return () => {
      isMounted = false;
      window.removeEventListener('storage', refreshCategories);
      window.removeEventListener(STOREFRONT_CATEGORY_UPDATED_EVENT, refreshCategories);
      window.removeEventListener('dekito:products-updated', refreshCategories);
    };
  }, []);

  const categories = useMemo(() => mergeCategories(managedCategories, products), [managedCategories, products]);

  Object.defineProperty(categories, 'loading', {
    configurable: true,
    enumerable: false,
    value: loading,
  });

  return categories;
};
