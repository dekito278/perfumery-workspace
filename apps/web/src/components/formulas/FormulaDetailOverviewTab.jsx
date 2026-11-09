import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import DetailSection from '@/components/DetailSection.jsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
    <DetailSection title="Ringkasan">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <OverviewStat label="Baris" value={items.length} />
        <OverviewStat label="Baris akord lama" value={legacyAccordCount} />
        <OverviewStat label="Diencerkan" value={items.filter((item) => item.is_diluted && item.dilution_percentage).length} />
        <OverviewStat label="Berpanduan" value={referenceCoverageCount} />
        <OverviewStat label="Peringatan acuan" value={totalReferenceAlertCount} valueClassName={totalReferenceAlertCount > 0 ? 'text-amber-600' : ''} />
        <OverviewStat label="Biaya bahan" value={formatPrice(totalCost)} valueClassName="font-mono text-primary" />
      </div>
    </DetailSection>

    <DetailSection title="Panduan acuan">
      {hasFormulaItems ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <OverviewStat label="PerfumersWorld" value={workbookSimulation.perfumersWorldGuidanceCount || 0} />
            <OverviewStat label="TGSC / ScenTree" value={(workbookSimulation.tgscGuidanceCount || 0) + (workbookSimulation.scentreeGuidanceCount || 0)} />
            <OverviewStat label="Panduan manual" value={(workbookSimulation.manualGuidanceCount || 0) + (workbookSimulation.referenceGuidanceCount || 0)} />
            <OverviewStat label="Tanpa panduan" value={workbookSimulation.missingGuidanceCount} />
            <OverviewStat label="Peringatan IFRA" value={ifraAdvisoryCount} valueClassName={ifraAdvisoryCount > 0 ? 'text-destructive' : ''} />
            {/* Beside the alert count on purpose: zero alerts does not mean every material was checked.
                76 of the studio's reference profiles state no IFRA limit at all. */}
            <OverviewStat label="IFRA belum tercatat" value={workbookSimulation.unknownIfraLimitCount || 0} />
            <OverviewStat label="Peringatan kadar maksimum" value={maxUseAdvisoryCount} valueClassName={maxUseAdvisoryCount > 0 ? 'text-amber-600' : ''} />
            <OverviewStat label="Di atas kadar umum" value={typicalUseAdvisoryCount} valueClassName={typicalUseAdvisoryCount > 0 ? 'text-blue-600' : ''} />
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            Untuk bahan yang diencerkan, peringatan dihitung dari persentase aktif efektif, bukan dari persen tertulis sebelum pengenceran.
          </p>

          <div className="mt-4 space-y-3">
            {!hasReferenceCoverage ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Belum ada bahan berpanduan</AlertTitle>
                <AlertDescription>
                  Tambahkan bahan baku yang sudah punya tautan acuan workbook atau panduan manual agar panduan IFRA, nuansa aroma, dan grafik ketahanan formula ini terbuka.
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
                    Acuan {advisory.referenceCode || 'profil terhubung'}
                    {advisory.dilutionPercentage ? ` / diencerkan ${formatPercentage(advisory.dilutionPercentage, 1)}` : ''}
                  </p>
                </AlertDescription>
              </Alert>
            )) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Tidak ada peringatan acuan di formula ini</AlertTitle>
                <AlertDescription>
                  Bahan baku yang terhubung masih di bawah kadar pakai umum, kadar maksimum, dan batas IFRA acuan, sejauh datanya tersedia.
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
                  ? 'Tampilkan lebih sedikit'
                  : `Tampilkan ${formulaReferenceAdvisories.length - 4} peringatan lagi`}
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Formula ini belum punya bahan</AlertTitle>
          <AlertDescription>
            Tambahkan minimal satu bahan baku untuk memulai panduan acuan, grafik workbook, dan peringatan konsentrasi formula ini.
          </AlertDescription>
        </Alert>
      )}
    </DetailSection>
  </div>
);

export default FormulaDetailOverviewTab;
