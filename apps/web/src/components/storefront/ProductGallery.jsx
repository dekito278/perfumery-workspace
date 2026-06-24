import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { getOptimizedProductImageUrl } from '@/services/productImageStorageService.js';
import { cn } from '@/lib/utils.js';

const ProductGallery = ({ product, className = '', visualClassName = '', compact = false, priority = false }) => {
  const images = useMemo(() => {
    const rawImages = Array.isArray(product?.images) ? product.images : [];
    return [...new Set([...rawImages, product?.imageUrl].map((item) => String(item || '').trim()).filter(Boolean))];
  }, [product]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxScale, setLightboxScale] = useState(1);
  const [lightboxPos, setLightboxPos] = useState({ x: 0, y: 0 });
  const touchRef = useRef({ startX: 0, startY: 0, lastDist: 0, dragging: false, pinching: false, startScale: 1, startPos: { x: 0, y: 0 } });
  const galleryRef = useRef(null);

  useEffect(() => { setActiveIndex(0); }, [product?.id, product?.slug]);
  useEffect(() => { if (activeIndex >= images.length) setActiveIndex(0); }, [activeIndex, images.length]);

  const hasMultipleImages = images.length > 1;
  const activeImage = images[activeIndex] || '';
  const previewProduct = { ...product, imageUrl: activeImage, images: activeImage ? [activeImage] : [] };

  const goToImage = useCallback((direction) => {
    if (!hasMultipleImages) return;
    setActiveIndex((current) => (current + direction + images.length) % images.length);
  }, [hasMultipleImages, images.length]);

  // Touch swipe for gallery
  useEffect(() => {
    const el = galleryRef.current;
    if (!el || !hasMultipleImages) return;
    let startX = 0;
    let startY = 0;
    let moved = false;
    const onStart = (e) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; moved = false; };
    const onMove = (e) => {
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) moved = true;
    };
    const onEnd = (e) => {
      if (!moved) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) goToImage(dx < 0 ? 1 : -1);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); el.removeEventListener('touchend', onEnd); };
  }, [hasMultipleImages, goToImage]);

  // Lightbox
  const openLightbox = () => { setLightboxOpen(true); setLightboxScale(1); setLightboxPos({ x: 0, y: 0 }); };
  const closeLightbox = () => { setLightboxOpen(false); setLightboxScale(1); setLightboxPos({ x: 0, y: 0 }); };

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') goToImage(-1);
      if (e.key === 'ArrowRight') goToImage(1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [lightboxOpen, goToImage]);

  // Lightbox pinch-zoom + drag
  const handleLightboxTouchStart = (e) => {
    const t = touchRef.current;
    if (e.touches.length === 2) {
      t.pinching = true;
      t.lastDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      t.startScale = lightboxScale;
    } else if (e.touches.length === 1 && lightboxScale > 1) {
      t.dragging = true;
      t.startX = e.touches[0].clientX;
      t.startY = e.touches[0].clientY;
      t.startPos = { ...lightboxPos };
    } else if (e.touches.length === 1) {
      t.startX = e.touches[0].clientX;
      t.dragging = false;
      t.pinching = false;
    }
  };

  const handleLightboxTouchMove = (e) => {
    const t = touchRef.current;
    if (t.pinching && e.touches.length === 2) {
      const dist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      const newScale = Math.max(1, Math.min(4, t.startScale * (dist / t.lastDist)));
      setLightboxScale(newScale);
      if (newScale <= 1) setLightboxPos({ x: 0, y: 0 });
    } else if (t.dragging && lightboxScale > 1) {
      const dx = e.touches[0].clientX - t.startX;
      const dy = e.touches[0].clientY - t.startY;
      setLightboxPos({ x: t.startPos.x + dx, y: t.startPos.y + dy });
    }
  };

  const handleLightboxTouchEnd = (e) => {
    const t = touchRef.current;
    if (t.pinching) { t.pinching = false; return; }
    if (t.dragging) { t.dragging = false; return; }
    if (e.changedTouches.length === 1 && lightboxScale <= 1) {
      const dx = e.changedTouches[0].clientX - t.startX;
      if (Math.abs(dx) > 50 && hasMultipleImages) {
        goToImage(dx < 0 ? 1 : -1);
        setLightboxScale(1);
        setLightboxPos({ x: 0, y: 0 });
      }
    }
  };

  const handleLightboxDoubleClick = () => {
    if (lightboxScale > 1) {
      setLightboxScale(1);
      setLightboxPos({ x: 0, y: 0 });
    } else {
      setLightboxScale(2.5);
    }
  };

  return (
    <>
      <div className={cn('space-y-3', className)}>
        <div className="group relative cursor-zoom-in" ref={galleryRef} onClick={activeImage ? openLightbox : undefined}>
          <ProductVisual product={previewProduct} className={visualClassName || 'aspect-square'} priority={priority} sizes="(max-width: 767px) 100vw, 520px" />
          {activeImage ? (
            <div className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/30 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
              <ZoomIn className="h-4 w-4" />
            </div>
          ) : null}
          {hasMultipleImages ? (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); goToImage(-1); }} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/88 text-[#1b1a16] shadow-sm backdrop-blur" aria-label="Previous product image">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); goToImage(1); }} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/88 text-[#1b1a16] shadow-sm backdrop-blur" aria-label="Next product image">
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/30 px-2 py-1 backdrop-blur">
                {images.map((image, index) => (
                  <button key={image} type="button" onClick={(e) => { e.stopPropagation(); setActiveIndex(index); }} className={cn('h-1.5 rounded-full transition-all', index === activeIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/55')} aria-label={`Show product image ${index + 1}`} />
                ))}
              </div>
            </>
          ) : null}
        </div>
        {hasMultipleImages ? (
          <div className={cn('flex gap-2 overflow-x-auto pb-1', compact ? 'px-0' : '')}>
            {images.map((image, index) => (
              <button key={image} type="button" onClick={() => setActiveIndex(index)} className={cn('h-16 w-16 shrink-0 overflow-hidden rounded-2xl border bg-white', index === activeIndex ? 'border-[#e5decf] ring-2 ring-[#1b1a16]/18' : 'border-[#e5e7eb]')} aria-label={`Select product image ${index + 1}`}>
                <img src={image} alt="" className="h-full w-full object-contain p-1" loading="lazy" decoding="async" width="96" height="96" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Zoom Lightbox */}
      {lightboxOpen ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/92" onClick={closeLightbox}>
          <button type="button" onClick={closeLightbox} className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/12 text-white backdrop-blur" aria-label="Close zoom">
            <X className="h-5 w-5" />
          </button>
          {hasMultipleImages ? (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); goToImage(-1); setLightboxScale(1); setLightboxPos({ x: 0, y: 0 }); }} className="absolute left-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/12 text-white backdrop-blur" aria-label="Previous">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); goToImage(1); setLightboxScale(1); setLightboxPos({ x: 0, y: 0 }); }} className="absolute right-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/12 text-white backdrop-blur" aria-label="Next">
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white/80 backdrop-blur">
                {activeIndex + 1} / {images.length}
              </div>
            </>
          ) : null}
          <div
            className="flex h-full w-full items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleLightboxTouchStart}
            onTouchMove={handleLightboxTouchMove}
            onTouchEnd={handleLightboxTouchEnd}
            onDoubleClick={handleLightboxDoubleClick}
          >
            <img
              src={getOptimizedProductImageUrl(activeImage, 1200) || activeImage}
              alt={product?.name || 'Product'}
              className="max-h-[85vh] max-w-[92vw] object-contain transition-transform duration-150"
              style={{ transform: `scale(${lightboxScale}) translate(${lightboxPos.x / lightboxScale}px, ${lightboxPos.y / lightboxScale}px)` }}
              draggable={false}
            />
          </div>
        </div>
      ) : null}
    </>
  );
};

export default ProductGallery;
