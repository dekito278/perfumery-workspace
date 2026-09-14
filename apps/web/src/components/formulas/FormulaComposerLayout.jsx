import React from 'react';
import { ChevronLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import RawMaterialGuidanceQuickEditDialog from '@/components/RawMaterialGuidanceQuickEditDialog.jsx';
import FormulaMaterialQuickCreateDialog from '@/components/FormulaMaterialQuickCreateDialog.jsx';
import FormulaComposerMobile from '@/components/formulas/FormulaComposerMobile.jsx';
import FormulaComposerDesktop from '@/components/formulas/FormulaComposerDesktop.jsx';
import { composerSectionClass } from '@/hooks/useFormulaComposer.js';

const FormulaComposerLayout = (vm) => {
  const {
    onBack,
    headerTitle,
    formId,
    submitDisabled,
    submitLabel,
    submitLoadingLabel,
    loading,
    topExtra = null,
    afterHeaderExtra = null,
    name,
    code,
    version,
    status,
    categoryLabel,
    loadingData,
    isMobile,
    setMetadataDialogOpen,
    getItemGuidanceStatus,
    guidanceEditorOpen,
    setGuidanceEditorOpen,
    guidanceEditorMaterial,
    quickCreateIntent,
    setQuickCreateIntent,
    quickCreateLoading,
    quickCreateDuplicateCandidates,
    handleGuidanceSaved,
    handleSelectQuickCreateExistingMaterial,
    handleConfirmQuickCreateMaterial,
  } = vm;

  return (
    <>
      <div className="mb-4 shrink-0 xl:mb-1">
        <Button variant="ghost" onClick={onBack} className="gap-2 h-9 xl:h-8">
          <ChevronLeft className="w-4 h-4" />
          Kembali ke formula
        </Button>
      </div>

      {topExtra}

      <div className={`mb-3 shrink-0 px-3 py-3 sm:px-4 lg:mb-3 xl:!mb-2 xl:!py-2.5 ${composerSectionClass}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow text-muted-foreground xl:hidden">
              Formula Composer
            </div>
            <h1 className="mt-1 text-xl font-bold tracking-[-0.02em] sm:text-2xl xl:mt-0 xl:text-lg">
              {headerTitle}
            </h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" variant="outline" onClick={() => setMetadataDialogOpen(true)} className="h-10 w-full rounded-2xl px-4 sm:w-auto">
              Edit info formula
            </Button>
            <Button type="submit" form={formId} disabled={submitDisabled} className="h-10 w-full rounded-2xl gap-2 px-5 sm:w-auto">
              <Save className="h-4 w-4" />
              {loading ? submitLoadingLabel : submitLabel}
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 md:hidden">
          <div className="rounded-full border border-[#d9def0] bg-[#f3f5fb] px-3 py-1.5 text-xs font-semibold text-[#26314e]">
            {code || 'Kode belum diisi'}
          </div>
          <div className="rounded-full border border-[#ddd3bf] bg-[#fbf8f0] px-3 py-1.5 text-xs font-semibold capitalize text-[#433821]">
            {status}
          </div>
          <div className="rounded-full border border-[#dce6d1] bg-[#f3f8ee] px-3 py-1.5 text-xs font-semibold capitalize text-[#31451f]">
            {categoryLabel}
          </div>
        </div>

        <div className="mt-3 hidden flex-wrap items-center gap-2 md:flex">
          <span className="rounded-full border border-[#e5dcc7] bg-[#fcf8ef] px-3 py-1 text-xs font-semibold text-[#443822]">{name || 'Formula belum diberi nama'}</span>
          <span className="rounded-full border border-[#d9def0] bg-[#f3f5fb] px-3 py-1 text-xs font-semibold text-[#26314e]">{code || 'Kode belum diisi'}</span>
          <span className="rounded-full border border-[#dce6d1] bg-[#f3f8ee] px-3 py-1 text-xs font-semibold capitalize text-[#31451f]">{categoryLabel}</span>
          <span className="rounded-full border border-[#ddd3bf] bg-[#fbf8f0] px-3 py-1 text-xs font-semibold capitalize text-[#433821]">{status}</span>
          {version ? <span className="rounded-full border border-[#ead7cf] bg-[#fff6f2] px-3 py-1 text-xs font-semibold text-[#4e2c26]">v{version}</span> : null}
        </div>
      </div>

      {afterHeaderExtra}

      {loadingData ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.72fr)] 2xl:grid-cols-[minmax(0,1.85fr)_minmax(380px,0.68fr)]">
          <div className="space-y-4">
            <Skeleton className="h-[640px] w-full rounded-3xl" />
          </div>
          <Skeleton className="h-[640px] w-full rounded-3xl" />
        </div>
      ) : isMobile ? (
        <FormulaComposerMobile {...vm} />
      ) : (
        <FormulaComposerDesktop {...vm} />
      )}

      <FormulaMaterialQuickCreateDialog
        open={Boolean(quickCreateIntent)}
        materialName={quickCreateIntent?.name || ''}
        duplicateCandidates={quickCreateDuplicateCandidates}
        loading={quickCreateLoading}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setQuickCreateIntent(null);
        }}
        onSelectExisting={handleSelectQuickCreateExistingMaterial}
        onConfirm={handleConfirmQuickCreateMaterial}
      />

      <RawMaterialGuidanceQuickEditDialog
        open={guidanceEditorOpen}
        onOpenChange={setGuidanceEditorOpen}
        material={guidanceEditorMaterial}
        guidanceStatus={guidanceEditorMaterial ? getItemGuidanceStatus({ item_id: guidanceEditorMaterial.id }) : null}
        onSaved={handleGuidanceSaved}
      />
    </>
  );
};

export default FormulaComposerLayout;
