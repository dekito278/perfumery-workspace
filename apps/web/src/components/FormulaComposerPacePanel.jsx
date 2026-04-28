import React, { useMemo, useState } from 'react';
import { ChevronDown, FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible.jsx';
import FormulaWorkbookSimulationPanel from '@/components/FormulaWorkbookSimulationPanel.jsx';
import { buildWorkbookSimulation } from '@/utils/formulaWorkbookSimulation.js';

const getScoreLabel = (value) => {
  if (value >= 75) {
    return 'Strong';
  }

  if (value >= 60) {
    return 'Healthy';
  }

  if (value >= 40) {
    return 'Needs work';
  }

  return 'Weak';
};

const FormulaComposerPacePanel = ({
  items,
  rawMaterialsById,
  referenceLinksMap,
  onApplyRecommendation = null,
  priorityMode = null,
  onPriorityModeChange = null,
  defaultPriorityMode = 'balance',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const simulation = useMemo(() => buildWorkbookSimulation({
    items,
    rawMaterialsById,
    referenceLinksMap,
  }), [items, rawMaterialsById, referenceLinksMap]);

  const weakestAxis = simulation.pace?.weakestAxis || null;
  const strongestAxis = simulation.pace?.strongestAxis || null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <div className="overflow-hidden rounded-[22px] border border-[#ddd3bf] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,246,239,0.98)_100%)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#e7decb] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              <div className="text-sm font-semibold text-[#3c3222]">Live PACE diagnosis</div>
              <Badge variant="outline" className="rounded-full text-[10px]">
                Composer linked
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              PACE Performance Board updates as soon as materials or gram amounts change.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {simulation.eligibleItemCount ? (
              <>
                <Badge variant="secondary" className="rounded-full text-[10px]">
                  {simulation.eligibleItemCount} materials
                </Badge>
                {weakestAxis ? (
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    Watch {weakestAxis.label}: {getScoreLabel(weakestAxis.value)}
                  </Badge>
                ) : null}
                {strongestAxis ? (
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    Best {strongestAxis.label}: {getScoreLabel(strongestAxis.value)}
                  </Badge>
                ) : null}
                <Badge variant={simulation.pace.warningCount ? 'destructive' : 'outline'} className="rounded-full text-[10px]">
                  {simulation.pace.warningCount} warning{simulation.pace.warningCount === 1 ? '' : 's'}
                </Badge>
              </>
            ) : (
              <Badge variant="outline" className="rounded-full text-[10px]">
                Add materials to start diagnosis
              </Badge>
            )}

            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="rounded-full px-3">
                {open ? 'Hide board' : 'Show board'}
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="px-3 py-3 sm:px-4 sm:py-4">
            {simulation.eligibleItemCount ? (
              <FormulaWorkbookSimulationPanel
                items={items}
                rawMaterialsById={rawMaterialsById}
                referenceLinksMap={referenceLinksMap}
                title="PACE Performance Board"
                description="Live workbook diagnosis for the current composer state."
                onApplyRecommendation={onApplyRecommendation}
                priorityMode={priorityMode}
                onPriorityModeChange={onPriorityModeChange}
                defaultPriorityMode={defaultPriorityMode}
              />
            ) : (
              <div className="rounded-[18px] border border-dashed border-[#ddd3bf] bg-[#fcfaf4] px-4 py-5 text-sm text-muted-foreground">
                Start adding raw materials and gram amounts to unlock a live PACE diagnosis here.
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default FormulaComposerPacePanel;
