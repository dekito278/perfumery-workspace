import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Beaker, BookmarkPlus, Check, Pencil, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import BriefWizardDialog from '@/components/briefs/BriefWizardDialog.jsx';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import DeleteConfirmationDialog from '@/components/mobile-ui/DeleteConfirmationDialog.jsx';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useBriefDetailPage } from '@/hooks/useBriefDetailPage.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { formatDate, formatStatus } from '@/utils/formatting.js';
import { getStageLabel } from '@/utils/briefProjectWizard.js';
import { STAGES, stageColorMap } from '@/utils/briefProjectBoard.js';

const tabs = [
  { value: 'overview', label: 'Overview' },
  { value: 'direction', label: 'Direction' },
  { value: 'materials', label: 'Materials' },
  { value: 'formula', label: 'Formula' },
  { value: 'activity', label: 'Activity' },
];

const MobileBriefDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { deleteBrief } = useBriefs();
  const detail = useBriefDetailPage(id);
  const {
    actionNeededLogs,
    activeAnswerLabels,
    activeStage,
    activeTargetProfile,
    brief,
    busyStage,
    compareCandidates,
    currentGeneratedRows,
    currentQuestion,
    currentQuestions,
    currentRecommendedRows,
    draftAnswers,
    formula,
    handleGenerateRecommendations,
    handleOpenNextStage,
    handleRemoveStageItem,
    handleStageItemState,
    handleWizardBack,
    handleFinishWizard,
    handleWizardNext,
    handleWizardNextStage,
    handleWizardOptionSelect,
    loading,
    openStageWizard,
    project,
    projectUnavailable,
    readyStageCount,
    selectedItemsByStage,
    selectedMaterialIds,
    setWizardOpen,
    stageFlowHint,
    validationLogs,
    wizardOpen,
    wizardQuestionIndex,
  } = detail;

  const selectedItems = useMemo(() => STAGES.flatMap((stage) => selectedItemsByStage?.get(stage) || []), [selectedItemsByStage]);
  const selectedCountByStage = useMemo(() => Object.fromEntries(STAGES.map((stage) => [stage, (selectedItemsByStage?.get(stage) || []).length])), [selectedItemsByStage]);
  const selectedMaterialQuery = selectedMaterialIds?.length ? `&materialIds=${selectedMaterialIds.join(',')}` : '';
  const formulaTarget = formula
    ? `/mobile/formulas/${formula.id}/edit?briefId=${brief?.id || id}${selectedMaterialQuery}`
    : `/mobile/formulas/new?briefId=${brief?.id || id}${project?.id ? `&projectId=${project.id}` : selectedMaterialQuery}`;

  const handleDelete = async () => {
    if (!brief) return;
    setDeleting(true);
    try {
      await deleteBrief(brief.id);
      toast.success('Brief deleted');
      navigate('/mobile/briefs');
    } catch (error) {
      toast.error(error.message || 'Failed to delete brief');
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !brief) {
    return (
      <MobileAuthenticatedLayout>
        <MobileLoadingState eyebrow="Brief" title="Loading project..." subtitle="Preparing direction, materials, and activity." />
      </MobileAuthenticatedLayout>
    );
  }

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>{brief.title} - Mobile Brief</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title={brief.title}
          subtitle={`Updated ${formatDate(brief.updated || brief.created)}`}
          onBack={() => navigate('/mobile/briefs')}
          action={<MobileStatusBadge status={brief.status || 'draft'} />}
        />
        <section className="mobile-soft-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase text-amber-700">Progress</div>
              <div className="mt-1 text-xl font-bold text-[#1f2937]">{readyStageCount || 0}/3 stages</div>
            </div>
            <div className="text-right text-xs font-bold text-[#6b7280]">{actionNeededLogs?.length || 0} action logs</div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-amber-100">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(((readyStageCount || 0) / 3) * 100, 100)}%` }} />
          </div>
        </section>

        <MobileSegmentedControl options={tabs} value={tab} onChange={setTab} />
        <section className="space-y-3">
          {tab === 'overview' ? (
            <>
              <div className="mobile-card p-4">
                <h2 className="text-base font-bold">Brief summary</h2>
                <p className="mt-2 text-sm text-[#6b7280]">{brief.mood_story || 'No summary.'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="mobile-card p-4"><div className="text-xs font-bold uppercase text-[#9ca3af]">Formula</div><div className="mt-1 text-sm font-bold">{formula?.name || 'Not linked'}</div></div>
                <div className="mobile-card p-4"><div className="text-xs font-bold uppercase text-[#9ca3af]">Status</div><div className="mt-1 text-sm font-bold capitalize">{brief.status || 'draft'}</div></div>
              </div>
              <div className="mobile-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold">Stage flow</h2>
                    <p className="mt-1 text-xs font-semibold text-[#6b7280]">{stageFlowHint || 'Guide top, middle, and base before composing formula.'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {projectUnavailable ? <MobileStatusBadge status="local" /> : null}
                    <Button type="button" size="sm" className="h-8 rounded-xl px-3 text-[11px]" onClick={() => openStageWizard(activeStage)}>Wizard</Button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {STAGES.map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => openStageWizard(stage)}
                      className={`rounded-2xl border p-3 text-left ${activeStage === stage ? 'border-amber-400 bg-amber-50' : 'border-[#e5e7eb] bg-white'}`}
                    >
                      <div className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold ${stageColorMap[stage]}`}>{getStageLabel(stage)}</div>
                      <div className="mt-2 text-sm font-bold text-[#1f2937]">{selectedCountByStage[stage]}</div>
                      <div className="text-[10px] font-semibold text-[#9ca3af]">selected</div>
                    </button>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-[#e5e7eb] bg-white p-3">
                  <div className="text-[10px] font-bold uppercase text-[#9ca3af]">{getStageLabel(activeStage)} profile</div>
                  <div className="mt-1 text-sm font-bold text-[#1f2937]">{activeTargetProfile.summary}</div>
                  <p className="mt-1 text-xs font-semibold text-[#6b7280]">{activeTargetProfile.stage_goal}</p>
                  {activeAnswerLabels.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {activeAnswerLabels.slice(0, 4).map((answer) => (
                        <span key={answer.id} className="rounded-full border border-[#e5e7eb] bg-[#f9fafb] px-2 py-1 text-[10px] font-bold text-[#4b5563]">{answer.label}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}

          {tab === 'direction' ? (
            ['mood_story', 'audience_usage', 'performance_target', 'budget_direction'].map((field) => (
              <div key={field} className="mobile-card p-4">
                <div className="text-xs font-bold uppercase text-[#9ca3af]">{formatStatus(field)}</div>
                <p className="mt-2 text-sm text-[#374151]">{brief[field] || '-'}</p>
              </div>
            ))
          ) : null}

          {tab === 'materials' ? (
            <>
              <div className="mobile-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold">{getStageLabel(activeStage)} candidates</h2>
                    <p className="mt-1 text-xs font-semibold text-[#6b7280]">{currentRecommendedRows.length} queued, {currentGeneratedRows.length} selected</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" className="rounded-xl bg-white text-xs" onClick={() => openStageWizard(activeStage)}>Profile</Button>
                </div>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {STAGES.map((stage) => (
                    <Button key={stage} type="button" size="sm" variant={activeStage === stage ? 'default' : 'outline'} className="shrink-0 rounded-xl text-xs" onClick={() => handleOpenNextStage(stage)}>
                      {getStageLabel(stage)}
                    </Button>
                  ))}
                </div>
                <Button className="mt-3 w-full rounded-2xl text-xs" onClick={handleGenerateRecommendations} disabled={busyStage === activeStage}>
                  <Sparkles className="mr-1 h-4 w-4" />
                  {busyStage === activeStage ? 'Generating materials' : 'Generate materials'}
                </Button>
              </div>
              {compareCandidates.length ? compareCandidates.slice(0, 8).map((item) => (
                <div key={item.id} className="mobile-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{item.expand?.raw_material_id?.name || 'Unknown material'}</div>
                      <p className="mt-1 mobile-line-clamp-2 text-xs font-semibold text-[#6b7280]">{item.recommendation_reason || 'Generated from stage fit'}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{Number(item.fit_score || 0).toFixed(2)}</div>
                      <div className="text-[10px] font-semibold text-[#9ca3af]">fit</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button size="sm" className="rounded-xl text-xs" onClick={() => handleStageItemState(item, 'selected')}><Check className="mr-1 h-4 w-4" />Add</Button>
                    <Button size="sm" variant="outline" className="rounded-xl bg-white text-xs" onClick={() => handleStageItemState(item, 'rejected')}><X className="mr-1 h-4 w-4" />Skip</Button>
                  </div>
                </div>
              )) : selectedItems.length ? selectedItems.slice(0, 9).map((item) => (
                <div key={item.id || item.raw_material_id} className="mobile-card p-4">
                  <div className="text-sm font-bold">{item.expand?.raw_material_id?.name || item.raw_material_name || item.material_name || item.name || 'Selected material'}</div>
                  <div className="mt-1 text-xs text-[#6b7280]">Stage {getStageLabel(item.stage) || 'Project'} - {item.selection_state || 'selected'}</div>
                </div>
              )) : <MobileEmptyState title="No shortlisted materials" />}
              {currentGeneratedRows.length ? (
                <div className="mobile-card p-4">
                  <h2 className="text-base font-bold">Added to {getStageLabel(activeStage)}</h2>
                  <div className="mt-3 space-y-2">
                    {currentGeneratedRows.slice(0, 6).map((item) => (
                      <div key={`selected-${item.id}`} className="rounded-2xl border border-[#e5e7eb] bg-white p-3">
                        <div className="text-sm font-bold">{item.expand?.raw_material_id?.name || 'Unknown material'}</div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <Button size="sm" variant="outline" className="rounded-xl bg-white text-xs" onClick={() => handleStageItemState(item, 'recommended')}>Remove</Button>
                          <Button size="sm" variant="ghost" className="rounded-xl text-xs" onClick={() => handleRemoveStageItem(item)}>Delete</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {tab === 'formula' ? (
            <div className="mobile-card p-4">
              <div className="text-base font-bold">{formula?.name || 'No formula linked'}</div>
              <p className="mt-2 text-sm text-[#6b7280]">{formula ? `Code ${formula.code}` : `${readyStageCount}/3 stages ready. Compose after the board direction feels right.`}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {STAGES.map((stage) => (
                  <div key={stage} className="rounded-2xl border border-[#e5e7eb] bg-white p-3 text-center">
                    <div className={`mx-auto inline-flex rounded-full border px-2 py-1 text-[10px] font-bold ${stageColorMap[stage]}`}>{getStageLabel(stage)}</div>
                    <div className="mt-2 text-sm font-bold">{selectedCountByStage[stage]}</div>
                  </div>
                ))}
              </div>
              <Button className="mt-4 w-full rounded-2xl" onClick={() => navigate(formulaTarget)}>
                {formula ? 'Open Formula' : 'Create Formula'}
              </Button>
            </div>
          ) : null}

          {tab === 'activity' ? (
            validationLogs?.length ? validationLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="mobile-card p-4">
                <MobileStatusBadge status={log.status || 'logged'} />
                <div className="mt-2 text-sm font-medium">{log.note}</div>
                <div className="mt-2 text-xs text-[#6b7280]">{formatDate(log.tested_at || log.created)}</div>
              </div>
            )) : <MobileEmptyState title="No activity yet" />
          ) : null}
        </section>

        <section className="mobile-card p-3">
          <div className="grid grid-cols-4 gap-1.5">
            <Button variant="outline" className="h-12 flex-col gap-0.5 rounded-2xl bg-white px-1 text-[10px]" onClick={() => navigate(`/mobile/briefs/${brief.id}/edit`)}><Pencil className="h-4 w-4" />Edit</Button>
            <Button variant="outline" className="h-12 flex-col gap-0.5 rounded-2xl bg-white px-1 text-[10px]" onClick={() => navigate(`/mobile/raw-materials?briefId=${brief.id}`)}><BookmarkPlus className="h-4 w-4" />Pick</Button>
            <Button className="h-12 flex-col gap-0.5 rounded-2xl px-1 text-[10px]" onClick={() => navigate(formulaTarget)}><Beaker className="h-4 w-4" />Formula</Button>
            <Button variant="outline" className="h-12 flex-col gap-0.5 rounded-2xl border-rose-100 bg-rose-50 px-1 text-[10px] text-rose-700" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" />Delete</Button>
          </div>
        </section>
      </main>
      <DeleteConfirmationDialog open={deleteOpen} onOpenChange={setDeleteOpen} itemName={brief.title} onConfirm={handleDelete} loading={deleting} />
      <BriefWizardDialog
        activeStage={activeStage}
        activeTargetProfile={activeTargetProfile}
        busyStage={busyStage}
        compareCandidates={compareCandidates}
        currentQuestion={currentQuestion}
        currentQuestions={currentQuestions}
        currentGeneratedRows={currentGeneratedRows}
        draftAnswers={draftAnswers}
        handleGenerateRecommendations={handleGenerateRecommendations}
        handleStageItemState={handleStageItemState}
        handleWizardBack={handleWizardBack}
        handleFinishWizard={handleFinishWizard}
        handleWizardNext={handleWizardNext}
        handleWizardNextStage={handleWizardNextStage}
        handleWizardOptionSelect={handleWizardOptionSelect}
        setWizardOpen={setWizardOpen}
        wizardOpen={wizardOpen}
        wizardQuestionIndex={wizardQuestionIndex}
      />
    </MobileAuthenticatedLayout>
  );
};

export default MobileBriefDetailPage;
