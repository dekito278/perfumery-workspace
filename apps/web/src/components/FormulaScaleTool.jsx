import React, { useMemo, useState } from 'react';
import { Calculator, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatGramAmount } from '@/utils/formatting.js';
import { blurNumberInputOnWheel } from '@/utils/numberInputs.js';

const parseGramValue = (value) => {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatScaledGramValue = (value) => {
  const rounded = Math.max(0, Math.round((Number(value) + Number.EPSILON) * 1000) / 1000);
  return rounded.toFixed(3).replace(/\.?0+$/, '');
};

const FormulaScaleTool = ({
  formulaItems,
  totalGrams,
  replaceFormulaItems,
}) => {
  const [targetTotal, setTargetTotal] = useState('');

  const scalableIndexes = useMemo(() => (
    formulaItems
      .map((item, index) => ({ index, grams: parseGramValue(item.gram_amount) }))
      .filter(({ grams }) => grams > 0)
      .map(({ index }) => index)
  ), [formulaItems]);

  const parsedTargetTotal = parseGramValue(targetTotal);
  const currentTotal = Number.isFinite(Number(totalGrams)) ? Number(totalGrams) : 0;
  const scaleFactor = currentTotal > 0 && parsedTargetTotal > 0
    ? parsedTargetTotal / currentTotal
    : null;

  const handleApplyScale = () => {
    if (!scalableIndexes.length || currentTotal <= 0) {
      toast.error('Isi amount formula dulu sebelum calculate total.');
      return;
    }

    if (parsedTargetTotal <= 0) {
      toast.error('Masukkan target total gram yang valid.');
      return;
    }

    let scaledRowCounter = 0;
    let scaledTotalBeforeLastRow = 0;
    const lastScalableIndex = scalableIndexes[scalableIndexes.length - 1];

    const nextItems = formulaItems.map((item, index) => {
      if (!scalableIndexes.includes(index)) {
        return item;
      }

      const currentRowGrams = parseGramValue(item.gram_amount);
      let nextGrams;

      if (index === lastScalableIndex) {
        nextGrams = Math.max(0.001, parsedTargetTotal - scaledTotalBeforeLastRow);
      } else {
        nextGrams = parseGramValue(formatScaledGramValue(currentRowGrams * scaleFactor));
        scaledTotalBeforeLastRow += nextGrams;
      }

      scaledRowCounter += 1;
      return {
        ...item,
        gram_amount: formatScaledGramValue(nextGrams),
      };
    });

    replaceFormulaItems(nextItems, { normalize: false });
    toast.success(`Formula recalculated to ${formatGramAmount(parsedTargetTotal)} across ${scaledRowCounter} rows.`);
  };

  return (
    <div className="rounded-[18px] border border-[#d9def0] bg-[linear-gradient(135deg,#f8faff_0%,#fffdf7_100%)] p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#61709a]">
            <Calculator className="h-3.5 w-3.5" />
            Calculate formula total
          </div>
          <div className="mt-1 text-sm font-semibold text-[#26314e]">
            Scale {formatGramAmount(currentTotal)} to a new target total
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Persentase formula tetap sama, hanya amount gram tiap bahan yang diubah.
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,160px)_auto] lg:w-auto">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#61709a]">
              Target total
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0.001"
                step="0.001"
                value={targetTotal}
                onChange={(event) => setTargetTotal(event.target.value)}
                onWheel={blurNumberInputOnWheel}
                placeholder="40"
                className="h-10 rounded-xl border-[#cfd8ef] bg-white text-right text-sm"
              />
              <span className="text-xs font-semibold text-[#61709a]">g</span>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleApplyScale}
            disabled={!scalableIndexes.length || currentTotal <= 0}
            className="h-10 self-end rounded-xl gap-2"
          >
            <Scale className="h-4 w-4" />
            Calculate
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <div className="rounded-full border border-[#d9def0] bg-white px-3 py-1 font-semibold text-[#26314e]">
          Current {formatGramAmount(currentTotal)}
        </div>
        <div className="rounded-full border border-[#e5dcc7] bg-white px-3 py-1 font-semibold text-[#5e5239]">
          Target {parsedTargetTotal > 0 ? formatGramAmount(parsedTargetTotal) : '-'}
        </div>
        <div className="rounded-full border border-[#dce6d1] bg-white px-3 py-1 font-semibold text-[#31451f]">
          Factor {scaleFactor ? `${scaleFactor.toFixed(3)}x` : '-'}
        </div>
      </div>
    </div>
  );
};

export default FormulaScaleTool;
