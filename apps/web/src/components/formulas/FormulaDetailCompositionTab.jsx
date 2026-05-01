import React from 'react';
import { Badge } from '@/components/ui/badge';
import DetailSection from '@/components/DetailSection.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calculateDilutionComposition } from '@/utils/calculateDilutionCost.js';
import { formatGramAmount, formatPercentage, formatStatus } from '@/utils/formatting.js';
import { calculateIngredientCost, formatPrice, formatPricePerUnit } from '@/utils/pricingUtils.js';

const FormulaDetailCompositionTab = ({
  hasFormulaItems,
  items,
  onOpenRawMaterial,
  totalCost,
  totalGrams,
  totalPercentage,
}) => (
  <div className="space-y-5">
    <DetailSection title="Composition">
      {hasFormulaItems ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground mb-1">Total amount</div>
              <div className="text-lg font-semibold font-mono">{formatGramAmount(totalGrams)}</div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground mb-1">Total percentage</div>
              <div className="text-lg font-semibold font-mono">{formatPercentage(totalPercentage)}</div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground mb-1">Material cost</div>
              <div className="text-lg font-semibold font-mono text-primary">{formatPrice(totalCost)}</div>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((item, index) => {
              const ingredientCost = item.ingredient_cost ?? calculateIngredientCost(item.gram_amount, item.unit_price);
              const isDiluted = item.is_diluted && item.dilution_percentage;
              const composition = isDiluted
                ? calculateDilutionComposition(item.gram_amount, item.dilution_percentage)
                : null;

              return (
                <div key={index} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">
                        {item.item_type === 'raw_material' || item.item_type === 'solvent' ? (
                          <button
                            onClick={() => onOpenRawMaterial(item.item_id)}
                            className="text-left text-primary hover:underline"
                          >
                            {item.name}
                          </button>
                        ) : (
                          item.name
                        )}
                      </div>
                      {isDiluted ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.dilution_percentage}% in {item.dilution_solvent_name || '-'}
                        </div>
                      ) : null}
                    </div>
                    <Badge variant="outline" className="shrink-0 capitalize text-[10px]">
                      {formatStatus(item.item_type)}
                    </Badge>
                  </div>

                  {item.reference_profile ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        Ref {item.reference_profile.reference_code}
                      </Badge>
                      {item.advisories?.map((advisory) => (
                        <Badge
                          key={`${item.item_id}-${advisory.type}`}
                          variant={advisory.type === 'ifra' ? 'destructive' : 'outline'}
                          className="text-[10px]"
                        >
                          {advisory.label}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <div className="text-muted-foreground">Amount</div>
                      <div className="mt-1 font-mono text-sm">{formatGramAmount(item.gram_amount)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Percentage</div>
                      <div className="mt-1 font-mono text-sm">{formatPercentage(item.percentage)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Cost</div>
                      <div className="mt-1 font-mono">{formatPrice(ingredientCost)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Unit price</div>
                      <div className="mt-1 font-mono">{formatPricePerUnit(item.unit_price, item.unit)}</div>
                    </div>
                  </div>

                  {isDiluted && composition ? (
                    <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      Active: {formatGramAmount(composition.activeAmount)} + Solvent: {formatGramAmount(composition.solventAmount)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="hidden table-container md:block">
            <div className="overflow-hidden rounded-[24px] border border-[#ddd3bf] bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,244,235,0.94)_100%)] shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#e6dcc8]">
                    <TableHead className="min-w-[230px] pl-5">Material</TableHead>
                    <TableHead className="min-w-[220px]">Guidance</TableHead>
                    <TableHead className="text-right min-w-[120px]">Usage</TableHead>
                    <TableHead className="text-right min-w-[140px] pr-5">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const ingredientCost = item.ingredient_cost ?? calculateIngredientCost(item.gram_amount, item.unit_price);
                    const isDiluted = item.is_diluted && item.dilution_percentage;
                    const composition = isDiluted
                      ? calculateDilutionComposition(item.gram_amount, item.dilution_percentage)
                      : null;

                    return (
                      <React.Fragment key={index}>
                        <TableRow className="border-[#eee5d3] align-top">
                          <TableCell className="pl-5 py-3">
                            {item.item_type === 'raw_material' || item.item_type === 'solvent' ? (
                              <div className="space-y-1.5">
                                <button
                                  onClick={() => onOpenRawMaterial(item.item_id)}
                                  className="text-left text-sm font-semibold text-[#3f3524] transition hover:text-primary hover:underline"
                                >
                                  {item.name}
                                </button>
                                <div className="flex flex-wrap gap-1.5">
                                  <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] capitalize">
                                    {formatStatus(item.item_type)}
                                  </Badge>
                                </div>
                                {isDiluted ? (
                                  <div className="text-xs text-muted-foreground">
                                    {item.dilution_percentage}%{item.dilution_solvent_name ? ` in ${item.dilution_solvent_name}` : ''}
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="font-semibold text-sm text-[#3f3524]">{item.name}</div>
                                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] capitalize">
                                  {formatStatus(item.item_type)}
                                </Badge>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {item.reference_profile ? (
                                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">
                                  Ref {item.reference_profile.reference_code}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                                  No workbook ref
                                </Badge>
                              )}
                              {item.advisories?.slice(0, 2).map((advisory) => (
                                <Badge
                                  key={`${item.item_id}-${advisory.type}`}
                                  variant={advisory.type === 'ifra' ? 'destructive' : 'outline'}
                                  className="rounded-full px-2 py-0.5 text-[10px]"
                                >
                                  {advisory.label}
                                </Badge>
                              ))}
                              {item.advisories?.length > 2 ? (
                                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                                  +{item.advisories.length - 2} more
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <div className="font-mono text-sm font-semibold text-[#3f3524]">
                              {formatGramAmount(item.gram_amount)}
                            </div>
                            <div className="mt-1 font-mono text-xs text-muted-foreground">
                              {formatPercentage(item.percentage)}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 pr-5 text-right">
                            <div className="font-mono text-sm font-semibold text-[#3f3524]">
                              {formatPrice(ingredientCost)}
                            </div>
                            <div className="mt-1 font-mono text-xs text-muted-foreground">
                              {formatPricePerUnit(item.unit_price, item.unit)}
                            </div>
                          </TableCell>
                        </TableRow>
                        {isDiluted && composition ? (
                          <TableRow className="bg-[#f7f2e8]">
                            <TableCell colSpan={4} className="px-5 py-2.5">
                              <div className="text-xs text-muted-foreground">
                                Active: {formatGramAmount(composition.activeAmount)} + Solvent: {formatGramAmount(composition.solventAmount)}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                  <TableRow className="border-[#e0d6c1] bg-[#f6efe2] font-semibold">
                    <TableCell className="pl-5 text-sm text-[#3f3524]">Total</TableCell>
                    <TableCell className="text-sm text-[#6b5d41]">{items.length} rows</TableCell>
                    <TableCell className="text-right font-mono text-sm text-[#3f3524]">
                      <div>{formatGramAmount(totalGrams)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatPercentage(totalPercentage)}</div>
                    </TableCell>
                    <TableCell className="pr-5 text-right font-mono text-sm text-primary">
                      {formatPrice(totalCost)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Percentages are calculated from gram amounts. Formula detail stays focused on raw materials and solvent-related costs only.
          </p>
        </>
      ) : (
        <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
          This formula does not have any composition rows yet. Add ingredients from the edit flow to unlock percentages, cost breakdown, and workbook charting.
        </div>
      )}
    </DetailSection>
  </div>
);

export default FormulaDetailCompositionTab;
