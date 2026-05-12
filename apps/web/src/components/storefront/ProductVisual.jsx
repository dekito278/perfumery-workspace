import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils.js';

const fallbackGradients = [
  'linear-gradient(135deg,#f5d78f 0%,#f8efe1 52%,#d7b98b 100%)',
  'linear-gradient(135deg,#f0b6c2 0%,#fff2f4 52%,#b97f88 100%)',
  'linear-gradient(135deg,#a7d8d3 0%,#effaf8 52%,#efd37c 100%)',
  'linear-gradient(135deg,#e6bd82 0%,#fff4df 52%,#b8885b 100%)',
  'linear-gradient(135deg,#bad7b6 0%,#f6fbf0 52%,#d8c89b 100%)',
  'linear-gradient(135deg,#9fb8b3 0%,#eef5f2 52%,#8e806d 100%)',
];

const getFallbackGradient = (product) => {
  const value = String(product?.slug || product?.name || product?.category || 'solivagant');
  const index = Math.abs(value.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0)) % fallbackGradients.length;
  return fallbackGradients[index];
};

const ProductVisual = ({
  product,
  className = '',
  bottleClassName = '',
  label = true,
  priority = false,
  sizes = '(max-width: 767px) 46vw, 320px',
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageUrl = String(product?.images?.[0] || product?.imageUrl || '').trim();
  const hasImage = Boolean(imageUrl) && !imageFailed;
  void bottleClassName;

  useEffect(() => {
    setImageFailed(false);
    setImageLoaded(false);
  }, [imageUrl]);

  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl bg-[#050705]', className)}
      style={{ background: getFallbackGradient(product) }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_14%,rgba(255,255,255,0.34),transparent_34%),linear-gradient(180deg,rgba(5,7,5,0.02),rgba(5,7,5,0.36))]" />
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <img
          src="/brand/solivagant-logo.png"
          alt={product?.name ? `${product.name} by Solivagant` : 'Solivagant'}
          className={cn('max-h-28 w-full max-w-[72%] object-contain transition-opacity duration-300', hasImage && imageLoaded ? 'opacity-0' : 'opacity-95')}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          width="320"
          height="128"
        />
      </div>
      {hasImage && !imageLoaded ? (
        <div className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,rgba(255,255,255,0.05),rgba(255,255,255,0.24),rgba(255,255,255,0.05))]" />
      ) : null}
      {hasImage ? (
        <img
          src={imageUrl}
          alt={product?.name || 'Solivagant product'}
          className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-300', imageLoaded ? 'opacity-100' : 'opacity-0')}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'low'}
          sizes={sizes}
          width="640"
          height="640"
          referrerPolicy="no-referrer"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(238,242,232,0.12),transparent_38%)]" />
          <div className="absolute bottom-4 left-4 rounded-2xl bg-white/10 px-3 py-2 text-[10px] font-bold uppercase text-[#eef2e8] shadow-sm backdrop-blur">
            Solivagant
          </div>
        </>
      )}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
      {label && product ? (
        <div className="absolute bottom-3 right-3 rounded-2xl bg-white/12 px-3 py-2 text-right text-[#eef2e8] shadow-sm backdrop-blur">
          <div className="text-[10px] font-bold uppercase text-[#b7c6b1]">{product?.category}</div>
          <div className="text-xs font-bold">{product?.size}</div>
        </div>
      ) : null}
    </div>
  );
};

export default ProductVisual;
