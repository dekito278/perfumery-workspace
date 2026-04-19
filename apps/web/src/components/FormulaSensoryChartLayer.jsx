import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart.jsx';
import { formatGramAmount, formatPercentage } from '@/utils/formatting.js';
import { buildFormulaSensoryCharts } from '@/utils/formulaSensoryCharts.js';
import { Badge } from '@/components/ui/badge';

const ODOUR_CHART_CONFIG = {
  weight: {
    label: 'Weighted load',
    color: '#c77d24',
  },
};

const FAMILY_CHART_CONFIG = {
  weight: {
    label: 'Weighted load',
    color: '#166534',
  },
};

const DECAY_CHART_CONFIG = {
  top: {
    label: 'Top',
    color: '#0ea5e9',
  },
  middle: {
    label: 'Middle',
    color: '#f59e0b',
  },
  base: {
    label: 'Base',
    color: '#10b981',
  },
};

const FormulaSensoryChartLayer = ({
  items,
  rawMaterialsById,
  referenceLinksMap,
  className = '',
}) => {
  const charts = useMemo(() => buildFormulaSensoryCharts({
    items,
    rawMaterialsById,
    referenceLinksMap,
  }), [items, rawMaterialsById, referenceLinksMap]);

  if (!charts.simulation.linkedItemCount) {
    return null;
  }

  return (
    <div className={`grid gap-3 lg:grid-cols-2 ${className}`.trim()}>
      <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-background/70 p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Lead Facet</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="text-lg font-semibold">{charts.dominantFacet?.facet || '-'}</div>
            {charts.dominantFacet ? (
              <Badge variant="outline" className="text-[10px]">
                {formatPercentage(charts.dominantFacet.percent, 1)}
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            The strongest odour letter in the workbook-weighted profile.
          </div>
        </div>

        <div className="rounded-2xl border bg-background/70 p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Lead Family</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="text-lg font-semibold">{charts.dominantFamily?.family || '-'}</div>
            {charts.dominantFamily ? (
              <Badge variant="outline" className="text-[10px]">
                {formatPercentage(charts.dominantFamily.percent, 1)}
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            The family most represented by effective active load.
          </div>
        </div>

        <div className="rounded-2xl border bg-background/70 p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Opening Load</div>
          <div className="mt-2 text-lg font-semibold">
            {formatGramAmount(charts.openingProfile?.total || 0)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Total effective active material at the start of the decay curve.
          </div>
        </div>

        <div className="rounded-2xl border bg-background/70 p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Late Drydown</div>
          <div className="mt-2 text-lg font-semibold">
            {formatGramAmount(charts.finishProfile?.base || 0)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Remaining base load at {charts.finishProfile?.label || '-'}.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-background/70 p-4">
        <div className="mb-3">
          <div className="text-sm font-semibold">Odour facet chart</div>
          <div className="text-xs text-muted-foreground">
            Workbook odour letters weighted by effective active load.
          </div>
        </div>

        {charts.odourFacetData.length ? (
          <ChartContainer config={ODOUR_CHART_CONFIG} className="h-[250px] w-full">
            <RadarChart data={charts.odourFacetData} outerRadius="72%">
              <ChartTooltip
                cursor={false}
                content={(
                  <ChartTooltipContent
                    labelKey="facet"
                    formatter={(value, _name, item) => (
                      <div className="flex min-w-[10rem] items-center justify-between gap-3">
                        <span className="text-muted-foreground">{item.payload.facet}</span>
                        <span className="font-mono">{formatPercentage(item.payload.percent, 1)}</span>
                      </div>
                    )}
                  />
                )}
              />
              <PolarGrid />
              <PolarAngleAxis dataKey="facet" />
              <Radar
                dataKey="weight"
                stroke="var(--color-weight)"
                fill="var(--color-weight)"
                fillOpacity={0.3}
              />
            </RadarChart>
          </ChartContainer>
        ) : (
          <div className="rounded-xl border border-dashed px-4 py-8 text-sm text-muted-foreground">
            No odour facet data is linked yet for this formula.
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-background/70 p-4">
        <div className="mb-3">
          <div className="text-sm font-semibold">Family chart</div>
          <div className="text-xs text-muted-foreground">
            Weighted family spread derived from workbook facets and primary family tags.
          </div>
        </div>

        {charts.familyData.length ? (
          <ChartContainer config={FAMILY_CHART_CONFIG} className="h-[250px] w-full">
            <BarChart data={charts.familyData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="family"
                width={88}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip
                cursor={false}
                content={(
                  <ChartTooltipContent
                    labelKey="family"
                    formatter={(value, _name, item) => (
                      <div className="flex min-w-[10rem] items-center justify-between gap-3">
                        <span className="text-muted-foreground">{item.payload.family}</span>
                        <span className="font-mono">{formatPercentage(item.payload.percent, 1)}</span>
                      </div>
                    )}
                  />
                )}
              />
              <Bar dataKey="weight" radius={8} fill="var(--color-weight)" />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="rounded-xl border border-dashed px-4 py-8 text-sm text-muted-foreground">
            No family distribution is available yet.
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-background/70 p-4 lg:col-span-2">
        <div className="mb-3">
          <div className="text-sm font-semibold">Top / middle / base decay</div>
          <div className="text-xs text-muted-foreground">
            Simple workbook decay curve based on effective active load and linked life-hours.
          </div>
        </div>

        <ChartContainer config={DECAY_CHART_CONFIG} className="h-[280px] w-full">
          <AreaChart data={charts.decayData} margin={{ left: 8, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatGramAmount(value)}
            />
            <ChartTooltip
              content={(
                <ChartTooltipContent
                  labelKey="label"
                  formatter={(value, name) => (
                    <div className="flex min-w-[10rem] items-center justify-between gap-3">
                      <span className="text-muted-foreground capitalize">{name}</span>
                      <span className="font-mono">{formatGramAmount(Number(value || 0))}</span>
                    </div>
                  )}
                />
              )}
            />
            <Area type="monotone" dataKey="top" stackId="decay" stroke="var(--color-top)" fill="var(--color-top)" fillOpacity={0.45} />
            <Area type="monotone" dataKey="middle" stackId="decay" stroke="var(--color-middle)" fill="var(--color-middle)" fillOpacity={0.45} />
            <Area type="monotone" dataKey="base" stackId="decay" stroke="var(--color-base)" fill="var(--color-base)" fillOpacity={0.45} />
          </AreaChart>
        </ChartContainer>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <div className="rounded-xl bg-sky-500/10 px-3 py-2 text-xs text-sky-900">
            Opening top notes fade fastest, so use this as a quick read on lift rather than persistence.
          </div>
          <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-900">
            Middle notes usually anchor the heart between the first impression and drydown.
          </div>
          <div className="rounded-xl bg-emerald-600/10 px-3 py-2 text-xs text-emerald-900">
            Base-heavy formulas should keep more mass toward the right side of the decay chart.
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormulaSensoryChartLayer;
