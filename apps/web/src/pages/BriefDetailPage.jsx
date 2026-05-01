import React from 'react';
import { Helmet } from 'react-helmet';
import { ArrowRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import BriefDirectionSection from '@/components/briefs/BriefDirectionSection.jsx';
import BriefStageBoardSection from '@/components/briefs/BriefStageBoardSection.jsx';
import BriefWizardDialog from '@/components/briefs/BriefWizardDialog.jsx';
import DetailMetadata from '@/components/DetailMetadata.jsx';
import DetailPageHeader from '@/components/DetailPageHeader.jsx';
import DetailPageLayout from '@/components/DetailPageLayout.jsx';
import DetailSection from '@/components/DetailSection.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBriefDetailPage } from '@/hooks/useBriefDetailPage.js';
import { formatDate, formatStatus } from '@/utils/formatting.js';
import { getStageLabel } from '@/utils/briefProjectWizard.js';

const LoadingState = () => (
  <DetailPageLayout>
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  </DetailPageLayout>
);

const BriefDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    actionNeededLogs,
    activeAnswerLabels,
    activeStage,
    activeTargetProfile,
    allStagesReady,
    brief,
    busyStage,
    compareCandidates,
    currentGeneratedRows,
    currentQuestion,
    currentQuestions,
    currentRecommendedRows,
    currentRejectedRows,
    decisionAssist,
    draftAnswers,
    formatDebugPercent,
    formula,
    handleBack,
    handleGenerateRecommendations,
    handleOpenNextStage,
    handleRemoveStageItem,
    handleStageItemState,
    handleWizardBack,
    handleWizardNext,
    handleWizardNextStage,
    handleWizardOptionSelect,
    loading,
    nextPrimaryAction,
    openStageWizard,
    project,
    projectPhase,
    projectPhaseLabel,
    projectUnavailable,
    readyStageCount,
    selectedItemsByStage,
    selectedMaterialIds,
    setWizardOpen,
    stageBoardCompleted,
    stageFlowHint,
    stageMap,
    stageMaterialExplainMap,
    validationLogs,
    wizardOpen,
    wizardQuestionIndex,
  } = useBriefDetailPage(id);

  if (loading || !brief || (!project && !projectUnavailable)) {
    return <LoadingState />;
  }

  return (
    <>
      <Helmet>
        <title>{`${brief.title} - Composition Project`}</title>
        <meta name="description" content="Guide one brief through top, middle, and base decisions before turning the shortlist directly into a formula." />
      </Helmet>

      <DetailPageLayout>
        <DetailPageHeader
          eyebrow="Composition project"
          title={brief.title}
          subtitle="Brief ini sekarang menjadi satu project kerja: arahkan top, middle, dan base lewat wizard, generate material, lalu teruskan langsung ke formula."
          badge={(
            <Badge variant="outline" className="capitalize text-xs">
              {brief.status || 'draft'}
            </Badge>
          )}
          onBack={handleBack}
          backLabel="Back to briefs"
          meta={(
            <>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Current phase</span>
                <span className="detail-page-meta-value">{formatStatus(projectPhase)}</span>
              </div>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Ready stages</span>
                <span className="detail-page-meta-value">{readyStageCount}/3</span>
              </div>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Action logs</span>
                <span className="detail-page-meta-value">{actionNeededLogs.length}</span>
              </div>
            </>
          )}
          actions={(
            <>
              <Button variant="outline" className="h-9 gap-2" onClick={() => navigate('/raw-materials')}>
                Library
              </Button>
              <Button
                className="h-9 gap-2"
                onClick={nextPrimaryAction.onClick}
                disabled={!projectUnavailable && !formula && !allStagesReady}
              >
                {nextPrimaryAction.label}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}
        />

        <div className="space-y-5">
          <BriefDirectionSection brief={brief} />

          <BriefStageBoardSection
            activeAnswerLabels={activeAnswerLabels}
            activeStage={activeStage}
            activeTargetProfile={activeTargetProfile}
            busyStage={busyStage}
            compareCandidates={compareCandidates}
            currentGeneratedRows={currentGeneratedRows}
            currentRecommendedRows={currentRecommendedRows}
            currentRejectedRows={currentRejectedRows}
            decisionAssist={decisionAssist}
            formatDebugPercent={formatDebugPercent}
            handleGenerateRecommendations={handleGenerateRecommendations}
            handleOpenNextStage={handleOpenNextStage}
            handleRemoveStageItem={handleRemoveStageItem}
            handleStageItemState={handleStageItemState}
            openStageWizard={openStageWizard}
            projectPhaseLabel={projectPhaseLabel}
            projectUnavailable={projectUnavailable}
            selectedItemsByStage={selectedItemsByStage}
            stageFlowHint={stageFlowHint}
            stageMap={stageMap}
            stageMaterialExplainMap={stageMaterialExplainMap}
          />

          <DetailSection title="Next step">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">Stage selection</div>
                <div className="mt-2 text-lg font-semibold">{stageBoardCompleted ? 'Selection complete' : `${readyStageCount}/3 stages ready`}</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {stageBoardCompleted
                    ? 'Top, middle, dan base sudah punya keputusan material yang bisa diteruskan.'
                    : projectUnavailable
                      ? 'Stage flow masih berjalan lokal. Lanjutkan wizard per stage lalu generate materials.'
                      : 'Jawab profile note tiap stage lalu generate materials supaya board siap diteruskan ke formula.'}
                </div>
                {!stageBoardCompleted && !projectUnavailable ? (
                  <div className="mt-3">
                    <Button variant="outline" className="rounded-xl" onClick={() => handleOpenNextStage(activeStage)}>
                      Continue {getStageLabel(activeStage)}
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">Formula handoff</div>
                <div className="mt-2 text-lg font-semibold">{allStagesReady ? 'Ready for formula' : 'Not ready yet'}</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {projectUnavailable
                    ? 'Kalau generated materials sudah siap, Anda bisa langsung compose formula dari hasil wizard ini.'
                    : 'Langkah setelah brief adalah jawab profile note per stage, generate materials, lalu teruskan pilihan itu langsung ke formula composer.'}
                </div>
                <div className="mt-3">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => navigate(
                      project
                        ? `/formulas/new?briefId=${brief.id}&projectId=${project.id}`
                        : selectedMaterialIds.length
                          ? `/formulas/new?briefId=${brief.id}&materialIds=${selectedMaterialIds.join(',')}`
                          : `/briefs/${brief.id}`
                    )}
                    disabled={!projectUnavailable && !allStagesReady}
                  >
                    {projectUnavailable ? 'Compose formula' : 'Open formula wizard'}
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">Formula and validation</div>
                <div className="mt-2 text-lg font-semibold">
                  {formula ? formula.name : allStagesReady ? 'Ready for formula' : 'Not ready yet'}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {formula
                    ? `${validationLogs.length} validation note tersambung ke formula ini.`
                    : 'Belum masuk formula. Selesaikan jawaban stage dan generate materials dulu, lalu lanjut ke formula composer.'}
                </div>
                <div className="mt-3">
                  <Button
                    className="rounded-xl"
                    onClick={() => navigate(
                      formula
                        ? `/formulas/${formula.id}`
                        : `/formulas/new?briefId=${brief.id}${project?.id ? `&projectId=${project.id}` : ''}`
                    )}
                    disabled={!formula && !projectUnavailable && !allStagesReady}
                  >
                    {formula ? 'Open formula' : 'Compose formula'}
                  </Button>
                </div>
                {formula ? (
                  <div className="mt-2">
                    <Button
                      variant="ghost"
                      className="rounded-xl px-0 text-primary"
                      onClick={() => navigate(`/validation?formulaId=${formula.id}`)}
                    >
                      Open validation workspace
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </DetailSection>

          <DetailSection title="Validation follow-up">
            {validationLogs.length ? (
              <div className="space-y-3">
                {validationLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="rounded-xl border bg-card p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {formatStatus(log.test_type)}
                      </Badge>
                      <Badge variant={log.status === 'action_needed' ? 'destructive' : 'outline'} className="text-[10px]">
                        {formatStatus(log.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(log.tested_at)}</span>
                    </div>
                    <div className="mt-2 text-sm">{log.note}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                No validation logs yet for this project.
              </div>
            )}
          </DetailSection>

          <DetailSection>
            <DetailMetadata created={brief.created} updated={brief.updated} />
          </DetailSection>
        </div>
      </DetailPageLayout>

      <BriefWizardDialog
        activeStage={activeStage}
        activeTargetProfile={activeTargetProfile}
        busyStage={busyStage}
        currentQuestion={currentQuestion}
        currentQuestions={currentQuestions}
        draftAnswers={draftAnswers}
        handleGenerateRecommendations={handleGenerateRecommendations}
        handleWizardBack={handleWizardBack}
        handleWizardNext={handleWizardNext}
        handleWizardNextStage={handleWizardNextStage}
        handleWizardOptionSelect={handleWizardOptionSelect}
        setWizardOpen={setWizardOpen}
        wizardOpen={wizardOpen}
        wizardQuestionIndex={wizardQuestionIndex}
      />
    </>
  );
};

export default BriefDetailPage;
