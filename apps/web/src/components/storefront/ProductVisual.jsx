import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils.js';

const ProductVisual = ({
  product,
  className = '',
  bottleClassName = '',
  label = true,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = String(product?.imageUrl || '').trim();
  const hasImage = Boolean(imageUrl) && !imageFailed;
  const fallbackClass = 'bg-[radial-gradient(circle_at_72%_14%,rgba(238,242,232,0.18),transparent_32%),linear-gradient(135deg,#050705_0%,#132016_52%,#263d27_100%)]';
  void bottleClassName;

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <div className={cn('relative overflow-hidden rounded-2xl', hasImage ? 'bg-[#050705]' : fallbackClass, className)}>
      {hasImage ? (
        <img
          src={imageUrl}
          alt={product.name}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <>
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <img
              src="/brand/solivagant-logo.png"
              alt={product?.name ? `${product.name} by Solivagant` : 'Solivagant'}
              className="max-h-28 w-full max-w-[72%] object-contain opacity-95"
              loading="lazy"
            />
          </div>
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
