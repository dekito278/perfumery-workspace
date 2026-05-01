import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import DetailSection from '@/components/DetailSection.jsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPercentage } from '@/utils/formatting.js';
import { formatPrice } from '@/utils/pricingUtils.js';

const OverviewStat = ({ label, value, valueClassName = '' }) => (
  <div className="rounded-xl border bg-card p-4">
    <div className="text-xs text-muted-foreground mb-1">{label}</div>
    <div className={`text-lg font-semibold ${valueClassName}`}>{value}</div>
  </div>
);

const FormulaDetailOverviewTab = ({
  formulaReferenceAdvisories,
  hasFormulaItems,
  hasReferenceCoverage,
  ifraAdvisoryCount,
  items,
  legacyAccordCount,
  maxUseAdvisoryCount,
  referenceCoverageCount,
  setShowAllReferenceAlerts,
  showAllReferenceAlerts,
  totalCost,
  totalReferenceAlertCount,
  typicalUseAdvisoryCount,
  visibleReferenceAdvisories,
  workbookSimulation,
}) => (
  <div className="space-y-5">
    <DetailSection title="Overview">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <OverviewStat label="Items" value={items.length} />
        <OverviewStat label="Legacy accord items" value={legacyAccordCount} />
        <OverviewStat label="Diluted" value={items.filter((item) => item.is_diluted && item.dilution_percentage).length} />
        <OverviewStat label="Guidance-backed" value={referenceCoverageCount} />
        <OverviewStat label="Reference alerts" value={totalReferenceAlertCount} valueClassName={totalReferenceAlertCount > 0 ? 'text-amber-600' : ''} />
        <OverviewStat label="Material cost" value={formatPrice(totalCost)} valueClassName="font-mono text-primary" />
      </div>
    </DetailSection>

    <DetailSection title="Reference guidance">
      {hasFormulaItems ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <OverviewStat label="Workbook links" value={workbookSimulation.linkedProfileCount} />
            <OverviewStat label="Manual guidance" value={workbookSimulation.fallbackGuidanceCount} />
            <OverviewStat label="Missing guidance" value={workbookSimulation.missingGuidanceCount} />
            <OverviewStat label="IFRA alerts" value={ifraAdvisoryCount} valueClassName={ifraAdvisoryCount > 0 ? 'text-destructive' : ''} />
            <OverviewStat label="Max use alerts" value={maxUseAdvisoryCount} valueClassName={maxUseAdvisoryCount > 0 ? 'text-amber-600' : ''} />
            <OverviewStat label="Typical nudges" value={typicalUseAdvisoryCount} valueClassName={typicalUseAdvisoryCount > 0 ? 'text-blue-600' : ''} />
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            Untuk bahan diluted, advisory dihitung dari effective active percentage, bukan sekadar persen diluted yang tertulis.
          </p>

          <div className="mt-4 space-y-3">
            {!hasReferenceCoverage ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>No guidance-backed materials yet</AlertTitle>
                <AlertDescription>
                  Add raw materials that already have workbook reference links or manual guidance to unlock IFRA guidance, odour facets, and lifetime-based charting for this formula.
                </AlertDescription>
              </Alert>
            ) : formulaReferenceAdvisories.length ? visibleReferenceAdvisories.map((advisory) => (
              <Alert
                key={`${advisory.itemId}-${advisory.type}`}
                variant={advisory.severity === 'danger' ? 'destructive' : 'default'}
                className={advisory.severity === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-950 [&>svg]:text-amber-700' : ''}
              >
                {advisory.severity === 'danger' || advisory.severity === 'warning' ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <Info className="h-4 w-4" />
                )}
                <AlertTitle>{advisory.itemName} / {advisory.label}</AlertTitle>
                <AlertDescription>
                  <p>{advisory.message}</p>
                  <p className="mt-1 text-xs opacity-80">
                    Reference {advisory.referenceCode || 'profile linked'}
                    {advisory.dilutionPercentage ? ` / diluted ${formatPercentage(advisory.dilutionPercentage, 1)}` : ''}
                  </p>
                </AlertDescription>
              </Alert>
            )) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>No reference alerts in this formula</AlertTitle>
                <AlertDescription>
                  Linked raw materials are currently within their typical guidance, max use level, and IFRA reference limit where that data is available.
                </AlertDescription>
              </Alert>
            )}
            {formulaReferenceAdvisories.length > 4 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAllReferenceAlerts((current) => !current)}
                className="rounded-xl"
              >
                {showAllReferenceAlerts
                  ? 'Show fewer alerts'
                  : `Show ${formulaReferenceAdvisories.length - 4} more alerts`}
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>This formula does not have any ingredients yet</AlertTitle>
          <AlertDescription>
            Add at least one raw material to start reference guidance, workbook charting, and concentration alerts for this formula.
          </AlertDescription>
        </Alert>
      )}
    </DetailSection>
  </div>
);

export default FormulaDetailOverviewTab;
