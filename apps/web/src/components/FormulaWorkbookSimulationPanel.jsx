import React, { useMemo, useState } from 'react';
import { AlertTriangle, FlaskConical, GitBranch, Info, Radio, Sparkles, TimerReset } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { formatPercentage, formatQuantity } from '@/utils/formatting.js';
import { buildWorkbookSimulation } from '@/utils/formulaWorkbookSimulation.js';
import {
  buildFrameworkObjectives,
  buildPaceRecommendations,
  formatRecommendationValue,
} from '@/utils/formulaPaceRecommendations.js';
import {
  PACE_PRIORITY_MODES,
  getPacePriorityModeMeta,
  normalizePacePriorityMode,
} from '@/utils/pacePriority.js';
import FormulaSensoryChartLayer from '@/components/FormulaSensoryChartLayer.jsx';
import { SCORE_BANDS, getScoreBand } from '@/utils/paceScoreBands.js';

const formatHours = (value) => {
  if (value === null || value === undefined) {
    return '-';
  }

  return `${formatQuantity(value, 1)} h`;
};

const PACE_METRIC_HELP = {
  Opening: 'How alive and noticeable the first impression feels.',
  Heart: 'How much body and identity remains after the opening settles.',
  Drydown: 'How convincing and present the late-stage impression stays.',
  Diffusion: 'How well the formula projects beyond the skin or blotter.',
  Tenacity: 'How well the formula holds over time.',
  Harmony: 'How well the materials feel blended instead of colliding.',
  Smoothness: 'How soft and seamless the phase movement feels.',
  'Bridge Quality': 'How naturally the formula transitions between top, heart, and base.',
  'Top -> Heart': 'How well the opening hands off into the middle.',
  'Heart -> Base': 'How well the heart continues into the drydown.',
  'Contributor Diversity': 'How evenly the formula is supported instead of leaning on one dominant material.',
  'Pyramid Balance': 'How close the formula is to a balanced top / middle / base structure.',
};


const MetricCard = ({ label, value, tone = 'default', score = null }) => (
  <div className={`rounded-[1.15rem] border px-3.5 py-3 ${
    tone === 'danger'
      ? 'border-destructive/25 bg-destructive/5'
      : tone === 'success'
        ? 'border-emerald-200 bg-emerald-50/90'
      : tone === 'accent'
        ? 'border-primary/20 bg-primary/5'
      : 'bg-background/80'
  }`}
  >
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
      <span>{label}</span>
      {PACE_METRIC_HELP[label] ? (
        <Tooltip>
          <TooltipTrigger asChild>
            {/* The only icon-only button in the app without a name: screen readers announced "button" and
                nothing else. Named with the metric it explains — the word is already on screen beside it,
                so this adds no new copy to a Studio panel in either language. */}
            <button
              type="button"
              aria-label={label}
              className="inline-flex items-center text-muted-foreground/80 transition hover:text-foreground"
            >
              <Info className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[16rem] text-[11px] leading-relaxed">
            {PACE_METRIC_HELP[label]}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
    <div className="mt-1.5 text-[1.05rem] font-semibold">{value}</div>
    {score !== null ? (
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">Interpretation</span>
        <Badge variant="outline" className={`rounded-full px-2 py-0.5 text-[10px] ${getScoreBand(score).className}`}>
          {getScoreBand(score).label}
        </Badge>
      </div>
    ) : null}
  </div>
);

const SourceBadge = ({ label, value, toneClass = 'border-border bg-background text-foreground' }) => (
  <div className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${toneClass}`}>
    {label}: {value}
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
    <div className="text-[11px] text-muted-foreground">{formatQuantity(amount, 2)} odour-weight load</div>
  </div>
);

const scoreTone = (value) => {
  if (value >= 75) {
    return 'success';
  }

  if (value < 40) {
    return 'danger';
  }

  if (value >= 60) {
    return 'accent';
  }

  return 'default';
};

const ContributorList = ({ title, rows, emptyLabel }) => (
  <div className="rounded-[1.1rem] border bg-background/75 p-3">
    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</div>
    <div className="space-y-2">
      {rows.length ? rows.map((row) => (
        <div key={`${title}-${row.itemId}-${row.name}`} className="flex items-center justify-between gap-3 text-sm">
          <div className="min-w-0">
            <div className="truncate font-medium">{row.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {row.referenceCode || 'manual guidance'}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono font-semibold">{formatPercentage(row.effectivePercentage, 1)}</div>
            <div className="text-[11px] text-muted-foreground">effective</div>
          </div>
        </div>
      )) : (
        <div className="text-sm text-muted-foreground">{emptyLabel}</div>
      )}
    </div>
  </div>
);

const FormulaWorkbookSimulationPanel = ({
  items,
  rawMaterialsById,
  referenceLinksMap,
  title = 'PACE analysis',
  description = '',
  onApplyRecommendation = null,
  onCreatePacedRevision = null,
  isCreatingPacedRevision = false,
  priorityMode = null,
  onPriorityModeChange = null,
  defaultPriorityMode = 'balance',
}) => {
  const [internalPriorityMode, setInternalPriorityMode] = useState(() => normalizePacePriorityMode(defaultPriorityMode));
  const resolvedPriorityMode = normalizePacePriorityMode(priorityMode ?? internalPriorityMode);
  const simulation = useMemo(() => buildWorkbookSimulation({
    items,
    rawMaterialsById,
    referenceLinksMap,
  }), [items, rawMaterialsById, referenceLinksMap]);
  const objectives = useMemo(() => buildFrameworkObjectives(simulation), [simulation]);
  const simulationWithContext = useMemo(() => ({
    ...simulation,
    referenceLinksMap,
  }), [simulation, referenceLinksMap]);
  const paceRecommendations = useMemo(
    () => buildPaceRecommendations(simulationWithContext, resolvedPriorityMode),
    [resolvedPriorityMode, simulationWithContext]
  );
  const activePriorityMode = getPacePriorityModeMeta(resolvedPriorityMode);

  const handlePriorityModeChange = (nextMode) => {
    const normalizedMode = normalizePacePriorityMode(nextMode);

    if (typeof onPriorityModeChange === 'function') {
      onPriorityModeChange(normalizedMode);
      return;
    }

    setInternalPriorityMode(normalizedMode);
  };

  if (!simulation.eligibleItemCount) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="space-y-3.5 rounded-[24px] border border-[#ddd3bf] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,246,239,0.98)_100%)] p-4 shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{title}</h3>
          <Badge variant="outline" className="ml-auto rounded-full px-2.5 text-[10px]">
            {simulation.guidanceBackedCount}/{simulation.eligibleItemCount} with guidance
          </Badge>
        </div>
        {description ? (
          <p className="pt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
        <div className="flex flex-wrap gap-1.5 pt-1.5">
          <SourceBadge
            label="PerfumersWorld"
            value={simulation.perfumersWorldGuidanceCount}
            toneClass="border-emerald-200 bg-emerald-50 text-emerald-900"
          />
          <SourceBadge
            label="TGSC"
            value={simulation.tgscGuidanceCount}
            toneClass="border-sky-200 bg-sky-50 text-sky-900"
          />
          <SourceBadge
            label="ScenTree"
            value={simulation.scentreeGuidanceCount}
            toneClass="border-indigo-200 bg-indigo-50 text-indigo-900"
          />
          <SourceBadge
            label="Manual"
            value={simulation.manualGuidanceCount + simulation.referenceGuidanceCount}
            toneClass="border-amber-200 bg-amber-50 text-amber-950"
          />
          <SourceBadge
            label="Missing"
            value={simulation.missingGuidanceCount}
            toneClass="border-slate-200 bg-slate-50 text-slate-700"
          />
          <SourceBadge
            label="PACE warnings"
            value={simulation.pace.warningCount}
            toneClass={simulation.pace.warningCount ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}
          />
        </div>
        <div className="mt-3 grid gap-2.5 md:grid-cols-3">
          <MetricCard
            label="Balance"
            value={formatQuantity(objectives.balance, 0)}
            tone={scoreTone(objectives.balance)}
            score={objectives.balance}
          />
          <MetricCard
            label="Projection"
            value={formatQuantity(objectives.projection, 0)}
            tone={scoreTone(objectives.projection)}
            score={objectives.projection}
          />
          <MetricCard
            label="Longevity"
            value={formatQuantity(objectives.longevity, 0)}
            tone={scoreTone(objectives.longevity)}
            score={objectives.longevity}
          />
        </div>
        <div className="mt-3 rounded-[1rem] border border-[#e6deca] bg-white/70 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7e6c42]">
                Recommendation priority
              </div>
              <div className="mt-1 text-sm text-[#5f5239]">
                PACE suggestions are currently tuned for <span className="font-semibold">{activePriorityMode.label.toLowerCase()}</span>.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {PACE_PRIORITY_MODES.map((mode) => (
                <Button
                  key={mode.value}
                  type="button"
                  size="sm"
                  variant={resolvedPriorityMode === mode.value ? 'default' : 'outline'}
                  className="rounded-full px-3"
                  onClick={() => handlePriorityModeChange(mode.value)}
                >
                  {mode.label}
                </Button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
            {activePriorityMode.helper}
          </p>
        </div>
      </div>

      <div className="rounded-[1.2rem] border bg-background/70 p-3.5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            PACE performance board
          </div>
          {simulation.pace.strongestAxis ? (
            <Badge variant="secondary" className="rounded-full px-2.5 text-[10px]">
              Strongest: {simulation.pace.strongestAxis.label}
            </Badge>
          ) : null}
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {SCORE_BANDS.map((band) => (
            <Badge key={band.label} variant="outline" className={`rounded-full px-2.5 text-[10px] ${band.className}`}>
              {band.label}: {band.helper}
            </Badge>
          ))}
        </div>

        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Opening"
            value={formatQuantity(simulation.pace.openingScore, 0)}
            tone={scoreTone(simulation.pace.openingScore)}
            score={simulation.pace.openingScore}
          />
          <MetricCard
            label="Heart"
            value={formatQuantity(simulation.pace.heartScore, 0)}
            tone={scoreTone(simulation.pace.heartScore)}
            score={simulation.pace.heartScore}
          />
          <MetricCard
            label="Drydown"
            value={formatQuantity(simulation.pace.drydownScore, 0)}
            tone={scoreTone(simulation.pace.drydownScore)}
            score={simulation.pace.drydownScore}
          />
          <MetricCard
            label="Diffusion"
            value={formatQuantity(simulation.pace.diffusionScore, 0)}
            tone={scoreTone(simulation.pace.diffusionScore)}
            score={simulation.pace.diffusionScore}
          />
          <MetricCard
            label="Tenacity"
            value={formatQuantity(simulation.pace.tenacityScore, 0)}
            tone={scoreTone(simulation.pace.tenacityScore)}
            score={simulation.pace.tenacityScore}
          />
          <MetricCard
            label="Harmony"
            value={formatQuantity(simulation.pace.harmonyScore, 0)}
            tone={scoreTone(simulation.pace.harmonyScore)}
            score={simulation.pace.harmonyScore}
          />
          <MetricCard
            label="Smoothness"
            value={formatQuantity(simulation.pace.smoothnessScore, 0)}
            tone={scoreTone(simulation.pace.smoothnessScore)}
            score={simulation.pace.smoothnessScore}
          />
          <MetricCard
            label="Bridge Quality"
            value={formatQuantity(simulation.pace.bridgeQualityScore, 0)}
            tone={scoreTone(simulation.pace.bridgeQualityScore)}
            score={simulation.pace.bridgeQualityScore}
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.2rem] border bg-background/70 p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              Transition diagnostics
            </div>
            {simulation.pace.weakestAxis ? (
              <Badge variant="outline" className="rounded-full px-2.5 text-[10px]">
                Watch: {simulation.pace.weakestAxis.label}
              </Badge>
            ) : null}
          </div>
          <div className="grid gap-2.5 md:grid-cols-2">
            <MetricCard
              label="Top -> Heart"
              value={formatQuantity(simulation.pace.topMiddleBridgeScore, 0)}
              tone={scoreTone(simulation.pace.topMiddleBridgeScore)}
              score={simulation.pace.topMiddleBridgeScore}
            />
            <MetricCard
              label="Heart -> Base"
              value={formatQuantity(simulation.pace.middleBaseBridgeScore, 0)}
              tone={scoreTone(simulation.pace.middleBaseBridgeScore)}
              score={simulation.pace.middleBaseBridgeScore}
            />
            <MetricCard
              label="Contributor Diversity"
              value={formatQuantity(simulation.pace.contributorDiversityScore, 0)}
              tone={scoreTone(simulation.pace.contributorDiversityScore)}
              score={simulation.pace.contributorDiversityScore}
            />
            <MetricCard
              label="Pyramid Balance"
              value={formatQuantity(simulation.pace.balanceScore, 0)}
              tone={scoreTone(simulation.pace.balanceScore)}
              score={simulation.pace.balanceScore}
            />
          </div>
          {simulation.pace.dominantClass ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Dominant class now: <span className="font-medium text-foreground">{simulation.pace.dominantClass.familyName}</span>{' '}
              at {formatPercentage(simulation.pace.dominantClass.sharePercent, 1)} of odour-weighted class load.
            </p>
          ) : null}
        </div>

        <div className="rounded-[1.2rem] border bg-background/70 p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Radio className="h-4 w-4 text-muted-foreground" />
              Phase anchors
            </div>
            <Badge variant="outline" className="rounded-full px-2.5 text-[10px]">
              Structured from guidance rows
            </Badge>
          </div>
          <div className="space-y-3">
            <ContributorList
              title="Opening anchors"
              rows={simulation.pace.openingContributors}
              emptyLabel="No top-phase contributors detected yet."
            />
            <ContributorList
              title="Heart anchors"
              rows={simulation.pace.heartContributors}
              emptyLabel="No middle-phase contributors detected yet."
            />
            <ContributorList
              title="Drydown anchors"
              rows={simulation.pace.drydownContributors}
              emptyLabel="No base-phase contributors detected yet."
            />
          </div>
        </div>
      </div>

      {paceRecommendations.length ? (
        <div className="rounded-[1.2rem] border bg-background/70 p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Revision suggestions</div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full px-2.5 text-[10px]">
                Test-sized gram moves
              </Badge>
              <Badge variant="secondary" className="rounded-full px-2.5 text-[10px]">
                {activePriorityMode.shortLabel} priority
              </Badge>
              {onCreatePacedRevision ? (
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full px-3"
                  onClick={() => onCreatePacedRevision(paceRecommendations, resolvedPriorityMode)}
                  disabled={isCreatingPacedRevision}
                >
                  {isCreatingPacedRevision ? 'Creating PACED revision...' : 'Create PACED revision'}
                </Button>
              ) : null}
            </div>
          </div>
          <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">
            These are first-pass gram suggestions for the next trial batch. Apply one or two changes at a time, then re-check PACE and your validation notes.
          </p>
          <div className="grid gap-2.5 md:grid-cols-2">
            {paceRecommendations.map((recommendation) => (
              <div
                key={recommendation.key}
                className={`rounded-[1rem] border p-3 ${
                  recommendation.tone === 'danger'
                    ? 'border-destructive/20 bg-destructive/[0.04]'
                    : 'border-primary/15 bg-primary/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{recommendation.title}</div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Badge
                      variant="outline"
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        recommendation.recommendationKind === 'cleanup_move'
                          ? 'border-amber-300 bg-amber-50 text-amber-950'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      }`}
                    >
                      {recommendation.recommendationKind === 'cleanup_move' ? 'Cleanup move' : 'Safe increase'}
                    </Badge>
                    {recommendation.objective ? (
                      <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] capitalize">
                        {recommendation.objective}
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                      {recommendation.axisLabel}
                    </Badge>
                  </div>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                  {recommendation.reason}
                </p>
                {recommendation.strategyLabel ? (
                  <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Strategy: {recommendation.strategyLabel}
                  </div>
                ) : null}
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-[0.85rem] border bg-background/80 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Current</div>
                    <div className="mt-1 text-sm font-semibold">{formatRecommendationValue(recommendation.currentGrams)}</div>
                  </div>
                  <div className="rounded-[0.85rem] border bg-background/80 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{recommendation.actionLabel}</div>
                    <div className="mt-1 text-sm font-semibold">
                      {recommendation.tone === 'danger' ? '-' : '+'}
                      {formatRecommendationValue(recommendation.delta)}
                    </div>
                  </div>
                  <div className="rounded-[0.85rem] border bg-background/80 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Target</div>
                    <div className="mt-1 text-sm font-semibold">{formatRecommendationValue(recommendation.target)}</div>
                  </div>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                  {recommendation.helper}
                </p>
                {onApplyRecommendation ? (
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant={recommendation.tone === 'danger' ? 'outline' : 'default'}
                      className="rounded-full px-3"
                      onClick={() => onApplyRecommendation(recommendation)}
                    >
                      Apply
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-[1.2rem] border bg-background/70 p-3.5">
          <div className="mb-2 text-sm font-semibold">Revision suggestions</div>
          <Alert className="rounded-[1rem] border-border/80 bg-background/85 px-3.5 py-3 text-[13px] [&>svg]:left-3.5 [&>svg]:top-3.5 [&>svg~*]:pl-6">
            <Info className="h-3.5 w-3.5" />
            <AlertTitle className="mb-1 text-[13px] font-semibold">PACE is stable enough to pause revisions</AlertTitle>
            <AlertDescription className="text-[12px] leading-relaxed text-muted-foreground">
              The current formula is already in a healthy PACE range, so the board is intentionally not pushing more gram changes right now. At this point, validation on blotter or skin is more useful than chasing extra score movement.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Reference Coverage"
          value={formatPercentage(simulation.coveragePercent, 0)}
        />
        <MetricCard
          label="Impact Estimate"
          value={simulation.hasImpactData ? formatQuantity(simulation.impactEstimate, 1) : '-'}
          tone="accent"
        />
        <MetricCard
          label="Simple Lifetime"
          value={simulation.hasLifeData ? formatHours(simulation.simpleLifeHours) : '-'}
        />
        <MetricCard
          label="Odour-Weighted Life"
          value={formatHours(simulation.odourWeightedLifeHours)}
        />
      </div>

      <div className="rounded-[1.2rem] border bg-background/70 p-3.5">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">Top / middle / base balance</div>
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
        <div className="rounded-[1.2rem] border bg-background/70 p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Warnings and guidance friction</div>
            <Badge variant={simulation.pace.warningCount ? 'destructive' : 'secondary'} className="rounded-full px-2.5 text-[10px]">
              {simulation.pace.warningCount} flag{simulation.pace.warningCount === 1 ? '' : 's'}
            </Badge>
          </div>

          <div className="space-y-2">
            {simulation.pace.warnings.length ? simulation.pace.warnings.map((warning) => (
              <Alert
                key={`${warning.type}-${warning.code}`}
                variant={warning.severity === 'danger' ? 'destructive' : 'default'}
                className={`rounded-[1rem] px-3.5 py-3 text-[13px] [&>svg]:left-3.5 [&>svg]:top-3.5 [&>svg~*]:pl-6 ${
                  warning.severity === 'danger'
                    ? 'border-destructive/30 bg-destructive/[0.045]'
                    : 'border-amber-200 bg-amber-50/70'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <AlertTitle className="mb-1 text-[13px] font-semibold">{warning.title}</AlertTitle>
                <AlertDescription className="text-[12px] leading-relaxed">
                  <p>{warning.message}</p>
                </AlertDescription>
              </Alert>
            )) : (
              <Alert className="rounded-[1rem] border-border/80 bg-background/85 px-3.5 py-3 text-[13px] [&>svg]:left-3.5 [&>svg]:top-3.5 [&>svg~*]:pl-6">
                <Info className="h-3.5 w-3.5" />
                <AlertTitle className="mb-1 text-[13px] font-semibold">No major PACE friction detected</AlertTitle>
                <AlertDescription className="text-[12px] leading-relaxed text-muted-foreground">
                  The current formula looks reasonably connected across phases with no major overload or conflict warning from the guidance-backed rows.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <div className="rounded-[1.2rem] border bg-background/70 p-3.5">
          <div className="mb-2.5 text-sm font-semibold">Main impact contributors</div>
          <div className="space-y-3">
            {simulation.topImpactContributors.length ? simulation.topImpactContributors.map((row) => (
              <div key={`${row.item_id}-${row.reference_profile?.reference_code || row.name}`} className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{row.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {row.reference_profile?.reference_code || 'linked profile'}
                      {' / '}
                      {row.guidanceSource === 'raw_material_fallback' ? 'manual guidance' : 'workbook linked'}
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
    </TooltipProvider>
  );
};

export default FormulaWorkbookSimulationPanel;

