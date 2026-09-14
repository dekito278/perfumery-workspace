import React from 'react';
import { AlertTriangle } from 'lucide-react';

// One notice, three screens. The desktop batch page, the mobile costing page and the mobile batches page
// all read the same formulaProfile and all present a cost built from it — so they all need to say the
// same thing when that cost is blind, and saying it in one place is the only way they stay in step.
//
// Silent when there is nothing to report: a formula whose materials are all priced renders nothing.
const FormulaCostBlindSpotNotice = ({ readiness, className = '' }) => {
  if (!readiness || readiness.isReady) {
    return null;
  }

  const share = Math.round((readiness.unpricedShare || 0) * 100);

  return (
    <div className={`rounded-2xl border border-amber-300 bg-amber-50 p-4 ${className}`.trim()} role="status">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-amber-900">
            {readiness.unpricedCount
              ? `Biaya di bawah ini belum lengkap: ${readiness.unpricedCount} bahan tanpa harga${share > 0 ? ` (${share}% dari berat formula)` : ''}.`
              : 'Formula ini belum siap dihitung biayanya.'}
          </p>
          <ul className="mt-2 space-y-1">
            {readiness.issues.map((issue) => (
              <li key={issue} className="text-xs font-semibold leading-relaxed text-amber-900">{issue}</li>
            ))}
          </ul>
          {readiness.unpricedCount ? (
            <p className="mt-2 text-xs font-semibold leading-relaxed text-amber-800">
              Bahan tanpa harga dihitung Rp 0, jadi COGS dan harga jual di halaman ini lebih rendah dari yang sebenarnya.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default FormulaCostBlindSpotNotice;
