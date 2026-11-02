import React from 'react';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';

// "Kamu mungkin suka" under a perfume, chosen by Dekito: up to four, in the order picked. Nothing picked
// leaves utils/relatedProducts.js in charge (same family first). One component for both product forms,
// because desktop and phone drifting apart is this repo's commonest defect.
export const RELATED_FRAGRANCE_LIMIT = 4;

const RelatedFragrancePicker = ({ value, onChange, products = [], productId, productSlug }) => {
  const picked = Array.isArray(value) ? value : [];
  // Only bottles a buyer can open: a draft or the gift vial picked here would be dropped on the page anyway.
  const options = products.filter((item) => (
    item?.slug && item.id !== productId && item.slug !== productSlug && isProductVisibleInStorefront(item)
  ));
  const toggle = (slug) => {
    if (picked.includes(slug)) onChange(picked.filter((item) => item !== slug));
    else if (picked.length < RELATED_FRAGRANCE_LIMIT) onChange([...picked, slug]);
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {options.map((item) => {
          const order = picked.indexOf(item.slug);
          const full = order === -1 && picked.length >= RELATED_FRAGRANCE_LIMIT;
          return (
            <button
              key={item.slug}
              type="button"
              aria-pressed={order !== -1}
              disabled={full}
              onClick={() => toggle(item.slug)}
              className={`min-h-[44px] rounded-full border px-3 text-xs font-bold transition disabled:opacity-40 ${
                order !== -1
                  ? 'border-editorial-charcoal bg-editorial-charcoal text-white'
                  : 'border-[#e5e7eb] bg-white text-[#6b7280]'
              }`}
            >
              {order !== -1 ? `${order + 1}. ` : ''}{item.name}
            </button>
          );
        })}
      </div>
      <span className="text-xs text-[#6b7280]">
        Maksimal {RELATED_FRAGRANCE_LIMIT}, tampil sesuai urutan dipilih. Kosong = dipilih otomatis (keluarga aroma yang sama dulu).
      </span>
    </div>
  );
};

export default RelatedFragrancePicker;
