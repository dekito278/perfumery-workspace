import React from 'react';
import { AlertCircle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer.jsx';
import FormulaOdourDisplayPanel from '@/components/FormulaOdourDisplayPanel.jsx';
import FormulaComposerPacePanel from '@/components/FormulaComposerPacePanel.jsx';
import FormulaItemTableEditor from '@/components/FormulaItemTableEditor.jsx';
import FormulaComposerInsightPanels from '@/components/formulas/FormulaComposerInsightPanels.jsx';
import FormulaMaterialLibrary from '@/components/FormulaMaterialLibrary.jsx';
import FormulaScaleTool from '@/components/FormulaScaleTool.jsx';
import { composerSectionClass } from '@/hooks/useFormulaComposer.js';
import { formatGramAmount } from '@/utils/formatting.js';
import { getLibraryBadgeLabel, getLibraryDisabledState } from '@/components/formulas/formulaLibraryProps.js';

const FormulaComposerMobile = (vm) => {
  const {
    formId,
    onSubmit,
    submitDisabled,
    loading,
    mobileSubmitLabel,
    mobileSubmitLoadingLabel,
    name,
    code,
    version,
    status,
    notes,
    categoryLabel,
    mobileComposerTab,
    setMobileComposerTab,
    mobileLibraryOpen,
    setMobileLibraryOpen,
    pacePriorityMode,
    handlePacePriorityModeChange,
    handleApplyPaceRecommendation,
    setMetadataDialogOpen,
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
    handleLibraryDoubleClickWithGlobal,
    handleOpenGuidanceEditor,
    handleCreateMissingMaterial,
  } = vm;

  const badgeLabel = getLibraryBadgeLabel(activatingLibraryId);

  const handleMobileLibraryPick = async (itemId) => {
    await handleLibraryDoubleClickWithGlobal(itemId);
    setMobileLibraryOpen(false);
    setMobileComposerTab('compose');
  };

  return (
    <>
      <form id={formId} onSubmit={onSubmit} className="space-y-4">
        <Tabs value={mobileComposerTab} onValueChange={setMobileComposerTab} className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-[#f3ecdd] p-1">
            <TabsTrigger value="compose" className="rounded-xl py-2 text-xs">Komposisi</TabsTrigger>
            <TabsTrigger value="workbook" className="rounded-xl py-2 text-xs">Workbook</TabsTrigger>
            <TabsTrigger value="info" className="rounded-xl py-2 text-xs">Info</TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="mt-0">
            <section className={composerSectionClass}>
              <h2 className="text-lg font-semibold">Komposisi formula</h2>

              <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
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

              {validationErrors.ingredients ? (
                <div className="mt-4 flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-3">
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                  <p className="text-xs text-destructive">{validationErrors.ingredients}</p>
                </div>
              ) : null}

              <div className="mt-4">
                <FormulaScaleTool formulaItems={formulaItems} totalGrams={totalGrams} replaceFormulaItems={replaceFormulaItems} />
              </div>

              <div className="mt-4">
                <FormulaComposerInsightPanels activeItemInsight={activeItemInsight} formulaCostSummary={formulaCostSummary} />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-[18px] border border-[#ddd3bf] bg-[#fcfaf4] px-4 py-3">
                <div className="eyebrow text-[#7b6d4f]">
                  Tambah raw material
                </div>
                <Button type="button" className="rounded-xl" onClick={() => setMobileLibraryOpen(true)}>
                  Tambah material
                </Button>
              </div>

              <div className="mt-4 max-h-[25rem] overflow-y-auto pr-1">
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

              <div className="mt-4">
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
          </TabsContent>

          <TabsContent value="workbook" className="mt-0">
            <FormulaOdourDisplayPanel
              items={itemsWithPercentages}
              rawMaterialsById={rawMaterialsById}
              referenceLinksMap={referenceLinksMap}
              isVisible={mobileComposerTab === 'workbook'}
            />
          </TabsContent>

          <TabsContent value="info" className="mt-0">
            <section className={composerSectionClass}>
              <h2 className="text-lg font-semibold">Info formula</h2>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-[16px] border border-[#e5dcc7] bg-[linear-gradient(135deg,#fff9ec_0%,#f8f1dc_100%)] px-3 py-2">
                  <div className="eyebrow text-[#8b7650]">Nama</div>
                  <div className="mt-1 text-sm font-semibold text-[#443822]">{name || 'Formula belum diberi nama'}</div>
                </div>
                <div className="rounded-[16px] border border-[#d9def0] bg-[linear-gradient(135deg,#f6f8ff_0%,#edf2ff_100%)] px-3 py-2">
                  <div className="eyebrow text-[#61709a]">Kode</div>
                  <div className="mt-1 text-sm font-semibold text-[#26314e]">{code || 'Kode belum diisi'}</div>
                </div>
                <div className="rounded-[16px] border border-[#dce6d1] bg-[linear-gradient(135deg,#f4f9ee_0%,#edf6e3_100%)] px-3 py-2">
                  <div className="eyebrow text-[#6f8454]">Kategori</div>
                  <div className="mt-1 text-sm font-semibold text-[#31451f]">{categoryLabel}</div>
                </div>
                <div className="rounded-[16px] border border-[#ead7cf] bg-[linear-gradient(135deg,#fff6f2_0%,#fcedea_100%)] px-3 py-2">
                  <div className="eyebrow text-[#9a6d5d]">Versi</div>
                  <div className="mt-1 text-sm font-semibold text-[#4e2c26]">{version || '-'}</div>
                </div>
                <div className="rounded-[16px] border border-[#ddd3bf] bg-[linear-gradient(135deg,#fbf8f0_0%,#f4ede0_100%)] px-3 py-2 sm:col-span-2">
                  <div className="eyebrow text-[#7b6a4a]">Status</div>
                  <div className="mt-1 text-sm font-semibold capitalize text-[#433821]">{status}</div>
                </div>
                <div className="rounded-[16px] border border-[#ddd3bf] bg-card px-3 py-3 sm:col-span-2">
                  <div className="eyebrow text-[#7b6a4a]">Catatan</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {notes || 'Catatan belum diisi'}
                  </div>
                </div>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </form>

      <Drawer open={mobileLibraryOpen} onOpenChange={setMobileLibraryOpen}>
        <DrawerContent className="max-h-[85vh] rounded-t-[24px] border-[#ddd3bf] bg-[#fcfaf4]">
          <DrawerHeader className="mobile-sheet-drag-zone text-left" data-mobile-sheet-drag-zone>
            <DrawerTitle>Library material</DrawerTitle>
            <DrawerDescription>
              Tap material untuk menambah row baru. Edit amount dan dilution dari tabel komposisi.
            </DrawerDescription>
          </DrawerHeader>
          <div className="border-b border-[#e7decb] px-4 pb-3">
            <Input
              value={materialLibraryQuery}
              onChange={(event) => setMaterialLibraryQuery(event.target.value)}
              placeholder="Cari material..."
              className="h-10 rounded-xl border-[#ddd3bf] bg-card text-sm"
            />
          </div>
          <div className="overflow-y-auto px-4 py-4">
            <FormulaMaterialLibrary
              materials={combinedLibraryMaterials}
              activeRowIndex={activeRowIndex}
              searchQuery={materialLibraryQuery}
              currentRowItemId={formulaItems[activeRowIndex]?.item_id}
              selectedRawMaterialIdsSet={selectedRawMaterialIdsSet}
              mobile
              onSelect={(itemId) => handleMobileLibraryPick(itemId)}
              onDoubleSelect={handleLibraryDoubleClickWithGlobal}
              onCreateMissingMaterial={handleCreateMissingMaterial}
              getDisabledState={getLibraryDisabledState}
              getBadgeLabel={badgeLabel}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <div className="sticky bottom-3 z-20 mt-4 md:hidden">
        <div className="rounded-3xl border border-[#ddd3bf] bg-card/95 p-2 shadow-lg backdrop-blur">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMetadataDialogOpen(true);
                setMobileComposerTab('info');
              }}
              className="h-11 rounded-2xl"
            >
              Edit info
            </Button>
            <Button type="submit" form={formId} disabled={submitDisabled} className="h-11 rounded-2xl gap-2">
              <Save className="h-4 w-4" />
              {loading ? mobileSubmitLoadingLabel : mobileSubmitLabel}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default FormulaComposerMobile;
