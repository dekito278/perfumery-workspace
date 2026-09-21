import React from 'react';
import { Link } from 'react-router-dom';
import { GitBranch } from 'lucide-react';
import { formatGramAmount, formatQuantity } from '@/utils/formatting.js';

// What a PACE revision changed, and where it sits in the chain.
//
// Silent until there is a chain to show: a formula with no parent and no revisions renders nothing, so
// nothing changes for formulas that were never revised — which is most of them. It is also silent while
// the lineage columns are unapplied, because every parent_formula_id is null then.

// The share line is the one a perfumer reads: grams move with the batch size, share does not. A
// revision scaled forty times reported +3901% on 22 materials and said nothing about the recipe.
const DeltaRow = ({ entry, tone }) => (
  <li className="flex items-baseline justify-between gap-3 py-1">
    <span className="min-w-0 truncate text-xs font-semibold text-foreground">{entry.label}</span>
    <span className={`shrink-0 text-right font-mono text-xs font-bold ${tone}`}>
      <span className="block">
        {entry.deltaShare > 0 ? '+' : ''}{formatQuantity(entry.deltaShare, 2)} pp
        <span className="font-normal text-muted-foreground">
          {' '}({formatQuantity(entry.baseShare, 2)}% → {formatQuantity(entry.targetShare, 2)}%)
        </span>
      </span>
      <span className="block font-normal text-[11px] text-muted-foreground">
        {entry.deltaGrams > 0 ? '+' : ''}{formatQuantity(entry.deltaGrams, 3)} g
      </span>
    </span>
  </li>
);

const FormulaLineagePanel = ({ chain = [], currentId, parentFormula = null, diff = null }) => {
  if (chain.length < 2) {
    return null;
  }

  return (
    <section className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-bold">Silsilah revisi</h2>
      </div>

      <ol className="mt-4 space-y-1">
        {chain.map((entry, index) => {
          const isCurrent = String(entry.id) === String(currentId);
          return (
            <li key={entry.id} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right font-mono text-xs font-bold text-muted-foreground">{index + 1}.</span>
              {isCurrent ? (
                <span className="truncate rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {entry.name} {entry.version ? `(${entry.version})` : ''}
                </span>
              ) : (
                <Link to={`/formulas/${entry.id}`} className="truncate rounded-full px-3 py-1 text-xs font-semibold text-foreground underline-offset-2 hover:underline">
                  {entry.name} {entry.version ? `(${entry.version})` : ''}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      {parentFormula && diff ? (
        <div className="mt-5 rounded-2xl border bg-[#fbfaf7] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Perubahan dari {parentFormula.name}
          </p>
          {diff.hasChanges ? (
            <>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                Total {formatGramAmount(diff.totalBase)} to {formatGramAmount(diff.totalTarget)}
                {diff.totalDelta === 0 ? '' : ` (${diff.totalDelta > 0 ? '+' : ''}${formatQuantity(diff.totalDelta, 3)} g)`}
                {diff.scaleFactor && Math.abs(diff.scaleFactor - 1) > 0.001
                  ? ` — batch ×${formatQuantity(diff.scaleFactor, 2)}`
                  : ''}
              </p>
              {/* Said once, at the top, instead of leaving it to be inferred from 22 rows of +3900%. */}
              {diff.isPureScale ? (
                <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-foreground">
                  Cuma batch-nya yang berubah — komposisinya sama persis.
                </p>
              ) : null}
              <ul className="mt-3 divide-y">
                {diff.changed.map((entry) => (
                  <DeltaRow key={entry.key} entry={entry} tone={entry.deltaGrams > 0 ? 'text-emerald-700' : 'text-amber-700'} />
                ))}
                {diff.added.map((entry) => <DeltaRow key={entry.key} entry={entry} tone="text-emerald-700" />)}
                {diff.removed.map((entry) => <DeltaRow key={entry.key} entry={entry} tone="text-destructive" />)}
              </ul>
            </>
          ) : (
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              Komposisinya sama persis dengan induknya.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
};

export default FormulaLineagePanel;
