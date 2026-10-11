import React from 'react';
import { Layers } from 'lucide-react';

// One notice, every screen that prints a pyramid balance — the same arrangement FormulaCostBlindSpotNotice
// has for unpriced materials, and for the same reason: the number is built from data that is partly
// missing, and a screen that shows the number without saying so is the screen that misleads.
//
// Silent when every placed material has a stated position.
const FormulaPlacementBlindSpotNotice = ({ blindSpot, className = '' }) => {
  if (!blindSpot || blindSpot.isComplete || !blindSpot.guessedCount) {
    return null;
  }

  const share = Math.round((blindSpot.guessedShare || 0) * 100);
  const names = (blindSpot.guessedNames || []).join(', ');
  const more = blindSpot.guessedCount - (blindSpot.guessedNames || []).length;

  return (
    <div className={`rounded-2xl border border-sky-300 bg-sky-50 p-4 ${className}`.trim()} role="status">
      <div className="flex items-start gap-2">
        <Layers className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-sky-900">
            {`Posisi piramida ${blindSpot.guessedCount} dari ${blindSpot.placedCount} bahan masih ditebak`}
            {share > 0 ? ` (${share}% dari bobot aroma formula).` : '.'}
          </p>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-sky-900">
            Top / Middle / Base di bawah ini — dan skor Opening, Heart, Drydown, Tenacity yang dihitung
            darinya — ikut bergantung pada tebakan itu.
          </p>
          {names ? (
            <p className="mt-2 text-xs font-semibold leading-relaxed text-sky-800">
              {`Isi kolom Pyramid placement pada: ${names}${more > 0 ? `, dan ${more} bahan lain` : ''}.`}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default FormulaPlacementBlindSpotNotice;
