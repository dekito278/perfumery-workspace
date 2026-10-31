import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils.js';
import {
  getOptimizedProductImageUrl,
  getProductImageSrcSet,
} from '@/services/productImageStorageService.js';
import { logMobileRenderIssue } from '@/utils/mobileRenderMonitoring.js';
import { LineVessel } from '@/components/line/LineArt.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import { showsSoldOutBadge } from '@/utils/soldOutBadge.js';

// One dark ground for every product without a photo. The pastel gradients this replaced were picked per
// slug for the light storefront; on the dark one they read as six unrelated colour swatches.
const FALLBACK_GROUND = 'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(237,230,214,0.07), rgba(22,19,16,0) 70%), #161310';

const loadedProductImages = new Set();

const ProductVisual = ({
  product,
  className = '',
  bottleClassName = '',
  imageClassName = '',
  label = true,
  // Sold out is information the GRID has to carry, not only the product page. The catalogue said
  // nothing: the only "Stok habis" on a card was the quick-add pill, which is opacity 0 until the
  // pointer hovers it — and the phone grids have no pill at all. Three bottles were out of stock and
  // looked like every other card until the customer had opened one. Keeping the card listed is the
  // decision (Dekito, 17 Okt 2026); saying nothing on it was not.
  //
  // Only the PUBLIC catalogue shape carries publicStatus, so Studio rows and cart lines (which carry
  // maxStock instead) can never trip this — the badge is inert wherever the field is absent.
  soldOut = true,
  priority = false,
  sizes = '(max-width: 767px) 46vw, 320px',
  imageFit = 'contain',
}) => {
  const { t } = useTranslate();
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageUrl = String(product?.images?.[0] || product?.imageUrl || '').trim();
  const optimizedImageUrl = getOptimizedProductImageUrl(imageUrl, priority ? 720 : 520);
  const imageSrcSet = getProductImageSrcSet(imageUrl);
  const hasImage = Boolean(imageUrl) && !imageFailed;
  const showSoldOut = showsSoldOutBadge(product, soldOut);
  void bottleClassName;

  useEffect(() => {
    setImageFailed(false);
    setImageLoaded(Boolean(imageUrl && loadedProductImages.has(imageUrl)));
  }, [imageUrl]);

  return (
    <div
      className={cn('relative overflow-hidden border border-ng-bone/10', className)}
      style={{ background: FALLBACK_GROUND }}
    >
      {/* Placeholder while a photo loads, and the whole picture for a product that has none yet. The
          drawn vessel says "bottle" where the wordmark only said "brand" — and the wordmark already
          sits in the header on every one of these pages. */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <LineVessel
          className={cn(
            'h-full w-auto max-w-[62%] text-ng-bone transition-opacity duration-200',
            hasImage && imageLoaded ? 'opacity-0' : 'opacity-20',
          )}
        />
      </div>
      {hasImage && !imageLoaded ? (
        <div className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,rgba(237,230,214,0.02),rgba(237,230,214,0.08),rgba(237,230,214,0.02))]" />
      ) : null}
      {hasImage ? (
        <img
          src={optimizedImageUrl}
          alt={product?.name ? `${product.name}${product.category ? ` — ${product.category}` : ''}` : 'Solivagant fragrance'}
          className={cn(
            'absolute inset-0 h-full w-full transition-opacity duration-150',
            imageFit === 'cover' ? 'object-cover p-0' : 'object-contain p-3 sm:p-4',
            imageLoaded ? 'opacity-100' : 'opacity-0',
            imageClassName
          )}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          srcSet={imageSrcSet}
          sizes={sizes}
          width="640"
          height="640"
          referrerPolicy="no-referrer"
          onLoad={() => {
            loadedProductImages.add(imageUrl);
            setImageLoaded(true);
          }}
          onError={() => {
            logMobileRenderIssue('image-load-failed', {
              source: 'product-visual',
              productId: product?.id,
              productName: product?.name,
              imageUrl,
            }, {
              throttleKey: `image-load-failed:${imageUrl}`,
            });
            setImageFailed(true);
          }}
        />
      ) : (
        <div className="absolute bottom-4 left-4 font-ng-mono text-[10px] uppercase tracking-[0.2em] text-ng-ash">
          Solivagant
        </div>
      )}
      {label && product ? (
        <div className="absolute bottom-3 right-3 bg-ng-ink/80 px-3 py-2 text-right font-ng-mono text-[10px] uppercase tracking-[0.16em] text-ng-bone">
          <div className="text-ng-dust">{product?.category}</div>
          <div>{product?.size}</div>
        </div>
      ) : null}
      {/* A span, not a div: both card stylesheets carry `.<card>__visual > div { width: 100%; height: 100% }`
          for the image layers, and a div here was stretched by it to cover the whole photo. */}
      {showSoldOut ? (
        <span className="absolute left-3 top-3 bg-ng-ink/90 px-2.5 py-1 font-ng-mono text-[10px] uppercase tracking-[0.16em] text-ng-bone">
          {t('catalog.soldOutShort')}
        </span>
      ) : null}
    </div>
  );
};

export default ProductVisual;
