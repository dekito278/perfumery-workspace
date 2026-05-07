import { useEffect, useMemo, useState } from 'react';
import {
  buildCategoryFromProductName,
  getLocalStorefrontCategories,
  getStorefrontCategories,
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

    const syncCategories = async () => {
      setLoading(true);
      const nextCategories = await getStorefrontCategories();
      if (isMounted) {
        setManagedCategories(nextCategories);
        setLoading(false);
      }
    };

    window.addEventListener('storage', syncCategories);
    window.addEventListener(STOREFRONT_CATEGORY_UPDATED_EVENT, syncCategories);
    window.addEventListener('dekito:products-updated', syncCategories);
    syncCategories();

    return () => {
      isMounted = false;
      window.removeEventListener('storage', syncCategories);
      window.removeEventListener(STOREFRONT_CATEGORY_UPDATED_EVENT, syncCategories);
      window.removeEventListener('dekito:products-updated', syncCategories);
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
