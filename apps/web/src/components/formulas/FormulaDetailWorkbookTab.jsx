import React from 'react';
import DetailSection from '@/components/DetailSection.jsx';
import FormulaOdourDisplayPanel from '@/components/FormulaOdourDisplayPanel.jsx';
import FormulaWorkbookSimulationPanel from '@/components/FormulaWorkbookSimulationPanel.jsx';
import { formatGramAmount } from '@/utils/formatting.js';
import { formatPrice } from '@/utils/pricingUtils.js';

const FormulaDetailWorkbookTab = ({
  compactCompositionRows,
  handleCreatePacedRevision,
  handlePacePriorityModeChange,
  hasFormulaItems,
  hiddenCompositionGroupCount,
  isCreatingPacedRevision,
  itemReferenceLinksMap,
  items,
  pacePriorityMode,
  rawMaterialsById,
  totalCost,
  workbookBoardStats,
}) => (
  <div className="space-y-5">
    <DetailSection title="Workbook visualisation">
      {hasFormulaItems ? (
        <div className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] xl:items-start">
            <div className="space-y-3">
              <div className="overflow-hidden rounded-[24px] border border-[#ddd3bf] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,244,235,0.96)_100%)] shadow-sm">
                <div className="border-b border-[#e2d8c2] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e6c42]">
                    Composition board
                  </div>
                  <div className="mt-1 text-sm text-[#5f5239]">
                    Dominant groups in a tighter workbook-style table.
                  </div>
                </div>
                <div className="px-4 py-3">
                  <div className="grid grid-cols-[minmax(0,1.4fr)_76px_76px_58px] gap-3 border-b border-[#ece4d3] pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
                    <div>Group</div>
                    <div className="text-right">% share</div>
                    <div className="text-right">Amount</div>
                    <div className="text-right">Rows</div>
                  </div>
                  <div className="divide-y divide-[#f0e8d8]">
                    {compactCompositionRows.map((row) => (
                      <div key={row.label} className="grid grid-cols-[minmax(0,1.4fr)_76px_76px_58px] gap-3 py-2 text-sm">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-[#3f3524]">{row.label}</div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#efe9da]">
                            <div
                              className="h-full rounded-full bg-[#f2a323]"
                              style={{ width: `${Math.min(Math.max(row.percentage, 0), 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right font-mono text-[#3f3524]">{row.percentage.toFixed(1)}%</div>
                        <div className="text-right font-mono text-[#6b5d41]">{formatGramAmount(row.grams)}</div>
                        <div className="text-right font-mono text-[#8a7a58]">{row.count}</div>
                      </div>
                    ))}
                  </div>
                  {hiddenCompositionGroupCount > 0 ? (
                    <div className="border-t border-[#ece4d3] pt-2 text-xs text-muted-foreground">
                      +{hiddenCompositionGroupCount} more groups hidden for a cleaner desktop view.
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="overflow-hidden rounded-[24px] border border-[#ddd3bf] bg-white shadow-sm">
                <div className="border-b border-[#eee4d0] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e6c42]">
                    Formula ledger
                  </div>
                  <div className="mt-1 text-sm text-[#5f5239]">
                    Quick workbook coverage and formula economics.
                  </div>
                </div>
                <div className="divide-y divide-[#f1eadc]">
                  {workbookBoardStats.map((stat) => (
                    <div key={stat.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm">
                      <div className="text-[#6c5f46]">{stat.label}</div>
                      <div className="font-mono font-semibold text-[#3f3524]">
                        {stat.label === 'Material cost' ? formatPrice(stat.value) : stat.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <FormulaOdourDisplayPanel
                items={items}
                rawMaterialsById={rawMaterialsById}
                referenceLinksMap={itemReferenceLinksMap}
                isVisible
              />
            </div>
          </div>
          <div className="mx-auto w-full max-w-[1120px]">
            <FormulaWorkbookSimulationPanel
              items={items}
              rawMaterialsById={rawMaterialsById}
              referenceLinksMap={itemReferenceLinksMap}
              title="Workbook diagnostics"
              description="Reference coverage, lifetime estimate, and IFRA-oriented diagnostics for the current formula."
              onCreatePacedRevision={handleCreatePacedRevision}
              isCreatingPacedRevision={isCreatingPacedRevision}
              priorityMode={pacePriorityMode}
              onPriorityModeChange={handlePacePriorityModeChange}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
          Workbook charts and composition profile will appear after the formula has ingredients. Linked workbook materials will unlock odour facets, family spread, and top-middle-base decay curves.
        </div>
      )}
    </DetailSection>
  </div>
);

export default FormulaDetailWorkbookTab;
