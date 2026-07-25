import React from 'react';

const TIERS = [
  { key: 'topNotes', label: 'Top', caption: 'Pembuka · menguar cepat', strength: 34 },
  { key: 'heartNotes', label: 'Heart', caption: 'Inti · karakter utama', strength: 68 },
  { key: 'baseNotes', label: 'Base', caption: 'Dasar · jejak terlama', strength: 100 },
];

const toList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const ScentPyramid = ({ product, className = '' }) => {
  const tiers = TIERS
    .map((tier) => ({ ...tier, notes: toList(product?.[tier.key]) }))
    .filter((tier) => tier.notes.length);

  if (!tiers.length) return null;

  return (
    <div className={`scent-pyramid ${className}`.trim()}>
      <p className="editorial-eyebrow">PIRAMIDA AROMA</p>
      <div className="scent-pyramid__tiers">
        {tiers.map((tier) => (
          <div key={tier.key} className="scent-tier">
            <div className="scent-tier__head">
              <span className="scent-tier__label">{tier.label}</span>
              <span className="scent-tier__caption">{tier.caption}</span>
              <span
                className="scent-tier__meter"
                role="img"
                aria-label={`Ketahanan ${tier.label}: ${tier.strength} persen`}
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
