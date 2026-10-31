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
    <div className={`flex flex-col gap-6 ${className}`.trim()}>
      <p className="ng-mono m-0 text-ng-ash">{t('pyramid.title')}</p>
      <div className="ng-pyramid">
        {tiers.map((tier) => (
          <div key={tier.key} className="ng-pyramid__tier">
            <div className="flex flex-col gap-2.5">
              <span className="ng-mono text-ng-ember">{tier.label} · {t(tier.caption)}</span>
              <span
                className="ng-pyramid__meter"
                role="img"
                aria-label={t('pyramid.strengthLabel', { tier: tier.label, percent: tier.strength })}
              >
                <span className="ng-pyramid__fill" style={{ width: `${tier.strength}%` }} />
              </span>
            </div>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {tier.notes.map((note) => (
                <li key={note} className="font-ng-display text-[26px] leading-tight md:text-[30px]">{note}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScentPyramid;
