import React from 'react';
import { Calculator, Package2, Printer, Store } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatPercentage, formatQuantity } from '@/utils/formatting.js';
import { formatPrice } from '@/utils/pricingUtils.js';
import { PACKAGING_FIELDS } from '@/utils/productionCosting.js';

const summaryCardClassName = 'rounded-lg border bg-muted/30 p-4';
const statCardClassName = 'rounded-lg bg-muted/30 p-3';

const ProductionRetailTab = ({
  onPrint,
  retailComputed,
  retailInputs,
  retailScenarios,
  updateRetailInput,
  updateRetailScenario,
}) => (
  <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-5 flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Bottle costing setup</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>Target fill volume (ml)</Label>
            <Input value={retailInputs.totalBatchVolume} onChange={(event) => updateRetailInput('totalBatchVolume', event.target.value)} type="number" min="0" step="0.01" />
          </div>
          <div className="space-y-2">
            <Label>Bottle size (ml)</Label>
            <Input value={retailInputs.bottleSize} onChange={(event) => updateRetailInput('bottleSize', event.target.value)} type="number" min="0" step="0.01" />
          </div>
          <div className="space-y-2">
            <Label>Production loss %</Label>
            <Input value={retailInputs.productionLossPercent} onChange={(event) => updateRetailInput('productionLossPercent', event.target.value)} type="number" min="0" max="100" step="0.01" />
          </div>
          <div className="space-y-2">
            <Label>COGS / ml</Label>
            <Input value={formatQuantity(retailComputed.cogsPerMl, 2)} readOnly />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={summaryCardClassName}>
            <div className="text-xs text-muted-foreground">Required production</div>
            <div className="mt-1 text-lg font-semibold font-mono">{formatQuantity(retailComputed.requiredProductionVolume)} ml</div>
          </div>
          <div className={summaryCardClassName}>
            <div className="text-xs text-muted-foreground">Formula needed</div>
            <div className="mt-1 text-lg font-semibold font-mono">{formatQuantity(retailComputed.formulaVolumeNeeded)} ml</div>
          </div>
          <div className={summaryCardClassName}>
            <div className="text-xs text-muted-foreground">Solvent needed</div>
            <div className="mt-1 text-lg font-semibold font-mono">{formatQuantity(retailComputed.solventVolumeNeeded)} ml</div>
          </div>
          <div className={summaryCardClassName}>
            <div className="text-xs text-muted-foreground">Bottle output</div>
            <div className="mt-1 text-lg font-semibold font-mono">{retailComputed.bottleCount} bottles</div>
          </div>
        </div>

        <div className="mt-6">
          <Accordion type="single" collapsible defaultValue={undefined} className="rounded-xl border px-4">
            <AccordionItem value="packaging" className="border-none">
              <AccordionTrigger className="py-4 hover:no-underline">
                <div className="flex flex-1 items-center justify-between gap-4 pr-4">
                  <div className="flex items-center gap-2">
                    <Package2 className="h-4 w-4 text-primary" />
                    <div className="text-left">
                      <div className="text-lg font-semibold">Packaging and overhead</div>
                      <div className="text-xs text-muted-foreground">Buka saat perlu edit komponen biaya.</div>
                    </div>
                  </div>
                  <div className="hidden gap-2 md:flex">
                    <Badge variant="outline">/ bottle {formatCurrency(retailComputed.perBottlePackagingCost)}</Badge>
                    <Badge variant="outline">packaging {formatPrice(retailComputed.totalPackagingCost)}</Badge>
                    <Badge variant="outline">overhead {formatPrice(retailComputed.totalBatchOverhead)}</Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-1">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {PACKAGING_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label>
                        {field.label}
                        <span className="ml-1 text-xs text-muted-foreground">
                          {field.kind === 'unit' ? '/ bottle' : '/ batch'}
                        </span>
                      </Label>
                      <Input value={retailInputs[field.key]} onChange={(event) => updateRetailInput(field.key, event.target.value)} type="number" min="0" step="0.01" />
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className={summaryCardClassName}>
                    <div className="text-xs text-muted-foreground">Packaging / bottle</div>
                    <div className="mt-1 text-lg font-semibold font-mono">{formatCurrency(retailComputed.perBottlePackagingCost)}</div>
                  </div>
                  <div className={summaryCardClassName}>
                    <div className="text-xs text-muted-foreground">Total packaging</div>
                    <div className="mt-1 text-lg font-semibold font-mono">{formatPrice(retailComputed.totalPackagingCost)}</div>
                  </div>
                  <div className={summaryCardClassName}>
                    <div className="text-xs text-muted-foreground">Batch overhead</div>
                    <div className="mt-1 text-lg font-semibold font-mono">{formatPrice(retailComputed.totalBatchOverhead)}</div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>

    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Retail summary</h2>
          </div>
          <Button variant="outline" size="sm" onClick={onPrint} className="h-9 gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className={summaryCardClassName}>
            <div className="text-xs text-muted-foreground">COGS / bottle</div>
            <div className="mt-1 text-2xl font-bold font-mono text-primary">{formatCurrency(retailComputed.costPerBottle)}</div>
            <div className="mt-2 text-xs text-muted-foreground">All-in finished bottle cost.</div>
          </div>
          <div className={summaryCardClassName}>
            <div className="text-xs text-muted-foreground">COGS per ml</div>
            <div className="mt-1 text-2xl font-bold font-mono">{formatCurrency(retailComputed.cogsPerMl)}</div>
            <div className="mt-2 text-xs text-muted-foreground">Based on target finished stock volume.</div>
          </div>
          <div className={summaryCardClassName}>
            <div className="text-xs text-muted-foreground">Bottle output</div>
            <div className="mt-1 text-2xl font-bold">{retailComputed.bottleCount}</div>
            <div className="mt-2 text-xs text-muted-foreground">Remaining {formatQuantity(retailComputed.remainingVolume)} ml.</div>
          </div>
          <div className={summaryCardClassName}>
            <div className="text-xs text-muted-foreground">Total production cost</div>
            <div className="mt-1 text-2xl font-bold font-mono">{formatPrice(retailComputed.totalProductionCost)}</div>
            <div className="mt-2 text-xs text-muted-foreground">Material, packaging, and batch overhead.</div>
          </div>
        </div>

        <div className="mt-4 space-y-3 rounded-lg border p-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Formula material cost</span>
            <span className="font-mono">{formatPrice(retailComputed.formulaMaterialCost)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Solvent cost</span>
            <span className="font-mono">{formatPrice(retailComputed.solventMaterialCost)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Total packaging</span>
            <span className="font-mono">{formatPrice(retailComputed.totalPackagingCost)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Batch overhead</span>
            <span className="font-mono">{formatPrice(retailComputed.totalBatchOverhead)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Store className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Manual pricing</h2>
        </div>

        {retailScenarios.map((scenario) => {
          const scenarioResult = retailComputed.scenarioResults.find((item) => item.id === scenario.id);
          return (
            <div key={scenario.id} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Channel name</Label>
                  <Input value={scenario.label} onChange={(event) => updateRetailScenario(scenario.id, 'label', event.target.value)} placeholder="Isi manual" />
                </div>
                <div className="space-y-1.5">
                  <Label>Mode</Label>
                  <Select value={scenario.mode} onValueChange={(value) => updateRetailScenario(scenario.id, 'mode', value)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="markup">Markup from COGS</SelectItem>
                      <SelectItem value="margin">Target net margin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{scenario.mode === 'markup' ? 'Markup %' : 'Target margin %'}</Label>
                  <Input value={scenario.percent} onChange={(event) => updateRetailScenario(scenario.id, 'percent', event.target.value)} type="number" min="0" max="1000" step="0.01" />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Channel fee %</Label>
                  <Input value={scenario.feePercent} onChange={(event) => updateRetailScenario(scenario.id, 'feePercent', event.target.value)} type="number" min="0" max="100" step="0.01" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className={statCardClassName}>
                  <div className="text-xs text-muted-foreground">Sell price / bottle</div>
                  <div className="mt-1 font-mono text-lg font-semibold text-primary">{formatCurrency(scenarioResult?.salePrice || 0)}</div>
                </div>
                <div className={statCardClassName}>
                  <div className="text-xs text-muted-foreground">Net profit / bottle</div>
                  <div className="mt-1 font-mono text-lg font-semibold">{formatCurrency(scenarioResult?.profitPerBottle || 0)}</div>
                </div>
                <div className={statCardClassName}>
                  <div className="text-xs text-muted-foreground">Batch profit</div>
                  <div className="mt-1 font-mono text-lg font-semibold">{formatPrice(scenarioResult?.batchProfit || 0)}</div>
                </div>
                <div className={statCardClassName}>
                  <div className="text-xs text-muted-foreground">Net margin</div>
                  <div className="mt-1 font-mono text-lg font-semibold">{formatPercentage(scenarioResult?.profitMargin || 0)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

export default ProductionRetailTab;
