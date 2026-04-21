import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts';
import { AlertTriangle, BarChart3, ChevronDown, Pause, PieChartIcon, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart.jsx';
import { buildFormulaSensoryCharts } from '@/utils/formulaSensoryCharts.js';
import { formatPercentage, formatQuantity } from '@/utils/formatting.js';

const CHART_CONFIG = {
  weight: {
    label: 'Weighted load',
    color: '#b8691d',
  },
};

const formatHours = (value) => {
  if (value === null || value === undefined) {
    return '-';
  }

  return `${formatQuantity(value, 1)} h`;
};

const MetricCard = ({ label, value }) => (
  <div className="rounded-2xl border border-[#ddd3bf] bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(250,246,236,0.98)_100%)] p-4 shadow-sm">
    <div className="text-[11px] uppercase tracking-[0.16em] text-[#7e7153]">{label}</div>
    <div className="mt-2 text-xl font-semibold text-[#3c3222]">{value}</div>
  </div>
);

const SourcePill = ({ label, value, className }) => (
  <div className={`rounded-full border px-3 py-1 text-[11px] font-medium ${className}`}>
    {label}: {value}
  </div>
);

const BalanceRow = ({ label, value, toneClass }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="font-medium">{label}</span>
      <span className="font-mono">{formatPercentage(value, 1)}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-muted/60">
      <div
        className={`h-full rounded-full ${toneClass}`}
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  </div>
);

const DisplayToggle = ({ active, icon: Icon, label, onClick }) => (
  <Button
    type="button"
    variant={active ? 'default' : 'outline'}
    size="sm"
    onClick={onClick}
    className={`h-8 rounded-full px-3 ${active ? 'shadow-sm' : 'bg-white/70'}`}
  >
    <Icon className="h-3.5 w-3.5" />
    {label}
  </Button>
);

const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeArc = (centerX, centerY, radius, startAngle, endAngle) => {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
};

const buildWorkbookPieSlices = (data) => {
  let cursor = -90;

  return data.map((entry) => {
    const span = (Number(entry.percent || 0) / 100) * 360;
    const startAngle = cursor;
    const endAngle = cursor + span;
    cursor = endAngle;

    return {
      ...entry,
      startAngle,
      endAngle,
      midAngle: startAngle + span / 2,
    };
  });
};

const WorkbookPieChart = ({
  data,
  elapsedHour,
  maxElapsedHour,
  impactEstimate,
  simpleLifeHours,
  hasImpactData,
  hasLifeData,
}) => {
  const width = 420;
  const height = 360;
  const centerX = 208;
  const centerY = 176;
  const radius = 112;
  const labelRadius = 144;
  const slices = buildWorkbookPieSlices(data);
  const dominantSlice = slices[0] || null;
  const arcStart = dominantSlice ? dominantSlice.midAngle - 58 : -140;
  const arcEnd = dominantSlice ? dominantSlice.midAngle + 74 : 60;

  return (
    <div
      data-testid="odour-display-chart"
      className="overflow-hidden rounded-[22px] border border-[#ddd3bf] bg-[#fffdf8] p-2"
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
        <g>
          {slices.map((slice) => {
            const start = polarToCartesian(centerX, centerY, radius, slice.startAngle);
            const end = polarToCartesian(centerX, centerY, radius, slice.endAngle);
            const largeArcFlag = slice.endAngle - slice.startAngle > 180 ? 1 : 0;
            const path = [
              `M ${centerX} ${centerY}`,
              `L ${start.x} ${start.y}`,
              `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
              'Z',
            ].join(' ');

            const labelStart = polarToCartesian(centerX, centerY, radius + 2, slice.midAngle);
            const labelBend = polarToCartesian(centerX, centerY, labelRadius - 16, slice.midAngle);
            const labelEnd = polarToCartesian(centerX, centerY, labelRadius + 10, slice.midAngle);
            const labelBoxX = labelEnd.x + (labelEnd.x >= centerX ? 2 : -18);
            const labelBoxY = labelEnd.y - 7;

            return (
              <g key={slice.classIndex}>
                <path d={path} fill={slice.color} stroke="#b8af9e" strokeWidth="1" />
                <path
                  d={`M ${labelStart.x} ${labelStart.y} L ${labelBend.x} ${labelBend.y} L ${labelEnd.x} ${labelEnd.y}`}
                  fill="none"
                  stroke="#7b725f"
                  strokeWidth="1.15"
                />
                <rect
                  x={labelBoxX}
                  y={labelBoxY}
                  width="16"
                  height="14"
                  rx="3"
                  fill="#fffdf8"
                  stroke="#7b725f"
                  strokeWidth="1"
                />
                <text
                  x={labelBoxX + 8}
                  y={labelBoxY + 9.6}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill="#403522"
                >
                  {slice.letter || '?'}
                </text>
              </g>
            );
          })}

          <path
            d={describeArc(centerX - 18, centerY - 20, 32, arcStart, arcEnd)}
            fill="none"
            stroke="#17130d"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </g>

        <g transform={`translate(20 ${height - 24})`}>
          <text fontSize="10.5" fill="#5a5140">Impact: {hasImpactData ? formatQuantity(impactEstimate || 0, 0) : '-'}</text>
          <text x="126" fontSize="10.5" fill="#5a5140">Life: {hasLifeData ? `${formatQuantity(simpleLifeHours || 0, 0)} hours` : '-'}</text>
          <text x="282" fontSize="10.5" fill="#5a5140">AutoElapse: {formatQuantity(elapsedHour, 2)}</text>
        </g>
      </svg>
    </div>
  );
};

const FormulaOdourDisplayPanel = ({
  items,
  rawMaterialsById,
  referenceLinksMap,
  className = '',
  isVisible = true,
}) => {
  const [displayMode, setDisplayMode] = useState('pie');
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [balanceExpanded, setBalanceExpanded] = useState(false);
  const [elapsedHour, setElapsedHour] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [chartRenderVersion, setChartRenderVersion] = useState(0);
  const charts = useMemo(() => buildFormulaSensoryCharts({
    items,
    rawMaterialsById,
    referenceLinksMap,
  }), [items, rawMaterialsById, referenceLinksMap]);

  useEffect(() => {
    setElapsedHour((current) => Math.min(current, charts.maxElapsedHour || 0));
  }, [charts.maxElapsedHour]);

  useEffect(() => {
    if (!isAutoPlaying || !charts.maxElapsedHour) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setElapsedHour((current) => {
        if (current >= charts.maxElapsedHour) {
          setIsAutoPlaying(false);
          return charts.maxElapsedHour;
        }

        return Math.min(current + 1, charts.maxElapsedHour);
      });
    }, 280);

    return () => window.clearInterval(interval);
  }, [isAutoPlaying, charts.maxElapsedHour]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isVisible) {
      return undefined;
    }

    const rafId = window.requestAnimationFrame(() => {
      setChartRenderVersion((current) => current + 1);
      window.dispatchEvent(new Event('resize'));
    });
    const timeoutId = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 180);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [isVisible, displayMode]);

  const roundedElapsedHour = Math.min(
    Math.max(Math.round(Number(elapsedHour) || 0), 0),
    charts.maxElapsedHour || 0,
  );
  const elapsedClassDistribution = charts.classDistributionTimeline?.[roundedElapsedHour]?.classes
    || charts.classDistributionData;
  const odourData = elapsedClassDistribution.slice(0, 12);
  const dominantElapsedClass = odourData[0] || null;
  const elapsedDecayPoint = (charts.decayTimeline || charts.decayData || []).reduce((closest, entry) => {
    if (!closest) {
      return entry;
    }

    return Math.abs(entry.hour - roundedElapsedHour) < Math.abs(closest.hour - roundedElapsedHour)
      ? entry
      : closest;
  }, null);
  const hasGuidanceChartData = charts.simulation.guidanceBackedCount > 0;
  const leadFacetLabel = 'Lead class';
  const elapsedTotalLoad = odourData.reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
  const elapsedStageShares = elapsedDecayPoint && elapsedDecayPoint.total > 0
    ? {
        top: (elapsedDecayPoint.top / elapsedDecayPoint.total) * 100,
        middle: (elapsedDecayPoint.middle / elapsedDecayPoint.total) * 100,
        base: (elapsedDecayPoint.base / elapsedDecayPoint.total) * 100,
      }
    : { top: 0, middle: 0, base: 0 };
  const elapsedStageLabel = elapsedStageShares.top >= elapsedStageShares.middle && elapsedStageShares.top >= elapsedStageShares.base
    ? 'Top'
    : elapsedStageShares.base >= elapsedStageShares.middle
      ? 'Base'
      : 'Middle';
  const workbookWarningSummary = useMemo(() => {
    const eligibleRows = charts.simulation.rows || [];
    const missingGuidanceRows = eligibleRows.filter((row) => !row.reference_profile);
    const missingImpactRows = eligibleRows.filter((row) => row.reference_profile && row.impact === null);
    const missingLifeRows = eligibleRows.filter((row) => row.reference_profile && row.lifeHours === null);
    const missingClassRows = eligibleRows.filter((row) => row.reference_profile && (!row.classDistribution || row.classDistribution.length === 0));

    return {
      missingGuidanceRows,
      missingImpactRows,
      missingLifeRows,
      missingClassRows,
      hasWarnings:
        missingGuidanceRows.length > 0
        || missingImpactRows.length > 0
        || missingLifeRows.length > 0
        || missingClassRows.length > 0,
    };
  }, [charts.simulation.rows]);

  return (
    <aside className={`space-y-4 ${className}`.trim()}>
      <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white/90 shadow-sm">
        <div className="border-b border-[#d7cfbf] bg-[linear-gradient(135deg,#f7f1e1_0%,#efe5ca_52%,#f7f4ec_100%)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e6c42]">
                Workbook
              </div>
              <h2 className="mt-1 text-xl font-semibold text-[#3d3422]">Graphic odour display</h2>
            </div>
            <Badge variant="outline" className="border-[#c9bb94] bg-white/80 text-[10px] text-[#6c5d36]">
              {charts.simulation.guidanceBackedCount}/{charts.simulation.eligibleItemCount} guidance-backed materials
            </Badge>
          </div>
        </div>

        <div className="p-5">
          <div>
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <DisplayToggle
                active={displayMode === 'pie'}
                icon={PieChartIcon}
                label="Pie"
                onClick={() => setDisplayMode('pie')}
              />
              <DisplayToggle
                active={displayMode === 'bar'}
                icon={BarChart3}
                label="Bar"
                onClick={() => setDisplayMode('bar')}
              />
              <div className="rounded-full border border-dashed border-[#d6c8a2] bg-[#faf6ea] px-3 py-1 text-[11px] font-medium text-[#7a6a3b] sm:ml-auto">
                {leadFacetLabel} {dominantElapsedClass?.familyName || charts.dominantClass?.familyName || '-'}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <SourcePill
                label="Workbook link"
                value={charts.simulation.linkedProfileCount}
                className="border-emerald-200 bg-emerald-50 text-emerald-900"
              />
              <SourcePill
                label="Manual guidance"
                value={charts.simulation.fallbackGuidanceCount}
                className="border-amber-200 bg-amber-50 text-amber-950"
              />
              <SourcePill
                label="Missing"
                value={charts.simulation.missingGuidanceCount}
                className="border-slate-200 bg-slate-50 text-slate-700"
              />
            </div>

            {workbookWarningSummary.hasWarnings ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                  <span>
                    Beberapa material masih kurang data workbook. Impact, life, pie, dan bar bisa belum akurat.
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {hasGuidanceChartData ? (
            <div className="mt-5 rounded-[24px] border border-[#dbd2bc] bg-[radial-gradient(circle_at_top,#fffdf7_0%,#fbf7ec_48%,#f2ebda_100%)] p-4">
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#ddd3bf] bg-white/78 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <div
                      data-testid="autoelapse-chip"
                      data-elapsed-hour={roundedElapsedHour}
                      className="rounded-full border border-[#ded3be] bg-[#f8f3e7] px-3 py-1 text-[11px] font-medium text-[#6d6043]"
                    >
                      AutoElapse {formatQuantity(roundedElapsedHour, 0)} h
                    </div>
                    <div className="rounded-full border border-[#d7e1cd] bg-[#f3f8ee] px-3 py-1 text-[11px] font-medium text-[#496033]">
                      Stage {elapsedStageLabel}
                    </div>
                    <div className="rounded-full border border-[#d6ddee] bg-[#f4f7fd] px-3 py-1 text-[11px] font-medium text-[#49587b]">
                      Load {formatQuantity(elapsedTotalLoad, 2)}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-full px-3 sm:ml-auto"
                      onClick={() => {
                        if (roundedElapsedHour >= (charts.maxElapsedHour || 0)) {
                          setElapsedHour(0);
                        }
                        setIsAutoPlaying((current) => !current);
                      }}
                    >
                      {isAutoPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      {isAutoPlaying ? 'Pause' : 'Play'}
                    </Button>
                  </div>
                  <div className="mt-3">
                    <input
                      data-testid="autoelapse-slider"
                      type="range"
                      min="0"
                      max={charts.maxElapsedHour || 0}
                      step="1"
                      value={roundedElapsedHour}
                      onChange={(event) => {
                        setIsAutoPlaying(false);
                        setElapsedHour(Number(event.target.value || 0));
                      }}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e8deca]"
                    />
                    <div className="mt-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.14em] text-[#7f7257]">
                      <span>0h</span>
                      <span>{formatQuantity(charts.maxElapsedHour || 0, 0)}h</span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl bg-sky-500/10 px-3 py-2 text-[11px] text-sky-950">
                      Top {formatPercentage(elapsedStageShares.top, 1)}
                    </div>
                    <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-950">
                      Middle {formatPercentage(elapsedStageShares.middle, 1)}
                    </div>
                    <div className="rounded-xl bg-emerald-600/10 px-3 py-2 text-[11px] text-emerald-950">
                      Base {formatPercentage(elapsedStageShares.base, 1)}
                    </div>
                  </div>
                </div>
                {displayMode === 'pie' ? (
                  <WorkbookPieChart
                    data={odourData}
                    elapsedHour={roundedElapsedHour}
                    maxElapsedHour={charts.maxElapsedHour}
                    impactEstimate={charts.simulation.impactEstimate}
                    simpleLifeHours={charts.simulation.simpleLifeHours}
                    hasImpactData={charts.simulation.hasImpactData}
                    hasLifeData={charts.simulation.hasLifeData}
                  />
                ) : (
                  <ChartContainer
                    key={`odour-display-chart-${displayMode}-${chartRenderVersion}`}
                    config={CHART_CONFIG}
                    className="aspect-auto h-[240px] min-h-[240px] w-full sm:h-[360px] sm:min-h-[360px]"
                    data-testid="odour-display-chart"
                  >
                    <BarChart data={[...odourData].reverse()} layout="vertical" margin={{ left: 8, right: 16, top: 6, bottom: 6 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="letter"
                        width={32}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ChartTooltip
                        content={(
                          <ChartTooltipContent
                            hideLabel
                            formatter={(_value, _name, item) => (
                              <div className="min-w-[14rem] space-y-1">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground">{item.payload.familyName}</span>
                                  <span className="font-mono">{formatPercentage(item.payload.percent, 1)}</span>
                                </div>
                              </div>
                            )}
                          />
                        )}
                      />
                      <Bar dataKey="weight" radius={10}>
                        {[...odourData].reverse().map((entry) => (
                          <Cell key={entry.classIndex} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}

                <div className="rounded-2xl border border-[#ddd3bf] bg-white/78 p-3">
                  <button
                    type="button"
                    onClick={() => setLegendExpanded((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7a6a4a]">
                      Workbook class distribution
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${legendExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {legendExpanded ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {odourData.map((entry) => (
                        <div key={entry.classIndex} className="rounded-xl border border-[#e7decb] bg-white/80 p-3 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  className="h-3 w-3 rounded-sm"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span className="font-medium">{entry.familyName}</span>
                                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                  {entry.letter}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono text-xs">{formatPercentage(entry.percent, 1)}</div>
                              <div className="font-mono text-[10px] text-muted-foreground">{formatQuantity(entry.weight, 2)}</div>
                            </div>
                          </div>
                          {entry.contributors?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {entry.contributors.map((contributor) => (
                                <Badge
                                  key={`${entry.classIndex}-${contributor.name}-${contributor.referenceCode || 'ref'}`}
                                  variant="outline"
                                  className="rounded-full text-[10px]"
                                >
                                  {contributor.name}
                                  {' / '}
                                  {formatQuantity(contributor.weight, 2)}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 rounded-2xl border border-[#ddd3bf] bg-white/72 p-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-[#faf3dd] px-3 py-2" data-testid="dominant-class-card">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#88734a]">
                    Dominant class
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[#433821]">
                    {dominantElapsedClass?.familyName || charts.dominantClass?.familyName || '-'}
                    </div>
                    <div className="mt-1 text-[11px] text-[#7f7157]">
                    {dominantElapsedClass?.description || charts.dominantClass?.description || 'No workbook class data yet'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#f1f6ea] px-3 py-2" data-testid="elapsed-load-card">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5d7542]">
                    Elapsed load
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[#31451f]" data-testid="elapsed-load-value">
                    {formatQuantity(elapsedTotalLoad, 2)}
                    </div>
                    <div className="mt-1 text-[11px] text-[#607350]" data-testid="elapsed-load-hint">
                    AutoElapse {formatQuantity(roundedElapsedHour, 0)} h of {formatQuantity(charts.maxElapsedHour || 0, 0)} h
                    </div>
                  </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed bg-background/70 px-4 py-8 text-sm text-muted-foreground">
              No workbook data yet.
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div data-testid="impact-card">
              <MetricCard
              label="Impact"
              value={charts.simulation.hasImpactData ? formatQuantity(charts.simulation.impactEstimate, 1) : '-'}
              />
            </div>
            <div data-testid="life-card">
              <MetricCard
              label="Life"
              value={charts.simulation.hasLifeData ? formatHours(charts.simulation.simpleLifeHours) : '-'}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-[#ddd3bf] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,246,239,0.98)_100%)] p-5 shadow-sm">
        <button
          type="button"
          onClick={() => setBalanceExpanded((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div className="text-sm font-semibold text-[#3c3222]">Balance preview</div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="border border-[#ded3be] bg-[#f5efde] text-[10px] text-[#6f623f]">
              {charts.dominantClass?.familyName || charts.dominantFamily?.family || 'No class'}
            </Badge>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${balanceExpanded ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {balanceExpanded ? (
          <>
            <div className="mt-4 space-y-3">
              <BalanceRow label="Top" value={charts.simulation.topPercent} toneClass="bg-sky-500" />
              <BalanceRow label="Middle" value={charts.simulation.middlePercent} toneClass="bg-amber-500" />
              <BalanceRow label="Base" value={charts.simulation.basePercent} toneClass="bg-emerald-600" />
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
};

export default FormulaOdourDisplayPanel;

