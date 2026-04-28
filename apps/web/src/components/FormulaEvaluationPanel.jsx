import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, FlaskConical, History, NotebookPen, ShieldAlert } from 'lucide-react';
import { formatDate, formatStatus } from '@/utils/formatting.js';

const CHECKLIST_ITEMS = [
  'Blotter test note',
  'Skin test note',
  'Stability note',
  'Revision summary',
];

const FormulaEvaluationPanel = ({
  formulas,
  validationLogs = [],
  selectedFormulaId = null,
  onOpenFormula,
  onOpenValidationWorkspace,
}) => {
  const backlog = formulas.filter((formula) => formula.status === 'draft');
  const active = formulas.filter((formula) => formula.status === 'active');
  const priorityQueue = [...backlog, ...active].slice(0, 6);

  const visibleLogs = useMemo(() => {
    const scopedLogs = selectedFormulaId
      ? validationLogs.filter((log) => log.formula_id === selectedFormulaId)
      : validationLogs;

    return scopedLogs.slice(0, 5);
  }, [selectedFormulaId, validationLogs]);

  const actionNeededCount = visibleLogs.filter((log) => log.status === 'action_needed').length;
  const approvedCount = visibleLogs.filter((log) => log.status === 'approved').length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[24px] border bg-white/90 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Evaluation backlog
          </div>
          <div className="mt-3 text-3xl font-bold">{backlog.length}</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Draft formulas waiting for blotter, skin, or revision logging.
          </p>
        </div>
        <div className="rounded-[24px] border bg-white/90 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FlaskConical className="h-4 w-4 text-emerald-600" />
            Active revisions
          </div>
          <div className="mt-3 text-3xl font-bold">{active.length}</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Formulas already in motion and worth keeping tightly logged.
          </p>
        </div>
        <div className="rounded-[24px] border bg-white/90 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-amber-600" />
            Logged notes
          </div>
          <div className="mt-3 text-3xl font-bold">{validationLogs.length}</div>
          <p className="mt-2 text-sm text-muted-foreground">
            {actionNeededCount} action-needed and {approvedCount} approved observations in the current scope.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border bg-white/90 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Validation queue</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Use this queue to decide what gets tested next and where revision energy should go.
              </p>
            </div>
            <Badge variant="outline" className="rounded-full px-2.5 text-[10px]">
              {priorityQueue.length} ready now
            </Badge>
          </div>

          <div className="mt-4 space-y-3">
            {priorityQueue.length ? priorityQueue.map((formula) => (
              <div key={formula.id} className="flex flex-col gap-3 rounded-[22px] border bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold">{formula.name}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge variant="secondary" className="capitalize text-[10px]">
                      {formula.status || 'draft'}
                    </Badge>
                    {formula.category ? (
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {formula.category}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                {onOpenFormula ? (
                  <Button variant="outline" className="rounded-xl" onClick={() => onOpenFormula(formula)}>
                    Open formula
                  </Button>
                ) : null}
              </div>
            )) : (
              <div className="rounded-[22px] border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                No formulas are waiting in the validation queue yet.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[28px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,241,232,0.96)_100%)] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="h-4 w-4 text-amber-700" />
              Validation checklist
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Suggested minimum log so every revision has enough context to compare and learn from.
            </p>
            <div className="mt-4 space-y-3">
              {CHECKLIST_ITEMS.map((item) => (
                <div key={item} className="rounded-[18px] border bg-white/85 px-4 py-3 text-sm">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
              Keep one note per formula revision for opening, heart, drydown, and any stability surprise. Tiny notes beat missing notes every time.
            </div>
            {onOpenValidationWorkspace ? (
              <Button className="mt-4 w-full rounded-2xl" onClick={onOpenValidationWorkspace}>
                Open validation workspace
              </Button>
            ) : null}
          </div>

          <div className="rounded-[28px] border bg-white/90 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <NotebookPen className="h-4 w-4 text-primary" />
              Recent notes
            </div>
            <div className="mt-4 space-y-3">
              {visibleLogs.length ? visibleLogs.map((log) => (
                <div key={log.id} className="rounded-[18px] border bg-background/80 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {formatStatus(log.test_type)}
                    </Badge>
                    <Badge variant={log.status === 'action_needed' ? 'destructive' : 'outline'} className="text-[10px]">
                      {formatStatus(log.status)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(log.tested_at)}</span>
                  </div>
                  {log.revision_label ? (
                    <div className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      {log.revision_label}
                    </div>
                  ) : null}
                  <div className="mt-2 text-sm">{log.note}</div>
                  {log.next_action ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Next: {log.next_action}
                    </div>
                  ) : null}
                </div>
              )) : (
                <div className="rounded-[18px] border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                  No validation notes saved yet for this scope.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormulaEvaluationPanel;
