import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import FormulaOdourDisplayPanel from '@/components/FormulaOdourDisplayPanel.jsx';
import FormulaComposerPacePanel from '@/components/FormulaComposerPacePanel.jsx';
import FormulaItemTableEditor from '@/components/FormulaItemTableEditor.jsx';
import FormulaComposerInsightPanels from '@/components/formulas/FormulaComposerInsightPanels.jsx';
import FormulaMaterialLibrary from '@/components/FormulaMaterialLibrary.jsx';
import FormulaScaleTool from '@/components/FormulaScaleTool.jsx';
import { composerSectionClass } from '@/hooks/useFormulaComposer.js';
import { formatGramAmount } from '@/utils/formatting.js';
import { getLibraryBadgeLabel, getLibraryDisabledState } from '@/components/formulas/formulaLibraryProps.js';

const FormulaComposerDesktop = (vm) => {
  const {
    formId,
    onSubmit,
    pacePriorityMode,
    handlePacePriorityModeChange,
    handleApplyPaceRecommendation,
    rawMaterials,
    formulaItems,
    replaceFormulaItems,
    referenceLinksMap,
    focusRowIndex,
    setFocusRowIndex,
    activeRowIndex,
    setActiveRowIndex,
    materialLibraryQuery,
    setMaterialLibraryQuery,
    validationErrors,
    removeFormulaItem,
    updateItem,
    updateGramAmount,
    sortFormulaItemsByGram,
    updateDilutionConfig,
    activeFormulaItems,
    totalGrams,
    itemsWithPercentages,
    rawMaterialsById,
    selectedRawMaterialIdsSet,
    formulaCostSummary,
    getItemGuidanceStatus,
    activeItemInsight,
    combinedLibraryMaterials,
    activatingLibraryId,
    needsGuidanceMaterialId,
    handleLibrarySelectWithGlobal,
    handleLibraryDoubleClickWithGlobal,
    handleOpenGuidanceEditor,
    handleCreateMissingMaterial,
  } = vm;

  const badgeLabel = getLibraryBadgeLabel(activatingLibraryId);

  return (
    <form id={formId} onSubmit={onSubmit}>
      <div className="grid w-full gap-4 xl:items-start xl:gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.45fr)]">

        <section className={`${composerSectionClass} flex flex-col xl:!p-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Komposisi formula</h2>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-full border border-[#e5dcc7] bg-[#fcf8ef] px-3 py-1.5 text-xs font-semibold text-[#443822]">
                Baris {activeFormulaItems.length}
              </div>
              <div className="rounded-full border border-[#dce6d1] bg-[#f3f8ee] px-3 py-1.5 text-xs font-semibold text-[#31451f]">
                Referensi {referenceLinksMap.size}
              </div>
              <div className="rounded-full border border-[#d9def0] bg-[#f3f5fb] px-3 py-1.5 text-xs font-semibold text-[#26314e]">
                Total {formatGramAmount(totalGrams)}
              </div>
            </div>
          </div>

          {validationErrors.ingredients ? (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              <p className="text-xs text-destructive">{validationErrors.ingredients}</p>
            </div>
          ) : null}

          <div className="mt-3">
            <FormulaScaleTool formulaItems={formulaItems} totalGrams={totalGrams} replaceFormulaItems={replaceFormulaItems} />
          </div>

          <div className="mt-3 rounded-[18px] border border-[#e5dcc7] bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="eyebrow text-[#7b6d4f]">
                Tambah raw material
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={materialLibraryQuery}
                onChange={(event) => setMaterialLibraryQuery(event.target.value)}
                placeholder="Cari material..."
                className="h-9 flex-1 rounded-xl border-[#ddd3bf] bg-card text-sm"
              />
            </div>
            <div className="mt-2 max-h-[12rem] overflow-y-auto pr-1">
              <FormulaMaterialLibrary
                materials={combinedLibraryMaterials}
                activeRowIndex={activeRowIndex}
                searchQuery={materialLibraryQuery}
                currentRowItemId={formulaItems[activeRowIndex]?.item_id}
                selectedRawMaterialIdsSet={selectedRawMaterialIdsSet}
                onSelect={(itemId) => handleLibrarySelectWithGlobal(itemId)}
                onDoubleSelect={handleLibraryDoubleClickWithGlobal}
                onCreateMissingMaterial={handleCreateMissingMaterial}
                getDisabledState={getLibraryDisabledState}
                getBadgeLabel={badgeLabel}
              />
            </div>
          </div>

          <div className="mt-3 max-h-[27rem] overflow-y-auto pr-1">
            <FormulaItemTableEditor
              items={formulaItems}
              rawMaterials={rawMaterials}
              focusRowIndex={focusRowIndex}
              activeRowIndex={activeRowIndex}
              onAutoFocusHandled={() => setFocusRowIndex(null)}
              onActivateRow={setActiveRowIndex}
              onItemChange={updateItem}
              onGramAmountChange={updateGramAmount}
              onSortByGram={sortFormulaItemsByGram}
              onDilutionChange={updateDilutionConfig}
              onRemove={removeFormulaItem}
              validationErrors={validationErrors}
              getGuidanceStatus={getItemGuidanceStatus}
              onOpenGuidanceEditor={handleOpenGuidanceEditor}
              onCreateMissingMaterial={handleCreateMissingMaterial}
              needsGuidanceMaterialId={needsGuidanceMaterialId}
            />
          </div>

          <div className="mt-3 space-y-3">
            <FormulaComposerInsightPanels
              activeItemInsight={activeItemInsight}
              formulaCostSummary={formulaCostSummary}
              variant="cogs"
            />

            <FormulaComposerPacePanel
              items={itemsWithPercentages}
              rawMaterialsById={rawMaterialsById}
              referenceLinksMap={referenceLinksMap}
              onApplyRecommendation={handleApplyPaceRecommendation}
              priorityMode={pacePriorityMode}
              onPriorityModeChange={handlePacePriorityModeChange}
            />
          </div>
        </section>

        <div className="space-y-3 xl:pr-1">
          <FormulaComposerInsightPanels
            activeItemInsight={activeItemInsight}
            formulaCostSummary={formulaCostSummary}
            variant="insight"
          />

          <FormulaOdourDisplayPanel
            items={itemsWithPercentages}
            rawMaterialsById={rawMaterialsById}
            referenceLinksMap={referenceLinksMap}
            isVisible
          />
        </div>
      </div>
    </form>
  );
};

export default FormulaComposerDesktop;
