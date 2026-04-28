import React, { useEffect, useMemo, useState } from 'react';
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
import { formatDate, formatStatus } from '@/utils/formatting.js';

const createEmptyLog = (formulaId = 'none') => ({
  formula_id: formulaId,
  revision_label: '',
  test_type: 'revision',
  status: 'logged',
  note: '',
  next_action: '',
  evaluator_name: '',
  tested_at: new Date().toISOString().slice(0, 10),
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

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const [formulaRows, logRows] = await Promise.all([
        getFormulas(),
        getValidationLogs(),
      ]);
      setFormulas(formulaRows);
      setValidationLogs(logRows);
    } catch (error) {
      toast.error('Failed to load validation workspace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, []);

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
      tested_at: log.tested_at || new Date().toISOString().slice(0, 10),
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (formState.formula_id === 'none') {
      toast.error('Choose a formula first');
      return;
    }

    if (!formState.note.trim()) {
      toast.error('Validation note is required');
      return;
    }

    setSaving(true);
    try {
      if (editingLogId) {
        await updateValidationLog(editingLogId, formState);
        toast.success('Validation log updated');
      } else {
        await createValidationLog(formState);
        toast.success('Validation log saved');
      }
      resetEditor();
      await loadWorkspace();
    } catch (error) {
      toast.error('Failed to save validation log');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLog = async (log) => {
    const confirmed = window.confirm('Delete this validation log?');
    if (!confirmed) {
      return;
    }

    try {
      await deleteValidationLog(log.id);
      toast.success('Validation log deleted');
      if (editingLogId === log.id) {
        resetEditor();
      }
      await loadWorkspace();
    } catch (error) {
      toast.error('Failed to delete validation log');
    }
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Validation - Formulation Workspace</title>
        <meta name="description" content="Track evaluation backlog, revision notes, and validation checkpoints for formulas." />
      </Helmet>

      <div className="page-container space-y-6">
        <div>
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4 gap-2 h-9">
            <Home className="w-4 h-4" />
            Back to dashboard
          </Button>
        </div>

        <div className="rounded-[30px] border bg-[linear-gradient(135deg,rgba(255,255,255,0.97)_0%,rgba(246,241,232,0.98)_100%)] p-6 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full border bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <NotebookPen className="h-3.5 w-3.5 text-primary" />
            Validation log
          </div>
          <h1 className="mt-4 text-3xl font-bold" style={{ letterSpacing: '-0.02em' }}>
            Catat test, bukan cuma revisi.
          </h1>
          <p className="mt-3 max-w-3xl text-base text-muted-foreground">
            Halaman ini menyimpan antrean evaluasi formula, log revisi nyata, dan checklist minimum untuk blotter, skin, stability, dan revision notes.
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
                <div className="text-sm font-semibold">Log editor</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Simpan satu observasi kecil setiap sesi test. Formula akan terasa jauh lebih traceable.
                </p>

                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Formula</div>
                    <Select value={formState.formula_id} onValueChange={(value) => handleChange('formula_id', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose formula" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Choose formula</SelectItem>
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
                      <div className="text-sm font-medium">Revision label</div>
                      <Input
                        value={formState.revision_label}
                        onChange={(event) => handleChange('revision_label', event.target.value)}
                        placeholder="v1 blotter, mod 3, final candidate..."
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Test date</div>
                      <Input
                        type="date"
                        value={formState.tested_at}
                        onChange={(event) => handleChange('tested_at', event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Test type</div>
                      <Select value={formState.test_type} onValueChange={(value) => handleChange('test_type', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Test type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="blotter">Blotter</SelectItem>
                          <SelectItem value="skin">Skin</SelectItem>
                          <SelectItem value="stability">Stability</SelectItem>
                          <SelectItem value="revision">Revision</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
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
                          <SelectItem value="logged">Logged</SelectItem>
                          <SelectItem value="action_needed">Action needed</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Observation</div>
                    <Textarea
                      value={formState.note}
                      onChange={(event) => handleChange('note', event.target.value)}
                      className="min-h-[150px]"
                      placeholder="Opening too sharp for first 10 minutes, heart smoother after 20 minutes, drydown cleaner than previous revision..."
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Next action</div>
                    <Textarea
                      value={formState.next_action}
                      onChange={(event) => handleChange('next_action', event.target.value)}
                      className="min-h-[100px]"
                      placeholder="Reduce top sparkle by 10%, add bridge material, re-test skin after 24h..."
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Evaluator</div>
                    <Input
                      value={formState.evaluator_name}
                      onChange={(event) => handleChange('evaluator_name', event.target.value)}
                      placeholder="Optional evaluator name"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" className="rounded-2xl" disabled={saving}>
                      {saving ? 'Saving...' : editingLogId ? 'Update log' : 'Save log'}
                    </Button>
                    <Button type="button" variant="outline" className="rounded-2xl" onClick={resetEditor} disabled={saving}>
                      New blank log
                    </Button>
                  </div>
                </form>
              </div>

              <div className="rounded-[28px] border bg-white/90 p-5 shadow-sm">
                <div className="text-sm font-semibold">Recent validation notes</div>
                <div className="mt-4 space-y-3">
                  {sortedLogs.length ? sortedLogs.map((log) => {
                    const formula = formulasById.get(log.formula_id);

                    return (
                      <div key={log.id} className="rounded-[22px] border bg-background/80 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">{formula?.name || 'Unknown formula'}</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant="secondary" className="text-[10px]">
                                {formatStatus(log.test_type)}
                              </Badge>
                              <Badge variant={log.status === 'action_needed' ? 'destructive' : 'outline'} className="text-[10px]">
                                {formatStatus(log.status)}
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
                              Edit
                            </Button>
                            <Button type="button" variant="ghost" className="rounded-xl px-3" onClick={() => handleDeleteLog(log)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 text-sm">{log.note}</div>
                        {log.next_action ? (
                          <div className="mt-3 text-sm text-muted-foreground">
                            Next action: {log.next_action}
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
                      No validation notes saved yet. Start with one blotter observation and one next action.
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
