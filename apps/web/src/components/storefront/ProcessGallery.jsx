import React from 'react';
import { useTranslate } from '@/hooks/useTranslate.js';
import { getOptimizedStorageImageUrl } from '@/utils/storageImage.js';
import { normalizeProcessImages } from '@/utils/processImages.js';

/**
 * Up to four of Dekito's own photos of the work — weighing, blending, packing (brief P2-6, "parfum
 * karya"). Renders nothing until Studio holds at least one: an empty frame promising a process is worse
 * than no frame. Square tiles, two across on a phone and four on a wide screen.
 */
const ProcessGallery = ({ images = [], subject = '', headingKey = 'pdp.processHeading', className = '' }) => {
  const { t } = useTranslate();
  const list = normalizeProcessImages(images);
  if (!list.length) return null;

  return (
    <section className={`ng-section ${className}`.trim()} aria-labelledby="process-gallery-heading">
      <div className="ng-container flex flex-col gap-6">
        <h2 id="process-gallery-heading" className="ng-display m-0 text-[34px] md:text-[44px]">{t(headingKey)}</h2>
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4">
          {list.map((src, index) => (
            <li key={src} className="aspect-square overflow-hidden border border-ng-bone/12 bg-ng-card">
              <img
                src={getOptimizedStorageImageUrl(src, 640)}
                alt={t('pdp.processAlt', { subject, n: index + 1, total: list.length })}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default ProcessGallery;
