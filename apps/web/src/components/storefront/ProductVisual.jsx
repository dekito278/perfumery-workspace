import React from 'react';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils.js';

const ProductVisual = ({
  product,
  className = '',
  bottleClassName = '',
  label = true,
}) => {
  const hasImage = Boolean(product?.imageUrl);

  return (
    <div className={cn(`relative overflow-hidden rounded-2xl bg-gradient-to-br ${product?.visual || 'from-amber-100 via-white to-stone-200'}`, className)}>
      {hasImage ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <>
          <div className={cn('absolute left-6 top-6 h-32 w-16 rounded-[1.5rem] border border-white/70 bg-white/45 shadow-2xl backdrop-blur-sm', bottleClassName)}>
            <div className="mx-auto mt-3 h-4 w-8 rounded-full bg-white/70" />
            <div className="mx-auto mt-7 h-14 w-10 rounded-2xl border border-white/60 bg-white/30" />
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.65),transparent_30%)]" />
          <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-2xl bg-white/75 px-3 py-2 text-[10px] font-bold uppercase text-[#6b7280] shadow-sm backdrop-blur">
            <ImageIcon className="h-3.5 w-3.5" />
            Visual mockup
          </div>
        </>
      )}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 to-transparent" />
      {label ? (
        <div className="absolute bottom-3 right-3 rounded-2xl bg-white/86 px-3 py-2 text-right shadow-sm backdrop-blur">
          <div className="text-[10px] font-bold uppercase text-[#6b7280]">{product?.category}</div>
          <div className="text-xs font-bold text-[#1f2937]">{product?.size}</div>
        </div>
      ) : null}
    </div>
  );
};

export default ProductVisual;
