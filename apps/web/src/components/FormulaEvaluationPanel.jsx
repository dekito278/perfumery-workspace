import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, FlaskConical, History, NotebookPen, ShieldAlert } from 'lucide-react';
import { formatDate } from '@/utils/formatting.js';
import { FORMULA_CATEGORIES, FORMULA_STATUSES } from '@/utils/constants.js';
import { validationStatusLabel, validationTestTypeLabel } from '@/services/validationLogsSupabaseService.js';

const optionLabel = (options, value) => options.find((option) => option.value === value)?.label || value;

const CHECKLIST_ITEMS = [
  'Catatan uji blotter',
  'Catatan uji kulit',
  'Catatan stabilitas',
  'Ringkasan revisi',
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
            Antrean evaluasi
          </div>
          <div className="mt-3 text-3xl font-bold">{backlog.length}</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Formula draf yang menunggu catatan blotter, kulit, atau revisi.
          </p>
        </div>
        <div className="rounded-[24px] border bg-white/90 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FlaskConical className="h-4 w-4 text-emerald-600" />
            Revisi aktif
          </div>
          <div className="mt-3 text-3xl font-bold">{active.length}</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Formula yang sedang berjalan dan perlu dicatat dengan rapi.
          </p>
        </div>
        <div className="rounded-[24px] border bg-white/90 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-amber-600" />
            Catatan uji
          </div>
          <div className="mt-3 text-3xl font-bold">{validationLogs.length}</div>
          <p className="mt-2 text-sm text-muted-foreground">
            {actionNeededCount} perlu aksi dan {approvedCount} disetujui di cakupan ini.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border bg-white/90 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Antrean uji</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Pakai antrean ini untuk memutuskan apa yang diuji berikutnya dan revisi mana yang didahulukan.
              </p>
            </div>
            <Badge variant="outline" className="rounded-full px-2.5 text-[10px]">
              {priorityQueue.length} siap sekarang
            </Badge>
          </div>

          <div className="mt-4 space-y-3">
            {priorityQueue.length ? priorityQueue.map((formula) => (
              <div key={formula.id} className="flex flex-col gap-3 rounded-[22px] border bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold">{formula.name}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {optionLabel(FORMULA_STATUSES, formula.status || 'draft')}
                    </Badge>
                    {formula.category ? (
                      <Badge variant="outline" className="text-[10px]">
                        {optionLabel(FORMULA_CATEGORIES, formula.category)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                {onOpenFormula ? (
                  <Button variant="outline" className="rounded-xl" onClick={() => onOpenFormula(formula)}>
                    Buka formula
                  </Button>
                ) : null}
              </div>
            )) : (
              <div className="rounded-[22px] border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                Belum ada formula di antrean uji.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[28px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,241,232,0.96)_100%)] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="h-4 w-4 text-amber-700" />
              Daftar periksa uji
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Catatan minimum yang disarankan agar setiap revisi punya cukup konteks untuk dibandingkan dan dipelajari.
            </p>
            <div className="mt-4 space-y-3">
              {CHECKLIST_ITEMS.map((item) => (
                <div key={item} className="rounded-[18px] border bg-white/85 px-4 py-3 text-sm">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
              Simpan satu catatan per revisi formula untuk pembuka, inti, jejak akhir, dan kejutan stabilitas. Catatan singkat selalu lebih baik daripada tidak ada catatan.
            </div>
            {onOpenValidationWorkspace ? (
              <Button className="mt-4 w-full rounded-2xl" onClick={onOpenValidationWorkspace}>
                Buka halaman validasi
              </Button>
            ) : null}
          </div>

          <div className="rounded-[28px] border bg-white/90 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <NotebookPen className="h-4 w-4 text-primary" />
              Catatan terbaru
            </div>
            <div className="mt-4 space-y-3">
              {visibleLogs.length ? visibleLogs.map((log) => (
                <div key={log.id} className="rounded-[18px] border bg-background/80 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {validationTestTypeLabel(log.test_type)}
                    </Badge>
                    <Badge variant={log.status === 'action_needed' ? 'destructive' : 'outline'} className="text-[10px]">
                      {validationStatusLabel(log.status)}
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
                      Berikutnya: {log.next_action}
                    </div>
                  ) : null}
                </div>
              )) : (
                <div className="rounded-[18px] border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                  Belum ada catatan uji di cakupan ini.
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
