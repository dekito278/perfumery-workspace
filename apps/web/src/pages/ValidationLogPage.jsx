import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { shopToday } from '@/utils/localDay.js';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Home, NotebookPen, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useValidationLogs } from '@/hooks/useValidationLogs.js';
import FormulaEvaluationPanel from '@/components/FormulaEvaluationPanel.jsx';
import { formatDate } from '@/utils/formatting.js';
import {
  VALIDATION_STATUSES,
  VALIDATION_TEST_TYPES,
  validationStatusLabel,
  validationTestTypeLabel,
} from '@/services/validationLogsSupabaseService.js';
import { confirmAction } from '@/utils/confirmAction.js';

const createEmptyLog = (formulaId = 'none') => ({
  formula_id: formulaId,
  revision_label: '',
  test_type: 'revision',
  status: 'logged',
  note: '',
  next_action: '',
  evaluator_name: '',
  tested_at: shopToday(),
});

const ValidationLogPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryFormulaId = searchParams.get('formulaId') || 'none';
  const { getFormulas } = useFormulas();
  const { getValidationLogs, createValidationLog, updateValidationLog, deleteValidationLog } = useValidationLogs();
  const [formulas, setFormulas] = useState([]);
  const [validationLogs, setValidationLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingLogId, setEditingLogId] = useState(null);
  const [formState, setFormState] = useState(createEmptyLog(queryFormulaId));

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const [formulaRows, logRows] = await Promise.all([
        getFormulas(),
        getValidationLogs(),
      ]);
      setFormulas(formulaRows);
      setValidationLogs(logRows);
    } catch (error) {
      toast.error('Ruang kerja validasi belum bisa dimuat');
    } finally {
      setLoading(false);
    }
  }, [getFormulas, getValidationLogs]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    setFormState((current) => (
      current.formula_id === 'none' || !current.formula_id
        ? { ...current, formula_id: queryFormulaId }
        : current
    ));
  }, [queryFormulaId]);

  const formulasById = useMemo(
    () => new Map(formulas.map((formula) => [formula.id, formula])),
    [formulas]
  );

  const sortedLogs = useMemo(
    () => [...validationLogs].sort((left, right) => {
      const rightDate = new Date(right.tested_at || right.created || 0).getTime();
      const leftDate = new Date(left.tested_at || left.created || 0).getTime();
      return rightDate - leftDate;
    }),
    [validationLogs]
  );

  const handleChange = (field, value) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const resetEditor = () => {
    setEditingLogId(null);
    setFormState(createEmptyLog(queryFormulaId));
  };

  const handleEditLog = (log) => {
    setEditingLogId(log.id);
    setFormState({
      formula_id: log.formula_id || 'none',
      revision_label: log.revision_label || '',
      test_type: log.test_type || 'revision',
      status: log.status || 'logged',
      note: log.note || '',
      next_action: log.next_action || '',
      evaluator_name: log.evaluator_name || '',
      tested_at: log.tested_at || shopToday(),
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (formState.formula_id === 'none') {
      toast.error('Pilih formula dulu');
      return;
    }

    if (!formState.note.trim()) {
      toast.error('Catatan uji wajib diisi');
      return;
    }

    setSaving(true);
    try {
      if (editingLogId) {
        await updateValidationLog(editingLogId, formState);
        toast.success('Catatan uji diperbarui');
      } else {
        await createValidationLog(formState);
        toast.success('Catatan uji disimpan');
      }
      resetEditor();
      await loadWorkspace();
    } catch (error) {
      toast.error('Catatan uji belum bisa disimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLog = async (log) => {
    const confirmed = await confirmAction({ message: 'Hapus catatan uji ini?', destructive: true });
    if (!confirmed) {
      return;
    }

    try {
      await deleteValidationLog(log.id);
      toast.success('Catatan uji dihapus');
      if (editingLogId === log.id) {
        resetEditor();
      }
      await loadWorkspace();
    } catch (error) {
      toast.error('Catatan uji belum bisa dihapus');
    }
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Validasi - Solivagant</title>
        <meta name="description" content="Lacak antrean evaluasi, catatan revisi, dan titik cek validasi formula." />
      </Helmet>

      <div className="page-container space-y-6">
        <div>
          <Button variant="ghost" onClick={() => navigate('/studio')} className="mb-4 gap-2 h-9">
            <Home className="w-4 h-4" />
            Kembali ke dashboard
          </Button>
        </div>

        <div className="rounded-[30px] border bg-[linear-gradient(135deg,rgba(255,255,255,0.97)_0%,rgba(246,241,232,0.98)_100%)] p-6 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full border bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <NotebookPen className="h-3.5 w-3.5 text-primary" />
            Catatan uji
          </div>
          <h1 className="mt-4 text-3xl font-bold" style={{ letterSpacing: '-0.02em' }}>
            Catat tes, bukan cuma revisi.
          </h1>
          <p className="mt-3 max-w-3xl text-base text-muted-foreground">
            Halaman ini menyimpan antrean evaluasi formula, catatan revisi nyata, dan daftar cek minimum untuk tes blotter, kulit, stabilitas, dan catatan revisi.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : (
          <>
            <FormulaEvaluationPanel
              formulas={formulas}
              validationLogs={validationLogs}
              onOpenFormula={(formula) => navigate(`/formulas/${formula.id}`)}
            />

            <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[28px] border bg-white/90 p-5 shadow-sm">
                <div className="text-sm font-semibold">Tulis catatan uji</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Simpan satu observasi kecil setiap sesi tes. Riwayat formula jadi jauh lebih mudah ditelusuri.
                </p>

                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Formula</div>
                    <Select value={formState.formula_id} onValueChange={(value) => handleChange('formula_id', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih formula" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Pilih formula</SelectItem>
                        {formulas.map((formula) => (
                          <SelectItem key={formula.id} value={formula.id}>
                            {formula.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Label revisi</div>
                      <Input
                        value={formState.revision_label}
                        onChange={(event) => handleChange('revision_label', event.target.value)}
                        placeholder="v1 blotter, mod 3, kandidat final..."
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Tanggal tes</div>
                      <Input
                        type="date"
                        value={formState.tested_at}
                        onChange={(event) => handleChange('tested_at', event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Tipe tes</div>
                      <Select value={formState.test_type} onValueChange={(value) => handleChange('test_type', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tipe tes" />
                        </SelectTrigger>
                        <SelectContent>
                          {VALIDATION_TEST_TYPES.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Status</div>
                      <Select value={formState.status} onValueChange={(value) => handleChange('status', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {VALIDATION_STATUSES.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Observasi</div>
                    <Textarea
                      value={formState.note}
                      onChange={(event) => handleChange('note', event.target.value)}
                      className="min-h-[150px]"
                      placeholder="Pembuka terlalu tajam di 10 menit pertama, inti lebih halus setelah 20 menit, jejak akhir lebih bersih dari revisi sebelumnya..."
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Aksi lanjutan</div>
                    <Textarea
                      value={formState.next_action}
                      onChange={(event) => handleChange('next_action', event.target.value)}
                      className="min-h-[100px]"
                      placeholder="Kurangi kilau nada atas 10%, tambah bahan jembatan, uji ulang di kulit setelah 24 jam..."
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Penguji</div>
                    <Input
                      value={formState.evaluator_name}
                      onChange={(event) => handleChange('evaluator_name', event.target.value)}
                      placeholder="Nama penguji (opsional)"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" className="rounded-2xl" disabled={saving}>
                      {saving ? 'Menyimpan...' : editingLogId ? 'Perbarui catatan' : 'Simpan catatan'}
                    </Button>
                    <Button type="button" variant="outline" className="rounded-2xl" onClick={resetEditor} disabled={saving}>
                      Catatan baru
                    </Button>
                  </div>
                </form>
              </div>

              <div className="rounded-[28px] border bg-white/90 p-5 shadow-sm">
                <div className="text-sm font-semibold">Catatan uji terbaru</div>
                <div className="mt-4 space-y-3">
                  {sortedLogs.length ? sortedLogs.map((log) => {
                    const formula = formulasById.get(log.formula_id);

                    return (
                      <div key={log.id} className="rounded-[22px] border bg-background/80 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">{formula?.name || 'Formula tidak ditemukan'}</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant="secondary" className="text-[10px]">
                                {validationTestTypeLabel(log.test_type)}
                              </Badge>
                              <Badge variant={log.status === 'action_needed' ? 'destructive' : 'outline'} className="text-[10px]">
                                {validationStatusLabel(log.status)}
                              </Badge>
                              {log.revision_label ? (
                                <Badge variant="outline" className="text-[10px]">
                                  {log.revision_label}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" className="rounded-xl" onClick={() => handleEditLog(log)}>
                              Ubah
                            </Button>
                            <Button type="button" variant="ghost" className="rounded-xl px-3" onClick={() => handleDeleteLog(log)} aria-label="Hapus catatan uji">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 text-sm">{log.note}</div>
                        {log.next_action ? (
                          <div className="mt-3 text-sm text-muted-foreground">
                            Aksi lanjutan: {log.next_action}
                          </div>
                        ) : null}
                        <div className="mt-3 text-xs text-muted-foreground">
                          {formatDate(log.tested_at)}
                          {log.evaluator_name ? ` - ${log.evaluator_name}` : ''}
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="rounded-[22px] border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                      Belum ada catatan uji. Mulai dengan satu observasi blotter dan satu aksi lanjutan.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
};

export default ValidationLogPage;
