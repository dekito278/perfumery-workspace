import React, { useMemo } from 'react';
import { AlertTriangle, FlaskConical, Info, TimerReset } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { formatGramAmount, formatPercentage, formatQuantity } from '@/utils/formatting.js';
import { buildWorkbookSimulation } from '@/utils/formulaWorkbookSimulation.js';
import FormulaSensoryChartLayer from '@/components/FormulaSensoryChartLayer.jsx';

const formatHours = (value) => {
  if (value === null || value === undefined) {
    return '-';
  }

  return `${formatQuantity(value, 1)} h`;
};

const MetricCard = ({ label, value, hint, tone = 'default' }) => (
  <div className={`rounded-2xl border p-4 ${
    tone === 'danger'
      ? 'border-destructive/25 bg-destructive/5'
      : tone === 'accent'
        ? 'border-primary/20 bg-primary/5'
        : 'bg-background/80'
  }`}
  >
    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
    <div className="mt-2 text-lg font-semibold">{value}</div>
    {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
  </div>
);

const BalanceBar = ({ label, percentage, amount, toneClass }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="font-medium">{label}</span>
      <span className="font-mono">{formatPercentage(percentage, 1)}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${toneClass}`}
        style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
      />
    </div>
    <div className="text-[11px] text-muted-foreground">{formatGramAmount(amount)} effective active load</div>
  </div>
);

const FormulaWorkbookSimulationPanel = ({
  items,
  rawMaterialsById,
  referenceLinksMap,
  title = 'Workbook simulation',
  description = 'Impact, lifetime, and IFRA checks are advisory only and never block saving this formula.',
}) => {
  const simulation = useMemo(() => buildWorkbookSimulation({
    items,
    rawMaterialsById,
    referenceLinksMap,
  }), [items, rawMaterialsById, referenceLinksMap]);

  if (!simulation.eligibleItemCount) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-[24px] border border-white/80 bg-white/88 p-4 shadow-sm">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{title}</h3>
          <Badge variant="outline" className="text-[10px]">
            {simulation.linkedItemCount}/{simulation.eligibleItemCount} linked
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Reference Coverage"
          value={formatPercentage(simulation.coveragePercent, 0)}
          hint={`${simulation.linkedItemCount} linked materials`}
        />
        <MetricCard
          label="Impact Estimate"
          value={formatQuantity(simulation.impactEstimate, 1)}
          hint="Workbook additive impact model"
          tone="accent"
        />
        <MetricCard
          label="Simple Lifetime"
          value={formatHours(simulation.simpleLifeHours)}
          hint="Weighted by effective active percentage"
        />
        <MetricCard
          label="Odour-Weighted Life"
          value={formatHours(simulation.odourWeightedLifeHours)}
          hint="Weighted by impact contribution"
        />
      </div>

      <div className="rounded-2xl border bg-background/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Top / middle / base balance</div>
            <div className="text-xs text-muted-foreground">Calculated from workbook life-hours and effective active load.</div>
          </div>
          <TimerReset className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <BalanceBar label="Top" percentage={simulation.topPercent} amount={simulation.topAmount} toneClass="bg-sky-500" />
          <BalanceBar label="Middle" percentage={simulation.middlePercent} amount={simulation.middleAmount} toneClass="bg-amber-500" />
          <BalanceBar label="Base" percentage={simulation.basePercent} amount={simulation.baseAmount} toneClass="bg-emerald-600" />
        </div>
      </div>

      <FormulaSensoryChartLayer
        items={items}
        rawMaterialsById={rawMaterialsById}
        referenceLinksMap={referenceLinksMap}
      />

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border bg-background/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">IFRA warnings</div>
              <div className="text-xs text-muted-foreground">Still advisory only. Formula save stays available.</div>
            </div>
            <Badge variant={simulation.ifraAdvisories.length ? 'destructive' : 'secondary'} className="text-[10px]">
              {simulation.ifraAdvisories.length} alert{simulation.ifraAdvisories.length === 1 ? '' : 's'}
            </Badge>
          </div>

          <div className="space-y-3">
            {simulation.ifraAdvisories.length ? simulation.ifraAdvisories.map((advisory) => (
              <Alert key={`${advisory.itemId}-${advisory.type}`} variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{advisory.itemName}</AlertTitle>
                <AlertDescription>
                  <p>{advisory.message}</p>
                  <p className="mt-1 text-xs opacity-80">Reference {advisory.referenceCode || 'linked profile'}</p>
                </AlertDescription>
              </Alert>
            )) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>No IFRA exceedance detected</AlertTitle>
                <AlertDescription>
                  Linked materials are currently within the IFRA reference limit where workbook data is available.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-background/70 p-4">
          <div className="mb-3">
            <div className="text-sm font-semibold">Main impact contributors</div>
            <div className="text-xs text-muted-foreground">The strongest workbook contributors based on effective active percentage.</div>
          </div>
          <div className="space-y-3">
            {simulation.topImpactContributors.length ? simulation.topImpactContributors.map((row) => (
              <div key={`${row.item_id}-${row.reference_profile?.reference_code || row.name}`} className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{row.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {row.reference_profile?.reference_code || 'linked profile'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{formatQuantity(row.impactContribution, 1)}</div>
                    <div className="text-[11px] text-muted-foreground">{formatPercentage(row.effectivePercentage, 2)} effective</div>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(Math.max(row.effectivePercentage, 0), 100)}%` }}
                  />
                </div>
              </div>
            )) : (
              <div className="text-sm text-muted-foreground">
                No impact contributors available yet. Link workbook reference profiles to the selected materials first.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormulaWorkbookSimulationPanel;
