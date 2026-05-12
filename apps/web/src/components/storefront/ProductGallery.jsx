import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { cn } from '@/lib/utils.js';

const ProductGallery = ({ product, className = '', visualClassName = '', compact = false, priority = false }) => {
  const images = useMemo(() => {
    const rawImages = Array.isArray(product?.images) ? product.images : [];
    return [...new Set([...rawImages, product?.imageUrl].map((item) => String(item || '').trim()).filter(Boolean))];
  }, [product]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [product?.id, product?.slug]);

  useEffect(() => {
    if (activeIndex >= images.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, images.length]);

  const hasMultipleImages = images.length > 1;
  const activeImage = images[activeIndex] || '';
  const previewProduct = { ...product, imageUrl: activeImage, images: activeImage ? [activeImage] : [] };
  const goToImage = (direction) => {
    if (!hasMultipleImages) return;
    setActiveIndex((current) => (current + direction + images.length) % images.length);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative">
        <ProductVisual product={previewProduct} className={visualClassName || 'aspect-square'} priority={priority} sizes="(max-width: 767px) 100vw, 520px" />
        {hasMultipleImages ? (
          <>
            <button
              type="button"
              onClick={() => goToImage(-1)}
              className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/88 text-[#263d27] shadow-sm backdrop-blur"
              aria-label="Previous product image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => goToImage(1)}
              className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/88 text-[#263d27] shadow-sm backdrop-blur"
              aria-label="Next product image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/30 px-2 py-1 backdrop-blur">
              {images.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={cn('h-1.5 rounded-full transition-all', index === activeIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/55')}
                  aria-label={`Show product image ${index + 1}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
      {hasMultipleImages ? (
        <div className={cn('flex gap-2 overflow-x-auto pb-1', compact ? 'px-0' : '')}>
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                'h-16 w-16 shrink-0 overflow-hidden rounded-2xl border bg-white',
                index === activeIndex ? 'border-[#263d27] ring-2 ring-[#263d27]/18' : 'border-[#e5e7eb]'
              )}
              aria-label={`Select product image ${index + 1}`}
            >
              <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" width="96" height="96" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default ProductGallery;
