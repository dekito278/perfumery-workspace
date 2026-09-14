import React, { useMemo } from 'react';
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
  if (!facets.length) return null;

  return (
    <div className="wear-filter">
      <p className="wear-filter__lede">{t('catalog.wearHeading')}</p>
      {facets.map((facet) => (
        <div key={facet} className="wear-filter__row">
          <span className="wear-filter__label">{t(WEAR_FACETS[facet].labelKey)}</span>
          <div className="catalog-pills" role="list" aria-label={t('catalog.filterBy', { facet: t(WEAR_FACETS[facet].labelKey).toLowerCase() })}>
            {WEAR_FACETS[facet].options
              .filter((option) => available[facet].has(option.value))
              .map((option) => {
                const active = selection[facet] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    className={`catalog-pill ${active ? 'is-active' : ''}`}
                    onClick={() => onChange({ ...selection, [facet]: active ? '' : option.value })}
                  >
                    {t(option.labelKey)}
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default WearFilter;
