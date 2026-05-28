import React from 'react';
import { AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import IngredientSelect from '@/components/IngredientSelect.jsx';
import { formatPercentage, formatQuantity } from '@/utils/formatting.js';
import { blurNumberInputOnWheel } from '@/utils/numberInputs.js';

const FormulaItemTableEditor = ({
  items,
  rawMaterials,
  focusRowIndex,
  activeRowIndex,
  onAutoFocusHandled,
  onActivateRow,
  onItemChange,
  onGramAmountChange,
  onDilutionChange,
  onRemove,
  validationErrors,
  getGuidanceStatus,
  onOpenGuidanceEditor,
  activeItemInsight,
  onCreateMissingMaterial,
  needsGuidanceMaterialId,
}) => {
  const solventOptions = rawMaterials.filter((material) => material.type === 'solvent');
  const ingredientOptions = rawMaterials.map((material) => ({
    ...material,
    type: material.type === 'solvent' ? 'solvent' : 'raw_material',
  }));
  const isFilledRow = (item) => Boolean(item.item_id || item.gram_amount || item.dilution_percent || item.dilution_solvent_id);
  const formatImpactValue = (value) => (
    value === null || value === undefined || Number.isNaN(Number(value))
      ? '-'
      : formatQuantity(value, 1)
  );
  const formatLifeValue = (value) => (
    value === null || value === undefined || Number.isNaN(Number(value))
      ? '-'
      : `${formatQuantity(value, 1)} h`
  );
  const activeInsightSourceLabel = activeItemInsight?.guidanceSourceLabel
    ? `${activeItemInsight.guidanceSourceLabel} guidance${activeItemInsight.referenceCode ? ` - ${activeItemInsight.referenceCode}` : ''}`
    : activeItemInsight?.guidanceSource === 'linked_profile'
      ? `Reference guidance${activeItemInsight.referenceCode ? ` - ${activeItemInsight.referenceCode}` : ''}`
      : activeItemInsight?.guidanceSource === 'raw_material_fallback'
        ? 'Manual guidance from raw material'
        : 'Guidance missing';
  const hasActualizedDilutionInsight = Boolean(
    activeItemInsight?.dilutionFactor !== null
    && activeItemInsight?.dilutionFactor !== undefined
    && Number(activeItemInsight.dilutionFactor) > 0
    && Number(activeItemInsight.dilutionFactor) < 1
  );
  const impactCardLabel = hasActualizedDilutionInsight ? 'Actual blend impact' : 'Material impact';
  const lifeCardLabel = hasActualizedDilutionInsight ? 'Actual blend life' : 'Material life';
  const solventBehaviourLabel = activeItemInsight?.dilutionSolventBehaviour
    ? String(activeItemInsight.dilutionSolventBehaviour).toUpperCase()
    : null;

  return (
    <div className="overflow-visible rounded-[18px] border border-[#d7cfbf] bg-white shadow-sm">
      {activeItemInsight ? (
        <div className="border-b border-[#e5dcc7] bg-[linear-gradient(180deg,#fffaf0_0%,#fffdf8_100%)] px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7b6d4f]">
                Selected material insight
              </div>
              <div className="mt-1 text-sm font-semibold text-[#433821]">
                {activeItemInsight.name}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {activeInsightSourceLabel}
              </div>
              {hasActualizedDilutionInsight ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  Diluted with {activeItemInsight.dilutionSolventName || 'carrier'}{solventBehaviourLabel ? ` (${solventBehaviourLabel})` : ''} so impact/life use the calibrated blend profile.
                </div>
              ) : null}
            </div>
            {activeItemInsight.effectivePercentage !== null && activeItemInsight.effectivePercentage !== undefined ? (
              <div className="w-fit rounded-full border border-[#d9cfbb] bg-white px-3 py-1 text-[11px] font-semibold text-[#5e5239]">
                Formula share {formatPercentage(activeItemInsight.effectivePercentage, 2)}
              </div>
            ) : null}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-[#e5dcc7] bg-white px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b7650]">{impactCardLabel}</div>
              <div className="mt-1 text-sm font-semibold text-[#443822]">{formatImpactValue(activeItemInsight.impact)}</div>
              {hasActualizedDilutionInsight ? (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Base {formatImpactValue(activeItemInsight.baseImpact)} • Pre-cal {formatImpactValue(activeItemInsight.blendedImpact)}
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-[#d9def0] bg-white px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#61709a]">{lifeCardLabel}</div>
              <div className="mt-1 text-sm font-semibold text-[#26314e]">{formatLifeValue(activeItemInsight.lifeHours)}</div>
              {hasActualizedDilutionInsight ? (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Base {formatLifeValue(activeItemInsight.baseLifeHours)} • Pre-cal {formatLifeValue(activeItemInsight.blendedLifeHours)}
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-[#dce6d1] bg-white px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6f8454]">Impact in formula</div>
              <div className="mt-1 text-sm font-semibold text-[#31451f]">{formatImpactValue(activeItemInsight.impactContribution)}</div>
            </div>
            <div className="rounded-2xl border border-[#ead7cf] bg-white px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a6d5d]">Life in formula</div>
              <div className="mt-1 text-sm font-semibold text-[#4e2c26]">{formatLifeValue(activeItemInsight.lifeContribution)}</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="sticky top-0 z-20 shrink-0 border-b border-[#ddd3bf] bg-[#f3ecdd] px-4 py-2.5 max-md:hidden">
        <div className="grid grid-cols-[38px_minmax(0,2.7fr)_96px_92px_minmax(0,1.5fr)_44px] gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
          <span>No.</span>
          <span>Raw material</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Dil. %</span>
          <span>Solvent</span>
          <span className="text-right">Del</span>
        </div>
      </div>

      <div className="overflow-visible">
        <div className="space-y-3 p-3 md:hidden">
          {items.map((item, index) => {
            const rowNumber = index + 1;
            const composerRow = index === 0 && !isFilledRow(item);
            const disableRemove = items.length === 1 && composerRow;
            const guidanceStatus = getGuidanceStatus?.(item);
            const showGuidanceEditor = Boolean(item.item_id);
            const hasGuidanceWarning = Boolean(guidanceStatus?.hasWarning);
            const showNeedsGuidanceNudge = Boolean(item.item_id && item.item_id === needsGuidanceMaterialId && hasGuidanceWarning);

            return (
              <div
                key={item.row_key || `${item.item_id || 'empty'}-${index}`}
                onClick={() => onActivateRow?.(index)}
                aria-selected={index === activeRowIndex}
                className={`overflow-visible rounded-2xl border px-3 py-3 shadow-sm transition-colors ${
                  composerRow
                    ? 'border-[#dfbf7d] bg-[linear-gradient(180deg,#fff8ea_0%,#fffdf7_100%)]'
                    : index === activeRowIndex
                    ? 'border-[#dfbf7d] bg-[#fff7e8]'
                    : index === 0
                      ? 'border-[#eadfc8] bg-[#fffaf1]'
                      : 'border-[#ece4d3] bg-white'
                } cursor-pointer`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-full border border-[#ded1b2] bg-[#f6eedc] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f603d]">
                      {composerRow ? 'Composer row' : `Row ${rowNumber}`}
                    </div>
                    {index === activeRowIndex ? (
                      <div className="rounded-full border border-[#d7e1cd] bg-[#f3f8ee] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4f6537]">
                        Active
                      </div>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(index)}
                    disabled={disableRemove}
                    className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                    title="Remove row"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="space-y-3">
                  {composerRow ? (
                    <div className="rounded-xl border border-dashed border-[#dcc89a] bg-[#fff8e8] px-3 py-2 text-[11px] text-[#6f603d]">
                      Pilih bahan dari library lalu isi amount untuk mengunci row ini sebagai bahan aktif berikutnya.
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
                        Raw material
                      </div>
                      {showGuidanceEditor ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenGuidanceEditor?.(item)}
                          className={`h-7 rounded-full px-2 text-[10px] ${
                            hasGuidanceWarning
                              ? 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                          }`}
                        >
                          {hasGuidanceWarning ? (
                            <AlertTriangle className="mr-1 h-3.5 w-3.5 text-amber-700" />
                          ) : (
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-700" />
                          )}
                          {hasGuidanceWarning ? 'Fill workbook data' : 'Edit workbook data'}
                        </Button>
                      ) : null}
                    </div>
                    <IngredientSelect
                      value={item.item_id}
                      onChange={(ingredientId) => onItemChange(index, ingredientId)}
                      placeholder="Type material name"
                      ingredients={ingredientOptions}
                      autoFocus={focusRowIndex === index}
                      onAutoFocusHandled={onAutoFocusHandled}
                      compact
                      onActivate={() => onActivateRow?.(index)}
                      onCreateMissing={(name) => onCreateMissingMaterial?.({ name, rowIndex: index })}
                    />
                    {validationErrors[`item_${index}`] ? (
                      <div className="mt-1.5 text-[11px] text-destructive">{validationErrors[`item_${index}`]}</div>
                    ) : null}
                    {showNeedsGuidanceNudge ? (
                      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
                        <div className="flex items-center justify-between gap-2">
                          <span>Needs guidance: CAS, impact, life, atau workbook belum lengkap.</span>
                          <button
                            type="button"
                            onClick={() => onOpenGuidanceEditor?.(item)}
                            className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-amber-800 shadow-sm"
                          >
                            Lengkapi guidance
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
                        Amount
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          step="0.001"
                          min="0.001"
                          max="999999"
                          value={item.gram_amount || ''}
                          onChange={(event) => onGramAmountChange(index, event.target.value)}
                          onWheel={blurNumberInputOnWheel}
                          onFocus={() => onActivateRow?.(index)}
                          placeholder="0.000"
                          className="h-9 w-full rounded-xl border-[#d8cfbf] px-3 text-right text-sm"
                        />
                        <span className="shrink-0 text-[11px] text-muted-foreground">g</span>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
                        Dil. %
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={item.dilution_percent || ''}
                        onChange={(event) => onDilutionChange(index, 'dilution_percent', event.target.value)}
                        onWheel={blurNumberInputOnWheel}
                        onFocus={() => onActivateRow?.(index)}
                        placeholder="-"
                        className="h-9 w-full rounded-xl border-[#d8cfbf] px-3 text-right text-sm"
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
                      Solvent
                    </div>
                    <Select
                      value={item.dilution_solvent_id || '__none__'}
                      onValueChange={(value) => onDilutionChange(index, 'dilution_solvent_id', value === '__none__' ? '' : value)}
                    >
                      <SelectTrigger className="h-9 w-full min-w-0 rounded-xl border-[#d8cfbf] px-3 text-sm" onClick={() => onActivateRow?.(index)}>
                        <SelectValue placeholder="No solvent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No solvent</SelectItem>
                        {solventOptions.map((solvent) => (
                          <SelectItem key={solvent.id} value={solvent.id}>
                            {solvent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}

          {items.length === 0 ? (
            <div className="rounded-xl bg-white px-4 py-8 text-sm text-muted-foreground">
              No rows yet.
            </div>
          ) : null}
        </div>

        <div className="max-md:hidden">
          {items.map((item, index) => {
            const rowNumber = index + 1;
            const composerRow = index === 0 && !isFilledRow(item);
            const disableRemove = items.length === 1 && composerRow;
            const guidanceStatus = getGuidanceStatus?.(item);
            const showGuidanceEditor = Boolean(item.item_id);
            const hasGuidanceWarning = Boolean(guidanceStatus?.hasWarning);
            const showNeedsGuidanceNudge = Boolean(item.item_id && item.item_id === needsGuidanceMaterialId && hasGuidanceWarning);

            return (
              <div
                key={item.row_key || `${item.item_id || 'empty'}-${index}`}
                onClick={() => onActivateRow?.(index)}
                aria-selected={index === activeRowIndex}
                className={`grid grid-cols-[38px_minmax(0,2.7fr)_96px_92px_minmax(0,1.5fr)_44px] items-center gap-2 border-b border-[#ece4d3] px-4 py-2 transition-colors ${
                  composerRow
                    ? 'bg-[linear-gradient(90deg,#fff7e6_0%,#fffdf8_100%)]'
                    : index === activeRowIndex
                    ? 'bg-[#fff6e6]'
                    : index === 0
                      ? 'bg-[#fffaf0]'
                      : 'bg-white'
                } cursor-pointer`}
              >
                <div className="text-xs font-semibold tabular-nums text-[#5e5239]">
                  {composerRow ? 'New' : rowNumber}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <IngredientSelect
                        value={item.item_id}
                        onChange={(ingredientId) => onItemChange(index, ingredientId)}
                        placeholder="Type material name"
                        ingredients={ingredientOptions}
                        autoFocus={focusRowIndex === index}
                        onAutoFocusHandled={onAutoFocusHandled}
                        compact
                        onActivate={() => onActivateRow?.(index)}
                        onCreateMissing={(name) => onCreateMissingMaterial?.({ name, rowIndex: index })}
                      />
                    </div>
                    {showGuidanceEditor ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => onOpenGuidanceEditor?.(item)}
                        className={`h-8 w-8 shrink-0 rounded-md ${
                          hasGuidanceWarning
                            ? 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                        }`}
                        title={hasGuidanceWarning ? 'Complete workbook guidance' : 'Edit workbook guidance'}
                        aria-label={`${hasGuidanceWarning ? 'Complete' : 'Edit'} workbook guidance for ${item.item_id}`}
                      >
                        {hasGuidanceWarning ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                        )}
                      </Button>
                    ) : null}
                  </div>
                  {validationErrors[`item_${index}`] ? (
                    <div className="mt-1 truncate text-[10px] text-destructive">{validationErrors[`item_${index}`]}</div>
                  ) : null}
                  {showNeedsGuidanceNudge ? (
                    <button
                      type="button"
                      onClick={() => onOpenGuidanceEditor?.(item)}
                      className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-100"
                      title="Lengkapi guidance tanpa keluar dari formula"
                    >
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span className="truncate">Needs guidance · Lengkapi guidance</span>
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    max="999999"
                    value={item.gram_amount || ''}
                    onChange={(event) => onGramAmountChange(index, event.target.value)}
                    onWheel={blurNumberInputOnWheel}
                    onFocus={() => onActivateRow?.(index)}
                    placeholder="0.000"
                    className="h-8 rounded-md border-[#d8cfbf] px-2 text-right text-sm"
                  />
                  <span className="shrink-0 text-[10px] text-muted-foreground">g</span>
                </div>

                <div>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={item.dilution_percent || ''}
                    onChange={(event) => onDilutionChange(index, 'dilution_percent', event.target.value)}
                    onWheel={blurNumberInputOnWheel}
                    onFocus={() => onActivateRow?.(index)}
                    placeholder="-"
                    className="h-8 rounded-md border-[#d8cfbf] px-2 text-right text-sm"
                  />
                </div>

                <div className="min-w-0">
                  <Select
                    value={item.dilution_solvent_id || '__none__'}
                    onValueChange={(value) => onDilutionChange(index, 'dilution_solvent_id', value === '__none__' ? '' : value)}
                  >
                    <SelectTrigger className="h-8 rounded-md border-[#d8cfbf] px-2 text-sm" onClick={() => onActivateRow?.(index)}>
                      <SelectValue placeholder="No solvent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No solvent</SelectItem>
                      {solventOptions.map((solvent) => (
                        <SelectItem key={solvent.id} value={solvent.id}>
                          {solvent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(index)}
                    disabled={disableRemove}
                    className="h-8 w-8 rounded-md text-destructive hover:text-destructive"
                    title="Remove row"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}

          {items.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              No rows yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default FormulaItemTableEditor;
