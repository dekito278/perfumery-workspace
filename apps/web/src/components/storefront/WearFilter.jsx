import React, { useMemo } from 'react';
import { WEAR_FACETS, WEAR_KEYS, normalizeWear } from '@/utils/productWear.js';

// "Which bottle, when." Sorting by name or price answers a question about the listing;
// this answers a question about the perfume.
//
// It renders nothing until at least one product carries the tag being offered. An empty
// filter row is worse than no filter row: it promises an answer the catalogue cannot give.
const WearFilter = ({ products, selection, onChange }) => {
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
      <p className="wear-filter__lede">Pakai untuk momen apa?</p>
      {facets.map((facet) => (
        <div key={facet} className="wear-filter__row">
          <span className="wear-filter__label">{WEAR_FACETS[facet].label}</span>
          <div className="catalog-pills" role="list" aria-label={`Filter berdasarkan ${WEAR_FACETS[facet].label.toLowerCase()}`}>
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
                    {option.label}
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
