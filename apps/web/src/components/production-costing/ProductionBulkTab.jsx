import React from 'react';
import {
  Calculator,
  Download,
  Factory,
  FlaskConical,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea.jsx';
import { formatCurrency, formatPercentage } from '@/utils/formatting.js';
import { formatPrice, formatPricePerUnit } from '@/utils/pricingUtils.js';

const summaryCardClassName = 'rounded-lg border bg-muted/30 p-4';
const statCardClassName = 'rounded-lg bg-muted/30 p-3';

const ProductionBulkTab = ({
  addBulkScenario,
  bulkComputed,
  bulkInputs,
  bulkScenarios,
  handleExportQuotationPdf,
  handlePrintQuotation,
  quotationInputs,
  quotationOpen,
  removeBulkScenario,
  selectedFormula,
  selectedQuotationRow,
  setQuotationOpen,
  updateBulkInput,
  updateBulkScenario,
  updateQuotationInput,
}) => (
  <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-5 flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Bulk juice COGS</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Bulk loss %</Label>
              <Input value={bulkInputs.productionLossPercent} onChange={(event) => updateBulkInput('productionLossPercent', event.target.value)} type="number" min="0" max="100" step="0.01" />
            </div>
            <div className="space-y-2">
              <Label>Handling cost / liter</Label>
              <Input value={bulkInputs.handlingCostPerLiter} onChange={(event) => updateBulkInput('handlingCostPerLiter', event.target.value)} type="number" min="0" step="0.01" />
            </div>
            <div className="space-y-2">
              <Label>Bulk overhead / liter</Label>
              <Input value={bulkInputs.bulkOverheadCost} onChange={(event) => updateBulkInput('bulkOverheadCost', event.target.value)} type="number" min="0" step="0.01" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className={summaryCardClassName}>
              <div className="text-xs text-muted-foreground">Formula COGS / ml</div>
              <div className="mt-1 text-lg font-semibold font-mono">{formatCurrency(bulkComputed.formulaCogsPerMl)}</div>
            </div>
            <div className={summaryCardClassName}>
              <div className="text-xs text-muted-foreground">Solvent COGS / ml</div>
              <div className="mt-1 text-lg font-semibold font-mono">{formatCurrency(bulkComputed.solventCogsPerMl)}</div>
            </div>
            <div className={summaryCardClassName}>
              <div className="text-xs text-muted-foreground">Material COGS / ml</div>
              <div className="mt-1 text-lg font-semibold font-mono">{formatCurrency(bulkComputed.materialCogsPerMl)}</div>
            </div>
            <div className={summaryCardClassName}>
              <div className="text-xs text-muted-foreground">All-in COGS / liter</div>
              <div className="mt-1 text-lg font-semibold font-mono text-primary">{formatCurrency(bulkComputed.allInBulkCogsPerLiter)}</div>
            </div>
          </div>

          <div className="mt-5 rounded-lg border p-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Concentration</span>
              <span className="font-mono">{formatPercentage(bulkComputed.concentration)}</span>
            </div>
            <div className="mt-2 flex justify-between gap-4">
              <span className="text-muted-foreground">Loss allowance</span>
              <span className="font-mono">{formatPercentage(bulkComputed.lossPercent)}</span>
            </div>
            <div className="mt-2 flex justify-between gap-4">
              <span className="text-muted-foreground">Handling / liter</span>
              <span className="font-mono">{formatCurrency(bulkComputed.handlingCostPerLiter)}</span>
            </div>
            <div className="mt-2 flex justify-between gap-4">
              <span className="text-muted-foreground">Overhead / liter</span>
              <span className="font-mono">{formatCurrency(bulkComputed.overheadPerLiter)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Factory className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">Brand pricing markup</h2>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-9 gap-2" onClick={addBulkScenario}>
              <Plus className="h-4 w-4" />
              Add quote
            </Button>
          </div>

          <Accordion
            type="single"
            collapsible
            defaultValue={bulkScenarios[0]?.id}
            className="rounded-xl border px-4"
          >
            {bulkScenarios.map((scenario, index) => {
              const result = bulkComputed.rows[index];
              return (
                <AccordionItem key={scenario.id} value={scenario.id}>
                  <AccordionTrigger className="py-4 hover:no-underline">
                    <div className="flex flex-1 items-center justify-between gap-4 pr-4">
                      <div className="text-left">
                        <div className="text-sm font-medium">Quote {index + 1}</div>
                        <div className="text-xs text-muted-foreground">
                          {scenario.volumeValue || '0'} {scenario.volumeUnit || 'ml'}
                        </div>
                      </div>
                      <div className="hidden gap-2 md:flex">
                        <Badge variant="outline">COGS {formatPrice(result?.totalCogs || 0)}</Badge>
                        <Badge variant="outline">Sell {formatPrice(result?.sellPrice || 0)}</Badge>
                        <Badge variant="outline">Profit {formatPrice(result?.profit || 0)}</Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-2 px-2"
                        onClick={() => removeBulkScenario(scenario.id)}
                        disabled={bulkScenarios.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_120px_180px_1fr]">
                      <div className="space-y-1.5">
                        <Label>Volume quote</Label>
                        <Input value={scenario.volumeValue} onChange={(event) => updateBulkScenario(scenario.id, 'volumeValue', event.target.value)} type="number" min="0" step="0.01" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Unit</Label>
                        <Select value={scenario.volumeUnit} onValueChange={(value) => updateBulkScenario(scenario.id, 'volumeUnit', value)}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ml">ml</SelectItem>
                            <SelectItem value="liter">liter</SelectItem>
                            <SelectItem value="gram">gram</SelectItem>
                            <SelectItem value="kg">kg</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Mode</Label>
                        <Select value={scenario.mode} onValueChange={(value) => updateBulkScenario(scenario.id, 'mode', value)}>
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
                        <Input value={scenario.percent} onChange={(event) => updateBulkScenario(scenario.id, 'percent', event.target.value)} type="number" min="0" max="1000" step="0.01" />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <div className={statCardClassName}>
                        <div className="text-[11px] text-muted-foreground">Volume</div>
                        <div className="mt-1 font-mono text-base font-semibold">
                          {scenario.volumeValue || '0'} {scenario.volumeUnit || 'ml'}
                        </div>
                      </div>
                      <div className={statCardClassName}>
                        <div className="text-[11px] text-muted-foreground">COGS</div>
                        <div className="mt-1 font-mono text-base font-semibold">{formatPrice(result?.totalCogs || 0)}</div>
                      </div>
                      <div className={statCardClassName}>
                        <div className="text-[11px] text-muted-foreground">Sell price</div>
                        <div className="mt-1 font-mono text-base font-semibold text-primary">{formatPrice(result?.sellPrice || 0)}</div>
                      </div>
                      <div className={statCardClassName}>
                        <div className="text-[11px] text-muted-foreground">Profit</div>
                        <div className="mt-1 font-mono text-base font-semibold">{formatPrice(result?.profit || 0)}</div>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">Margin {formatPercentage(result?.margin || 0)}</Badge>
                      <Badge variant="outline">COGS / liter {formatCurrency(result?.cogsPerLiter || 0)}</Badge>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </div>
    </div>

    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Quote summary</h2>
          </div>
          <Dialog open={quotationOpen} onOpenChange={setQuotationOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 gap-2">
                <Printer className="h-4 w-4" />
                Open quotation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-6">
              <DialogHeader>
                <DialogTitle>Brand quotation</DialogTitle>
                <DialogDescription>
                  Siapkan quotation yang langsung bisa di-print atau di-export PDF untuk brand.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Quotation number</Label>
                  <Input value={quotationInputs.quotationNumber} onChange={(event) => updateQuotationInput('quotationNumber', event.target.value)} placeholder="QT-001" />
                </div>
                <div className="space-y-2">
                  <Label>Brand name</Label>
                  <Input value={quotationInputs.brandName} onChange={(event) => updateQuotationInput('brandName', event.target.value)} placeholder="Client brand" />
                </div>
                <div className="space-y-2">
                  <Label>Attention / PIC</Label>
                  <Input value={quotationInputs.attentionName} onChange={(event) => updateQuotationInput('attentionName', event.target.value)} placeholder="Contact person" />
                </div>
                <div className="space-y-2">
                  <Label>Quote validity (days)</Label>
                  <Input value={quotationInputs.validDays} onChange={(event) => updateQuotationInput('validDays', event.target.value)} type="number" min="0" step="1" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Use quote</Label>
                  <Select value={quotationInputs.selectedScenarioId} onValueChange={(value) => updateQuotationInput('selectedScenarioId', value)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select quote" />
                    </SelectTrigger>
                    <SelectContent>
                      {bulkComputed.rows.map((row, index) => (
                        <SelectItem key={row.id} value={row.id}>
                          Quote {index + 1} - {row.volumeValue || '0'} {row.volumeUnit} - {formatPrice(row.sellPrice)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Quotation notes</Label>
                  <Textarea value={quotationInputs.notes} onChange={(event) => updateQuotationInput('notes', event.target.value)} rows={3} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Terms</Label>
                  <Textarea value={quotationInputs.terms} onChange={(event) => updateQuotationInput('terms', event.target.value)} rows={3} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className={statCardClassName}>
                  <div className="text-xs text-muted-foreground">Selected formula</div>
                  <div className="mt-1 font-medium">{selectedFormula?.name || '-'}</div>
                </div>
                <div className={statCardClassName}>
                  <div className="text-xs text-muted-foreground">Quoted volume</div>
                  <div className="mt-1 font-mono text-lg font-semibold">
                    {selectedQuotationRow ? `${selectedQuotationRow.volumeValue} ${selectedQuotationRow.volumeUnit}` : '-'}
                  </div>
                </div>
                <div className={statCardClassName}>
                  <div className="text-xs text-muted-foreground">Quoted price</div>
                  <div className="mt-1 font-mono text-lg font-semibold text-primary">{formatPrice(selectedQuotationRow?.sellPrice || 0)}</div>
                </div>
                <div className={statCardClassName}>
                  <div className="text-xs text-muted-foreground">Validity</div>
                  <div className="mt-1 font-medium">{quotationInputs.validDays || '0'} days</div>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handlePrintQuotation} className="h-9 gap-2">
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportQuotationPdf} className="h-9 gap-2">
                  <Download className="h-4 w-4" />
                  PDF
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-2 rounded-lg border p-4">
          {bulkComputed.rows.map((row, index) => (
            <div key={row.id} className="flex items-start justify-between gap-4 border-b pb-2 last:border-b-0 last:pb-0">
              <div>
                <div className="font-medium">Quote {index + 1}</div>
                <div className="text-xs text-muted-foreground">{row.volumeValue || '0'} {row.volumeUnit || 'ml'}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm">{formatPrice(row.totalCogs)}</div>
                <div className="text-xs text-muted-foreground">Sell {formatPrice(row.sellPrice)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">When to use this tab</h2>
        <div className="mt-4 space-y-3 text-sm text-muted-foreground">
          <p>
            Use <strong>Bulk / Brand Costing</strong> when you sell perfume juice to another brand in custom pack sizes, without retail bottle packaging.
          </p>
          <p>
            This tab focuses on COGS for <strong>formula concentrate + solvent + loss + bulk handling</strong>, then applies a markup or target margin.
          </p>
          <p>
            It helps you quote faster as a perfumer when a client asks how much a custom order volume will cost, then you can set the markup directly.
          </p>
        </div>
      </div>
    </div>
  </div>
);

export default ProductionBulkTab;
