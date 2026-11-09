import React, { useMemo, useState } from 'react';
import { AlertTriangle, FlaskConical, GitBranch, Info, Radio, Sparkles, TimerReset } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { formatPercentage, formatQuantity } from '@/utils/formatting.js';
import { buildWorkbookSimulation } from '@/utils/formulaWorkbookSimulation.js';
import { pyramidPlacementBlindSpot } from '@/utils/pyramidPlacementConfidence.js';
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
import FormulaPlacementBlindSpotNotice from '@/components/FormulaPlacementBlindSpotNotice.jsx';
import { SCORE_BANDS, getScoreBand } from '@/utils/paceScoreBands.js';

const formatHours = (value) => {
  if (value === null || value === undefined) {
    return '-';
  }

  return `${formatQuantity(value, 1)} jam`;
};

// Keyed by the card label, which is the engine's own axis name (formulaWorkbookSimulation.js `scores`).
const PACE_METRIC_HELP = {
  Pembuka: 'Seberapa hidup dan terasa kesan pertamanya.',
  Inti: 'Seberapa banyak badan dan karakter yang tersisa setelah pembuka mereda.',
  'Jejak akhir': 'Seberapa meyakinkan dan hadir kesan tahap akhirnya.',
  Pancaran: 'Seberapa jauh formula memancar dari kulit atau blotter.',
  Ketahanan: 'Seberapa lama formula bertahan.',
  Harmoni: 'Seberapa menyatu bahan-bahannya, bukan saling bertabrakan.',
  Kehalusan: 'Seberapa lembut dan mulus perpindahan antarfasenya.',
  Transisi: 'Seberapa alami formula berpindah dari nada atas ke tengah lalu ke dasar.',
  'Atas -> Inti': 'Seberapa mulus pembuka berpindah ke bagian tengah.',
  'Inti -> Dasar': 'Seberapa mulus inti berlanjut ke jejak akhir.',
  'Ragam penyumbang': 'Seberapa merata formula ditopang, bukan bertumpu pada satu bahan dominan.',
  'Keseimbangan piramida': 'Seberapa dekat formula ke struktur nada atas / tengah / dasar yang seimbang.',
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
        <span className="text-muted-foreground">Penilaian</span>
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
    <div className="text-[11px] text-muted-foreground">{formatQuantity(amount, 2)} beban berbobot aroma</div>
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
              {row.referenceCode || 'panduan manual'}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono font-semibold">{formatPercentage(row.effectivePercentage, 1)}</div>
            <div className="text-[11px] text-muted-foreground">efektif</div>
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
  title = 'Analisis PACE',
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
  // The top/middle/base bars below are sums over per-material placements, and 223 of the studio's 774
  // materials have no stated placement — see pyramidPlacementConfidence.js.
  const placementBlindSpot = useMemo(() => pyramidPlacementBlindSpot(simulation.rows), [simulation.rows]);
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
            {simulation.guidanceBackedCount}/{simulation.eligibleItemCount} berpanduan
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
            label="Belum ada"
            value={simulation.missingGuidanceCount}
            toneClass="border-slate-200 bg-slate-50 text-slate-700"
          />
          {/* Where the panel used to print "Prohibited by IFRA" over materials whose profile simply had
              no limit recorded (bergamot among them). The gap stays visible; the accusation is gone. */}
          <SourceBadge
            label="IFRA belum tercatat"
            value={simulation.unknownIfraLimitCount || 0}
            toneClass={simulation.unknownIfraLimitCount ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}
          />
          <SourceBadge
            label="Peringatan PACE"
            value={simulation.pace.warningCount}
            toneClass={simulation.pace.warningCount ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}
          />
        </div>
        <div className="mt-3 grid gap-2.5 md:grid-cols-3">
          <MetricCard
            label="Keseimbangan"
            value={formatQuantity(objectives.balance, 0)}
            tone={scoreTone(objectives.balance)}
            score={objectives.balance}
          />
          <MetricCard
            label="Pancaran"
            value={formatQuantity(objectives.projection, 0)}
            tone={scoreTone(objectives.projection)}
            score={objectives.projection}
          />
          <MetricCard
            label="Ketahanan"
            value={formatQuantity(objectives.longevity, 0)}
            tone={scoreTone(objectives.longevity)}
            score={objectives.longevity}
          />
        </div>
        <div className="mt-3 rounded-[1rem] border border-[#e6deca] bg-white/70 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7e6c42]">
                Prioritas rekomendasi
              </div>
              <div className="mt-1 text-sm text-[#5f5239]">
                Saran PACE saat ini mengutamakan <span className="font-semibold">{activePriorityMode.shortLabel.toLowerCase()}</span>.
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
            Papan PACE
          </div>
          {simulation.pace.strongestAxis ? (
            <Badge variant="secondary" className="rounded-full px-2.5 text-[10px]">
              Terkuat: {simulation.pace.strongestAxis.label}
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
            label="Pembuka"
            value={formatQuantity(simulation.pace.openingScore, 0)}
            tone={scoreTone(simulation.pace.openingScore)}
            score={simulation.pace.openingScore}
          />
          <MetricCard
            label="Inti"
            value={formatQuantity(simulation.pace.heartScore, 0)}
            tone={scoreTone(simulation.pace.heartScore)}
            score={simulation.pace.heartScore}
          />
          <MetricCard
            label="Jejak akhir"
            value={formatQuantity(simulation.pace.drydownScore, 0)}
            tone={scoreTone(simulation.pace.drydownScore)}
            score={simulation.pace.drydownScore}
          />
          <MetricCard
            label="Pancaran"
            value={formatQuantity(simulation.pace.diffusionScore, 0)}
            tone={scoreTone(simulation.pace.diffusionScore)}
            score={simulation.pace.diffusionScore}
          />
          <MetricCard
            label="Ketahanan"
            value={formatQuantity(simulation.pace.tenacityScore, 0)}
            tone={scoreTone(simulation.pace.tenacityScore)}
            score={simulation.pace.tenacityScore}
          />
          <MetricCard
            label="Harmoni"
            value={formatQuantity(simulation.pace.harmonyScore, 0)}
            tone={scoreTone(simulation.pace.harmonyScore)}
            score={simulation.pace.harmonyScore}
          />
          <MetricCard
            label="Kehalusan"
            value={formatQuantity(simulation.pace.smoothnessScore, 0)}
            tone={scoreTone(simulation.pace.smoothnessScore)}
            score={simulation.pace.smoothnessScore}
          />
          <MetricCard
            label="Transisi"
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
              Diagnosis transisi
            </div>
            {simulation.pace.weakestAxis ? (
              <Badge variant="outline" className="rounded-full px-2.5 text-[10px]">
                Pantau: {simulation.pace.weakestAxis.label}
              </Badge>
            ) : null}
          </div>
          <div className="grid gap-2.5 md:grid-cols-2">
            <MetricCard
              label="Atas -> Inti"
              value={formatQuantity(simulation.pace.topMiddleBridgeScore, 0)}
              tone={scoreTone(simulation.pace.topMiddleBridgeScore)}
              score={simulation.pace.topMiddleBridgeScore}
            />
            <MetricCard
              label="Inti -> Dasar"
              value={formatQuantity(simulation.pace.middleBaseBridgeScore, 0)}
              tone={scoreTone(simulation.pace.middleBaseBridgeScore)}
              score={simulation.pace.middleBaseBridgeScore}
            />
            <MetricCard
              label="Ragam penyumbang"
              value={formatQuantity(simulation.pace.contributorDiversityScore, 0)}
              tone={scoreTone(simulation.pace.contributorDiversityScore)}
              score={simulation.pace.contributorDiversityScore}
            />
            <MetricCard
              label="Keseimbangan piramida"
              value={formatQuantity(simulation.pace.balanceScore, 0)}
              tone={scoreTone(simulation.pace.balanceScore)}
              score={simulation.pace.balanceScore}
            />
          </div>
          {simulation.pace.dominantClass ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Kelas dominan saat ini: <span className="font-medium text-foreground">{simulation.pace.dominantClass.familyName}</span>,{' '}
              {formatPercentage(simulation.pace.dominantClass.sharePercent, 1)} dari beban kelas berbobot aroma.
            </p>
          ) : null}
        </div>

        <div className="rounded-[1.2rem] border bg-background/70 p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Radio className="h-4 w-4 text-muted-foreground" />
              Jangkar fase
            </div>
            <Badge variant="outline" className="rounded-full px-2.5 text-[10px]">
              Disusun dari baris berpanduan
            </Badge>
          </div>
          <div className="space-y-3">
            <ContributorList
              title="Jangkar pembuka"
              rows={simulation.pace.openingContributors}
              emptyLabel="Belum ada penyumbang nada atas."
            />
            <ContributorList
              title="Jangkar inti"
              rows={simulation.pace.heartContributors}
              emptyLabel="Belum ada penyumbang nada tengah."
            />
            <ContributorList
              title="Jangkar jejak akhir"
              rows={simulation.pace.drydownContributors}
              emptyLabel="Belum ada penyumbang nada dasar."
            />
          </div>
        </div>
      </div>

      {paceRecommendations.length ? (
        <div className="rounded-[1.2rem] border bg-background/70 p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Saran revisi</div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full px-2.5 text-[10px]">
                Perubahan gram skala uji
              </Badge>
              <Badge variant="secondary" className="rounded-full px-2.5 text-[10px]">
                Prioritas {activePriorityMode.shortLabel.toLowerCase()}
              </Badge>
              {onCreatePacedRevision ? (
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full px-3"
                  onClick={() => onCreatePacedRevision(paceRecommendations, resolvedPriorityMode)}
                  disabled={isCreatingPacedRevision}
                >
                  {isCreatingPacedRevision ? 'Membuat revisi PACED...' : 'Buat revisi PACED'}
                </Button>
              ) : null}
            </div>
          </div>
          <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">
            Ini saran gram tahap awal untuk batch uji berikutnya. Terapkan satu atau dua perubahan sekaligus, lalu cek ulang PACE dan catatan uji.
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
                      {recommendation.recommendationKind === 'cleanup_move' ? 'Langkah perapian' : 'Penambahan aman'}
                    </Badge>
                    {recommendation.objective ? (
                      <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">
                        {getPacePriorityModeMeta(recommendation.objective).shortLabel}
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
                    Strategi: {recommendation.strategyLabel}
                  </div>
                ) : null}
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-[0.85rem] border bg-background/80 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Saat ini</div>
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
                      Terapkan
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-[1.2rem] border bg-background/70 p-3.5">
          <div className="mb-2 text-sm font-semibold">Saran revisi</div>
          <Alert className="rounded-[1rem] border-border/80 bg-background/85 px-3.5 py-3 text-[13px] [&>svg]:left-3.5 [&>svg]:top-3.5 [&>svg~*]:pl-6">
            <Info className="h-3.5 w-3.5" />
            <AlertTitle className="mb-1 text-[13px] font-semibold">PACE cukup stabil, revisi bisa ditunda</AlertTitle>
            <AlertDescription className="text-[12px] leading-relaxed text-muted-foreground">
              Formula ini sudah di rentang PACE yang sehat, jadi papan ini sengaja tidak mendorong perubahan gram lagi. Sekarang uji di blotter atau kulit lebih berguna daripada mengejar kenaikan skor.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Cakupan acuan"
          value={formatPercentage(simulation.coveragePercent, 0)}
        />
        <MetricCard
          label="Perkiraan kekuatan"
          value={simulation.hasImpactData ? formatQuantity(simulation.impactEstimate, 1) : '-'}
          tone="accent"
        />
        <MetricCard
          label="Ketahanan sederhana"
          value={simulation.hasLifeData ? formatHours(simulation.simpleLifeHours) : '-'}
        />
        <MetricCard
          label="Ketahanan berbobot aroma"
          value={formatHours(simulation.odourWeightedLifeHours)}
        />
      </div>

      <div className="rounded-[1.2rem] border bg-background/70 p-3.5">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">Keseimbangan nada atas / tengah / dasar</div>
          <TimerReset className="h-4 w-4 text-muted-foreground" />
        </div>
        <FormulaPlacementBlindSpotNotice blindSpot={placementBlindSpot} className="mb-3" />
        <div className="grid gap-3 md:grid-cols-3">
          <BalanceBar label="Nada atas" percentage={simulation.topPercent} amount={simulation.topAmount} toneClass="bg-sky-500" />
          <BalanceBar label="Nada tengah" percentage={simulation.middlePercent} amount={simulation.middleAmount} toneClass="bg-amber-500" />
          <BalanceBar label="Nada dasar" percentage={simulation.basePercent} amount={simulation.baseAmount} toneClass="bg-emerald-600" />
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
            <div className="text-sm font-semibold">Peringatan dan kendala panduan</div>
            <Badge variant={simulation.pace.warningCount ? 'destructive' : 'secondary'} className="rounded-full px-2.5 text-[10px]">
              {simulation.pace.warningCount} peringatan
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
                <AlertTitle className="mb-1 text-[13px] font-semibold">Tidak ada kendala PACE yang berarti</AlertTitle>
                <AlertDescription className="text-[12px] leading-relaxed text-muted-foreground">
                  Formula ini cukup tersambung antarfase, tanpa peringatan beban berlebih atau bentrokan dari baris berpanduan.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <div className="rounded-[1.2rem] border bg-background/70 p-3.5">
          <div className="mb-2.5 text-sm font-semibold">Penyumbang kekuatan utama</div>
          <div className="space-y-3">
            {simulation.topImpactContributors.length ? simulation.topImpactContributors.map((row) => (
              <div key={`${row.item_id}-${row.reference_profile?.reference_code || row.name}`} className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{row.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {row.reference_profile?.reference_code || 'profil terhubung'}
                      {' / '}
                      {row.guidanceSource === 'raw_material_fallback' ? 'panduan manual' : 'terhubung ke workbook'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{formatQuantity(row.impactContribution, 1)}</div>
                    <div className="text-[11px] text-muted-foreground">{formatPercentage(row.effectivePercentage, 2)} efektif</div>
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
                Belum ada penyumbang kekuatan. Hubungkan profil acuan workbook ke bahan yang dipilih dulu.
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

