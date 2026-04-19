import React, { useMemo, useState } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { BarChart3, ChevronDown, PieChartIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart.jsx';
import { buildFormulaSensoryCharts } from '@/utils/formulaSensoryCharts.js';
import { formatGramAmount, formatPercentage, formatQuantity } from '@/utils/formatting.js';

const ODOUR_PIE_COLORS = [
  '#b8691d',
  '#cdc4ad',
  '#998c2f',
  '#d9d300',
  '#666633',
  '#dfdfdf',
  '#ea00c4',
  '#26e626',
  '#168341',
  '#31c7a1',
  '#4b4fd1',
  '#dac8ff',
];

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

const MetricCard = ({ label, value, hint }) => (
  <div className="rounded-2xl border border-[#ddd3bf] bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(250,246,236,0.98)_100%)] p-4 shadow-sm">
    <div className="text-[11px] uppercase tracking-[0.16em] text-[#7e7153]">{label}</div>
    <div className="mt-2 text-xl font-semibold text-[#3c3222]">{value}</div>
    {hint ? <div className="mt-1 text-xs text-[#776c56]">{hint}</div> : null}
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

const FormulaOdourDisplayPanel = ({ items, rawMaterialsById, referenceLinksMap, className = '' }) => {
  const [displayMode, setDisplayMode] = useState('pie');
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [balanceExpanded, setBalanceExpanded] = useState(false);
  const charts = useMemo(() => buildFormulaSensoryCharts({
    items,
    rawMaterialsById,
    referenceLinksMap,
  }), [items, rawMaterialsById, referenceLinksMap]);

  const odourData = charts.odourFacetData.slice(0, 12).map((entry, index) => ({
    ...entry,
    fill: ODOUR_PIE_COLORS[index % ODOUR_PIE_COLORS.length],
  }));
  const hasLinkedData = charts.simulation.linkedItemCount > 0;

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
              <p className="mt-1.5 text-sm text-[#6f6550]">
                Tampilan utama untuk baca komposisi odour secara cepat saat formula disusun.
              </p>
            </div>
            <Badge variant="outline" className="border-[#c9bb94] bg-white/80 text-[10px] text-[#6c5d36]">
              {charts.simulation.linkedItemCount}/{charts.simulation.eligibleItemCount} linked
            </Badge>
          </div>
        </div>

        <div className="p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
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
              <div className="ml-auto rounded-full border border-dashed border-[#d6c8a2] bg-[#faf6ea] px-3 py-1 text-[11px] font-medium text-[#7a6a3b]">
                Lead facet {charts.dominantFacet?.facet || '-'}
              </div>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              Kategori odour ditarik dari workbook-linked raw material, lalu dijumlahkan berdasarkan effective active load.
            </p>
          </div>

          {hasLinkedData ? (
            <div className="mt-5 rounded-[24px] border border-[#dbd2bc] bg-[radial-gradient(circle_at_top,#fffdf7_0%,#fbf7ec_48%,#f2ebda_100%)] p-4">
              <div className="space-y-4">
                <ChartContainer config={CHART_CONFIG} className="h-[360px] w-full">
                  {displayMode === 'pie' ? (
                    <PieChart>
                      <Pie
                        data={odourData}
                        dataKey="weight"
                        nameKey="facet"
                        innerRadius={0}
                        outerRadius={132}
                        paddingAngle={1}
                        strokeWidth={0}
                      >
                        {odourData.map((entry) => (
                          <Cell key={entry.facet} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartTooltip
                        content={(
                          <ChartTooltipContent
                            hideLabel
                            formatter={(_value, _name, item) => (
                              <div className="flex min-w-[12rem] items-center justify-between gap-3">
                                <span className="text-muted-foreground">{item.payload.facet}</span>
                                <span className="font-mono">{formatPercentage(item.payload.percent, 1)}</span>
                              </div>
                            )}
                          />
                        )}
                      />
                    </PieChart>
                  ) : (
                    <BarChart data={[...odourData].reverse()} layout="vertical" margin={{ left: 8, right: 16, top: 6, bottom: 6 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="facet"
                        width={28}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ChartTooltip
                        content={(
                          <ChartTooltipContent
                            hideLabel
                            formatter={(_value, _name, item) => (
                              <div className="flex min-w-[12rem] items-center justify-between gap-3">
                                <span className="text-muted-foreground">{item.payload.facet}</span>
                                <span className="font-mono">{formatPercentage(item.payload.percent, 1)}</span>
                              </div>
                            )}
                          />
                        )}
                      />
                      <Bar dataKey="weight" radius={10}>
                        {[...odourData].reverse().map((entry) => (
                          <Cell key={entry.facet} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ChartContainer>

                <div className="rounded-2xl border border-[#ddd3bf] bg-white/78 p-3">
                  <button
                    type="button"
                    onClick={() => setLegendExpanded((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7a6a4a]">
                        Facet percentages
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Buka jika ingin lihat rincian E, H, W, Q dan facet lainnya.
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${legendExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {legendExpanded ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {odourData.map((entry) => (
                        <div key={entry.facet} className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-sm"
                              style={{ backgroundColor: entry.fill }}
                            />
                            <span className="font-medium">{entry.facet}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-xs">{formatPercentage(entry.percent, 1)}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">{formatQuantity(entry.weight, 2)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 rounded-2xl border border-[#ddd3bf] bg-white/72 p-3 sm:grid-cols-2">
                <div className="rounded-xl bg-[#faf3dd] px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#88734a]">
                    Dominant family
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#433821]">
                    {charts.dominantFamily?.family || '-'}
                  </div>
                </div>
                <div className="rounded-xl bg-[#f1f6ea] px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5d7542]">
                    Opening load
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#31451f]">
                    {formatGramAmount(charts.openingProfile?.total || 0)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed bg-background/70 px-4 py-8 text-sm text-muted-foreground">
              Tambahkan raw material yang sudah terhubung ke workbook reference profile supaya graphic odour display, impact, dan life bisa dihitung live.
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MetricCard
              label="Impact"
              value={formatQuantity(charts.simulation.impactEstimate, 1)}
              hint="Workbook additive impact estimate"
            />
            <MetricCard
              label="Life"
              value={formatHours(charts.simulation.odourWeightedLifeHours)}
              hint={charts.simulation.simpleLifeHours
                ? `Simple life ${formatHours(charts.simulation.simpleLifeHours)}`
                : 'Weighted by impact contribution'}
            />
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-[#ddd3bf] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,246,239,0.98)_100%)] p-5 shadow-sm">
        <button
          type="button"
          onClick={() => setBalanceExpanded((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div>
            <div className="text-sm font-semibold text-[#3c3222]">Balance preview</div>
            <div className="text-xs text-[#776c56]">
              Baca cepat top, middle, dan base dari life-hours workbook.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="border border-[#ded3be] bg-[#f5efde] text-[10px] text-[#6f623f]">
              {charts.dominantFamily?.family || 'No family'}
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

            <div className="mt-4 rounded-2xl bg-[#f6f1e5] p-3 text-xs text-[#756a55]">
              Opening load {formatGramAmount(charts.openingProfile?.total || 0)}.
              {' '}
              Late drydown base {formatGramAmount(charts.finishProfile?.base || 0)} at {charts.finishProfile?.label || '-'}.
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
};

export default FormulaOdourDisplayPanel;
