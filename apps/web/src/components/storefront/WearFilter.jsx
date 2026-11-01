import React, { useId, useMemo, useState } from 'react';
import { WEAR_FACETS, WEAR_KEYS, normalizeWear } from '@/utils/productWear.js';
import { useTranslate } from '@/hooks/useTranslate.js';

// "Which bottle, when." Sorting by name or price answers a question about the listing;
// this answers a question about the perfume.
//
// It renders nothing until at least one product carries the tag being offered. An empty
// filter row is worse than no filter row: it promises an answer the catalogue cannot give.
const WearFilter = ({ products, selection, onChange }) => {
  const { t } = useTranslate();
  const available = useMemo(() => {
    const seen = { occasions: new Set(), times: new Set(), weather: new Set() };
    products.forEach((product) => {
      const wear = normalizeWear(product.wear);
      WEAR_KEYS.forEach((facet) => wear[facet].forEach((value) => seen[facet].add(value)));
    });
    return seen;
  }, [products]);

  const facets = WEAR_KEYS.filter((facet) => available[facet].size > 0);
  // One facet open at a time, as Dekito's canvas draws it: "Pakai untuk" and three quiet buttons. Laid out
  // in full, the twelve options took 600px of a phone before the first perfume, and arrived with the data,
  // pushing the whole list down (CLS 0.17, measured 2026-11-02).
  const [openFacet, setOpenFacet] = useState('');
  const panelId = useId();
  if (!facets.length) return null;
  const open = facets.includes(openFacet) ? openFacet : '';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2.5">
        <p className="ng-mono m-0 text-ng-dust">{t('catalog.wearHeading')}</p>
        {facets.map((facet) => {
          const chosen = WEAR_FACETS[facet].options.find((option) => option.value === selection[facet]);
          return (
            <button
              key={facet}
              type="button"
              aria-expanded={open === facet}
              aria-controls={panelId}
              className="ng-chip ng-chip--quiet"
              onClick={() => setOpenFacet(open === facet ? '' : facet)}
            >
              {t(WEAR_FACETS[facet].labelKey)}
              {chosen ? <span className="ng-chip__count">{t(chosen.labelKey)}</span> : null}
            </button>
          );
        })}
      </div>
      {open ? (
        <div id={panelId} className="flex flex-wrap gap-2" role="list" aria-label={t('catalog.filterBy', { facet: t(WEAR_FACETS[open].labelKey).toLowerCase() })}>
          {WEAR_FACETS[open].options
            .filter((option) => available[open].has(option.value))
            .map((option) => {
              const active = selection[open] === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  className="ng-chip ng-chip--quiet ng-filter"
                  onClick={() => onChange({ ...selection, [open]: active ? '' : option.value })}
                >
                  {t(option.labelKey)}
                </button>
              );
            })}
        </div>
      ) : null}
    </div>
  );
};

export default WearFilter;
