// Lifted out of saas-perfumers' FormulaItemTableEditor, where it lived as a second export. This repo's
// table editor is an older, smaller component that never exported it, so the composer needs it standing
// on its own rather than importing something that is not there.
//
// The COGS half reads formulaCostSummary through optional chaining and renders nothing when it is
// absent — which it is here: that summary needs a purchase-unit/density pricing model this project does
// not have. The material-insight half works as it does there, because activeItemInsight comes from
// useFormulaComposer, which both repos already share.
import React, { useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible.jsx';
import { formatPercentage, formatQuantity } from '@/utils/formatting.js';
import { formatPrice, formatPricePerUnit } from '@/utils/pricingUtils.js';

const FormulaComposerInsightPanels = ({ activeItemInsight, formulaCostSummary, variant = 'all' }) => {
  const [insightOpen, setInsightOpen] = useState(false);
  const showCogs = variant === 'all' || variant === 'cogs';
  const showInsight = variant === 'all' || variant === 'insight';
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
    ? `Panduan ${activeItemInsight.guidanceSourceLabel}${activeItemInsight.referenceCode ? ` - ${activeItemInsight.referenceCode}` : ''}`
    : activeItemInsight?.guidanceSource === 'linked_profile'
      ? `Panduan referensi${activeItemInsight.referenceCode ? ` - ${activeItemInsight.referenceCode}` : ''}`
      : activeItemInsight?.guidanceSource === 'raw_material_fallback'
        ? 'Panduan manual material'
        : 'Panduan belum lengkap';
  const hasActualizedDilutionInsight = Boolean(
    activeItemInsight?.dilutionFactor !== null
    && activeItemInsight?.dilutionFactor !== undefined
    && Number(activeItemInsight.dilutionFactor) > 0
    && Number(activeItemInsight.dilutionFactor) < 1
  );
  const impactCardLabel = hasActualizedDilutionInsight ? 'Impact blend' : 'Impact material';
  const lifeCardLabel = hasActualizedDilutionInsight ? 'Lifetime blend' : 'Lifetime material';
  const solventBehaviourLabel = activeItemInsight?.dilutionSolventBehaviour
    ? String(activeItemInsight.dilutionSolventBehaviour).toUpperCase()
    : null;
  const missingCostCount = Number(formulaCostSummary?.missingCostCount || 0);
  const missingDensityCount = Number(formulaCostSummary?.missingDensityCount || 0);
  const hasCostCoverageWarnings = missingCostCount > 0 || missingDensityCount > 0;

  if (!formulaCostSummary?.rows?.length && !activeItemInsight) {
    return null;
  }

  return (
    <div className="space-y-3">
      {showCogs && formulaCostSummary?.rows?.length ? (
        <div className="rounded-[18px] border border-[#e5dcc7] bg-background px-4 py-3 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#e5dcc7] bg-card px-3 py-2">
              <div className="eyebrow text-[#8b7650]">Material COGS</div>
              <div className="mt-1 text-sm font-bold text-[#443822]">{formatPrice(formulaCostSummary.totalCost)}</div>
            </div>
            <div className="rounded-2xl border border-[#dce6d1] bg-card px-3 py-2">
              <div className="eyebrow text-[#6f8454]">COGS per gram</div>
              <div className="mt-1 text-sm font-bold text-[#31451f]">{formatPrice(formulaCostSummary.costPerGram)}</div>
            </div>
            <div className={`rounded-2xl border px-3 py-2 ${hasCostCoverageWarnings
                ? 'border-warning-border bg-warning-surface text-warning'
                : 'border-success-border bg-success-surface text-success'
              }`}>
              <div className="eyebrow">COGS coverage</div>
              <div className="mt-1 text-sm font-bold">
                {hasCostCoverageWarnings
                  ? [missingCostCount > 0 ? `${missingCostCount} harga belum diisi` : null, missingDensityCount > 0 ? `${missingDensityCount} density belum diisi` : null].filter(Boolean).join(', ')
                  : 'Semua material punya harga'}
              </div>
            </div>
          </div>
          {missingDensityCount > 0 ? (
            <div className="mt-2 flex items-start gap-2 rounded-2xl border border-warning-border bg-warning-surface px-3 py-2 text-xs font-semibold text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Beberapa material dibeli dalam ml/l, sementara formula dihitung gram. Isi density agar COGS formula lebih akurat.
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {showInsight && activeItemInsight ? (
        <Collapsible
          open={insightOpen}
          onOpenChange={setInsightOpen}
          className="rounded-[18px] border border-[#e5dcc7] bg-[linear-gradient(180deg,#fffaf0_0%,#fffdf8_100%)] px-4 py-3 shadow-sm"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="eyebrow text-[#7b6d4f]">
                Insight material terpilih
              </div>
              <div className="mt-1 text-sm font-semibold text-[#433821]">
                {activeItemInsight.name}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {activeInsightSourceLabel}
              </div>
              {insightOpen && hasActualizedDilutionInsight ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  Dilution dengan {activeItemInsight.dilutionSolventName || 'carrier'}{solventBehaviourLabel ? ` (${solventBehaviourLabel})` : ''}; impact/lifetime memakai profil blend.
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {activeItemInsight.effectivePercentage !== null && activeItemInsight.effectivePercentage !== undefined ? (
                <div className="w-fit rounded-full border border-[#d9cfbb] bg-card px-3 py-1 text-[11px] font-semibold text-[#5e5239]">
                  Porsi {formatPercentage(activeItemInsight.effectivePercentage, 2)}
                </div>
              ) : null}
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-7 rounded-full px-2.5 text-[11px]">
                  {insightOpen ? 'Tutup' : 'Detail'}
                  <ChevronDown className={`ml-1 h-3.5 w-3.5 transition-transform ${insightOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-[#e5dcc7] bg-card px-3 py-2.5">
              <div className="eyebrow text-[#8b7650]">{impactCardLabel}</div>
              <div className="mt-1 text-sm font-semibold text-[#443822]">{formatImpactValue(activeItemInsight.impact)}</div>
              {hasActualizedDilutionInsight ? (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Base {formatImpactValue(activeItemInsight.baseImpact)} - Blend {formatImpactValue(activeItemInsight.blendedImpact)}
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-[#d9def0] bg-card px-3 py-2.5">
              <div className="eyebrow text-[#61709a]">{lifeCardLabel}</div>
              <div className="mt-1 text-sm font-semibold text-[#26314e]">{formatLifeValue(activeItemInsight.lifeHours)}</div>
              {hasActualizedDilutionInsight ? (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Base {formatLifeValue(activeItemInsight.baseLifeHours)} - Blend {formatLifeValue(activeItemInsight.blendedLifeHours)}
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-[#dce6d1] bg-card px-3 py-2.5">
              <div className="eyebrow text-[#6f8454]">Impact formula</div>
              <div className="mt-1 text-sm font-semibold text-[#31451f]">{formatImpactValue(activeItemInsight.impactContribution)}</div>
            </div>
            <div className="rounded-2xl border border-[#ead7cf] bg-card px-3 py-2.5">
              <div className="eyebrow text-[#9a6d5d]">Lifetime formula</div>
              <div className="mt-1 text-sm font-semibold text-[#4e2c26]">{formatLifeValue(activeItemInsight.lifeContribution)}</div>
            </div>
            <div className="rounded-2xl border border-[#e5dcc7] bg-card px-3 py-2.5">
              <div className="eyebrow text-[#8b7650]">COGS baris</div>
              <div className="mt-1 text-sm font-semibold text-[#443822]">{formatPrice(activeItemInsight.cost)}</div>
              <div className="mt-1 truncate text-[11px] text-muted-foreground">
                {activeItemInsight.unitPrice > 0
                  ? formatPricePerUnit(activeItemInsight.unitPrice, activeItemInsight.unit)
                  : 'Isi harga beli'}
              </div>
              {activeItemInsight.hasDensityWarning ? (
                <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Density belum diisi, sementara 1 g/ml</span>
                </div>
              ) : activeItemInsight.usesVolumePurchaseForGramFormula && activeItemInsight.densityGPerMl > 0 ? (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Density {formatQuantity(activeItemInsight.densityGPerMl, 3)} g/ml
                </div>
              ) : null}
            </div>
          </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
};

export default FormulaComposerInsightPanels;
