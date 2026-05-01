import React from 'react';
import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { formatImpactBandLabel, formatLifeRangeLabel, getStageLabel } from '@/utils/briefProjectWizard.js';
import { stageColorMap } from '@/utils/briefProjectBoard.js';

const BriefWizardDialog = ({
  activeStage,
  activeTargetProfile,
  busyStage,
  currentQuestion,
  currentQuestions,
  draftAnswers,
  handleGenerateRecommendations,
  handleWizardBack,
  handleWizardNext,
  handleWizardNextStage,
  handleWizardOptionSelect,
  setWizardOpen,
  wizardOpen,
  wizardQuestionIndex,
}) => (
  <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
    <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden rounded-[28px] border bg-background p-0">
      <DialogHeader className="border-b px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`capitalize ${stageColorMap[activeStage]}`}>
              {getStageLabel(activeStage)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Step {Math.min(wizardQuestionIndex + 1, Math.max(currentQuestions.length, 1))} of {Math.max(currentQuestions.length, 1)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full">
              {formatImpactBandLabel(activeTargetProfile.impact_band)}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {formatLifeRangeLabel(activeTargetProfile.life_range_hours)}
            </Badge>
          </div>
        </div>
        <DialogTitle className="mt-3 text-xl">Arahkan profile {getStageLabel(activeStage).toLowerCase()} note</DialogTitle>
        <DialogDescription>
          Jawab ekspektasi impact, lifetime, lalu arah aroma stage ini. Wizard akan memakai jawaban itu untuk memperkaya rekomendasi material.
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-hidden px-6 py-5">
        {currentQuestion ? (
          <div className="grid h-full min-h-0 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col gap-4">
              <div className="flex min-h-0 flex-col rounded-2xl border bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(249,246,239,0.98)_100%)] p-4">
                <div className="text-sm font-semibold">{currentQuestion.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {currentQuestion.description || `Pilihan ini akan menentukan rekomendasi material untuk stage ${getStageLabel(activeStage).toLowerCase()}.`}
                </div>
                <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="grid gap-2">
                    {currentQuestion.options.map((option) => {
                      const selected = draftAnswers[activeStage]?.[currentQuestion.id] === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleWizardOptionSelect(currentQuestion.id, option.value)}
                          className={`rounded-2xl border px-4 py-4 text-left transition ${
                            selected
                              ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                              : 'bg-card hover:border-primary/40'
                          }`}
                        >
                          <div className="font-medium">{option.label}</div>
                          {option.hint ? (
                            <div className="mt-1 text-xs text-muted-foreground">{option.hint}</div>
                          ) : null}
                          {option.tags?.length ? (
                            <div className="mt-2 text-[11px] text-muted-foreground">
                              {option.tags.join(', ')}
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto pr-1">
              <div className="space-y-4">
                <div className="rounded-2xl border bg-background/70 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current target</div>
                  <div className="mt-2 text-sm font-semibold">{activeTargetProfile.summary}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary" className="rounded-full">
                      {activeTargetProfile.impact_summary}
                    </Badge>
                    <Badge variant="outline" className="rounded-full">
                      {activeTargetProfile.life_summary}
                    </Badge>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">{activeTargetProfile.stage_goal}</div>
                </div>

                <div className="rounded-2xl border bg-background/70 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Selected direction</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeTargetProfile.selected_labels?.length ? activeTargetProfile.selected_labels.map((label) => (
                      <Badge key={label} variant="outline" className="rounded-full text-xs">
                        {label}
                      </Badge>
                    )) : (
                      <span className="text-sm text-muted-foreground">Belum ada jawaban yang dipilih.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            Wizard untuk stage ini belum punya pertanyaan.
          </div>
        )}
      </div>

      <DialogFooter className="border-t px-6 py-5">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" onClick={handleWizardBack} disabled={wizardQuestionIndex === 0}>
              Back
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={handleWizardNext}
              disabled={!currentQuestion || wizardQuestionIndex >= currentQuestions.length - 1}
            >
              Next question
            </Button>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={handleWizardNextStage}
              disabled={activeStage === 'base'}
            >
              Next stage
            </Button>
            <Button className="rounded-xl gap-2" onClick={handleGenerateRecommendations} disabled={busyStage === activeStage}>
              <Sparkles className="h-4 w-4" />
              {busyStage === activeStage ? 'Generating...' : 'Generate materials'}
            </Button>
          </div>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default BriefWizardDialog;
