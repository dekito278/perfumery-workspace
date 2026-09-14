import { useTranslate } from '@/hooks/useTranslate.js';
import React from 'react';

const TIERS = [
  // Top / Heart / Base stay as they are: they are the perfumery terms in both languages, and an
  // Indonesian buyer reads them here already. Only the captions around them change.
  { key: 'topNotes', label: 'Top', caption: 'pyramid.topCaption', strength: 34 },
  { key: 'heartNotes', label: 'Heart', caption: 'pyramid.heartCaption', strength: 68 },
  { key: 'baseNotes', label: 'Base', caption: 'pyramid.baseCaption', strength: 100 },
];

const toList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const ScentPyramid = ({ product, className = '' }) => {
  const { t } = useTranslate();
  const tiers = TIERS
    .map((tier) => ({ ...tier, notes: toList(product?.[tier.key]) }))
    .filter((tier) => tier.notes.length);

  if (!tiers.length) return null;

  return (
    <div className={`scent-pyramid ${className}`.trim()}>
      <p className="editorial-eyebrow">{t('pyramid.title')}</p>
      <div className="scent-pyramid__tiers">
        {tiers.map((tier) => (
          <div key={tier.key} className="scent-tier">
            <div className="scent-tier__head">
              <span className="scent-tier__label">{tier.label}</span>
              <span className="scent-tier__caption">{t(tier.caption)}</span>
              <span
                className="scent-tier__meter"
                role="img"
                aria-label={t('pyramid.strengthLabel', { tier: tier.label, percent: tier.strength })}
              >
                <span className="scent-tier__meter-fill" style={{ width: `${tier.strength}%` }} />
              </span>
            </div>
            <ul className="scent-tier__notes">
              {tier.notes.map((note) => (
                <li key={note} className="scent-note">{note}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScentPyramid;
