import React from 'react';
import { Plus, Sparkles, WandSparkles, XCircle } from 'lucide-react';
import DetailSection from '@/components/DetailSection.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatStatus } from '@/utils/formatting.js';
import { getStageLabel } from '@/utils/briefProjectWizard.js';
import { STAGES, stageColorMap } from '@/utils/briefProjectBoard.js';
import { getArchitectureRoleLabel } from '@/utils/materialCompositionProfile.js';

const formatEffectTag = (tag) => String(tag || '').replace(/_/g, ' ').trim();
const getCandidateUsageLabel = (item, explanation) => item?.recommended_usage_label || explanation?.recommended_usage_label || null;
const getCandidateEffectTags = (item, explanation) => (
  Array.isArray(item?.effect_tags) && item.effect_tags.length
    ? item.effect_tags
    : Array.isArray(explanation?.effect_tags)
      ? explanation.effect_tags
      : []
);
const getCandidateLearningSignals = (item, explanation) => (
  Array.isArray(item?.learning_signals) && item.learning_signals.length
    ? item.learning_signals
    : Array.isArray(explanation?.learning_signals)
      ? explanation.learning_signals
      : []
).slice(0, 2);

const BriefStageBoardSection = ({
  activeAnswerLabels,
  activeStage,
  activeTargetProfile,
  busyStage,
  compareCandidates,
  currentGeneratedRows,
  currentRecommendedRows,
  currentRejectedRows,
  decisionAssist,
  formatDebugPercent,
  handleGenerateRecommendations,
  handleOpenNextStage,
  handleRemoveStageItem,
  handleStageItemState,
  openStageWizard,
  projectPhaseLabel,
  projectUnavailable,
  selectedItemsByStage,
  stageFlowHint,
  stageMap,
  stageMaterialExplainMap,
}) => (
  <>
    <DetailSection title="Stage flow">
      {projectUnavailable ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Project persistence belum sinkron, jadi wizard ini berjalan dalam mode lokal dulu. Kamu tetap bisa isi profil top, middle, dan base lalu langsung lanjut compose formula dari hasil generate.
        </div>
      ) : null}
      {stageFlowHint ? (
        <div className="mb-4 rounded-xl border bg-background/60 p-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{projectPhaseLabel}.</span> {stageFlowHint}
        </div>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-3">
        {STAGES.map((stage) => {
          const stageRows = selectedItemsByStage.get(stage) || [];
          const stageState = stageMap.get(stage);
          const isActive = activeStage === stage;
          return (
            <button
              key={stage}
              type="button"
              onClick={() => openStageWizard(stage)}
              className={`rounded-2xl border p-4 text-left transition ${isActive ? 'border-primary bg-primary/5 shadow-sm' : 'bg-card hover:border-primary/40'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <Badge variant="outline" className={`capitalize ${stageColorMap[stage]}`}>
                  {getStageLabel(stage)}
                </Badge>
                <span className="text-xs text-muted-foreground">{stageRows.length} selected</span>
              </div>
              <div className="mt-3 text-sm font-semibold">
                {stageState?.target_profile?.summary || `${getStageLabel(stage)} belum dibentuk`}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {stageState?.status ? formatStatus(stageState.status) : 'Pending'}
              </div>
              <div className="mt-3 text-xs font-medium text-primary">
                {stageRows.length ? 'Edit profile' : 'Start wizard'}
              </div>
            </button>
          );
        })}
      </div>
    </DetailSection>

    <DetailSection title={`${getStageLabel(activeStage)} profile`}>
      <div className="grid gap-5 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <WandSparkles className="h-4 w-4 text-primary" />
            Wizard ringkas
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Pilihan aroma untuk stage ini sekarang dibuka lewat modal bertingkat. Anda bisa berhenti di tengah, lanjut ke stage berikutnya, atau kembali edit kapan saja.
          </div>

          <div className="mt-4 space-y-2">
            {activeAnswerLabels.length ? activeAnswerLabels.map((answer) => (
              <div key={answer.id} className="rounded-xl border bg-background/70 px-3 py-3">
                <div className="text-xs text-muted-foreground">{answer.title}</div>
                <div className="mt-1 text-sm font-medium">{answer.label}</div>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                Belum ada jawaban untuk stage ini. Buka wizard lalu pilih arah aromanya satu per satu.
              </div>
            )}
          </div>

          <div className="mt-4 rounded-xl border bg-background/60 p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Target profile</div>
            <div className="mt-2 text-sm font-semibold">{activeTargetProfile.summary}</div>
            <div className="mt-2 text-xs text-muted-foreground">{activeTargetProfile.stage_goal}</div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => openStageWizard(activeStage)}>
              {activeAnswerLabels.length ? 'Edit wizard' : `Start ${getStageLabel(activeStage)} wizard`}
            </Button>
            <Button className="rounded-xl gap-2" onClick={handleGenerateRecommendations} disabled={busyStage === activeStage}>
              <Sparkles className="h-4 w-4" />
              {busyStage === activeStage ? 'Generating...' : 'Generate materials'}
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => handleOpenNextStage(STAGES[Math.min(STAGES.indexOf(activeStage) + 1, STAGES.length - 1)])}
              disabled={activeStage === 'base'}
            >
              Next stage
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Recommendation workspace</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Tabel kiri untuk review kandidat stage ini, lalu `Add` akan masuk ke panel kanan. `Skip` akan mengeluarkan kandidat itu dari antrian aktif supaya kandidat berikutnya naik ke tabel.
                </div>
              </div>
              <Badge variant="outline" className="rounded-full">
                {currentRecommendedRows.length} queued
              </Badge>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
              <div className="min-w-0 rounded-xl border bg-background/55">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold">Candidate table</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Menampilkan kandidat aktif paling relevan untuk stage ini.
                    </div>
                  </div>
                  <Badge variant="secondary" className="rounded-full">
                    {compareCandidates.length} visible
                  </Badge>
                </div>

                {compareCandidates.length ? (
                  <div className="max-h-[38rem] overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                        <tr className="border-b text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Material</th>
                          <th className="px-3 py-3 font-medium">Role</th>
                          <th className="px-3 py-3 font-medium">Usage</th>
                          <th className="px-3 py-3 font-medium">Fit</th>
                          <th className="px-4 py-3 text-right font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compareCandidates.map((item) => {
                          const explanation = stageMaterialExplainMap.get(item.raw_material_id);
                          const usageLabel = getCandidateUsageLabel(item, explanation);
                          const effectTags = getCandidateEffectTags(item, explanation).slice(0, 2);
                          const learningSignals = getCandidateLearningSignals(item, explanation);
                          const architectureRoleLabel = getArchitectureRoleLabel({ candidate: item, stage: activeStage });
                          return (
                            <tr key={item.id} className="border-b align-top last:border-b-0">
                              <td className="px-4 py-4">
                                <div className="min-w-[18rem]">
                                  <div className="text-sm font-semibold">{item.expand?.raw_material_id?.name || 'Unknown material'}</div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {item.recommendation_reason || 'Generated from stage fit'}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {item.primary_function ? (
                                      <Badge variant="secondary" className="rounded-full text-[10px] capitalize">
                                        {formatStatus(item.primary_function)}
                                      </Badge>
                                    ) : null}
                                    {item.secondary_function ? (
                                      <Badge variant="outline" className="rounded-full text-[10px] capitalize">
                                        {formatStatus(item.secondary_function)}
                                      </Badge>
                                    ) : null}
                                    <Badge variant="outline" className="rounded-full text-[10px]">
                                      {architectureRoleLabel}
                                    </Badge>
                                    {effectTags.map((tag) => (
                                      <Badge key={`${item.id}-${tag}`} variant="outline" className="rounded-full text-[10px] capitalize">
                                        {formatEffectTag(tag)}
                                      </Badge>
                                    ))}
                                    {learningSignals.map((signal) => (
                                      <Badge key={`${item.id}-${signal}`} variant="outline" className="rounded-full border-emerald-200 text-[10px] text-emerald-700">
                                        {signal}
                                      </Badge>
                                    ))}
                                    {item.warning ? (
                                      <Badge variant="outline" className="rounded-full text-[10px] text-amber-700">
                                        {item.warning}
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-4 text-xs text-muted-foreground">
                                {architectureRoleLabel}
                              </td>
                              <td className="px-3 py-4 text-xs text-muted-foreground">
                                {usageLabel || '-'}
                              </td>
                              <td className="px-3 py-4">
                                <div className="text-sm font-semibold">{Number(item.fit_score || 0).toFixed(2)}</div>
                                {explanation?.score_breakdown ? (
                                  <div className="mt-1 text-[11px] text-muted-foreground">
                                    Class {formatDebugPercent(explanation.score_breakdown.class_fit_score)} • Life {formatDebugPercent(explanation.score_breakdown.life_fit_score)}
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" className="rounded-xl" onClick={() => handleStageItemState(item, 'selected')}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add
                                  </Button>
                                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => handleStageItemState(item, 'rejected')}>
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Skip
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-sm text-muted-foreground">
                    Belum ada kandidat aktif. Generate materials dulu atau pulihkan dari daftar skipped di bawah.
                  </div>
                )}
              </div>

              <div className="rounded-xl border bg-background/60">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold">Added to {getStageLabel(activeStage).toLowerCase()}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Material yang sudah Anda pilih untuk stage ini.
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full">
                    {currentGeneratedRows.length} added
                  </Badge>
                </div>

                <div className="max-h-[38rem] overflow-auto p-4">
                  {currentGeneratedRows.length ? (
                    <div className="space-y-3">
                      {currentGeneratedRows.map((item) => {
                        const explanation = stageMaterialExplainMap.get(item.raw_material_id);
                        const usageLabel = getCandidateUsageLabel(item, explanation);
                        const architectureRoleLabel = getArchitectureRoleLabel({ candidate: item, stage: activeStage });
                        return (
                          <div key={item.id} className="rounded-xl border bg-background/80 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold">{item.expand?.raw_material_id?.name || 'Unknown material'}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {item.recommendation_reason || 'Selected for this stage'}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold">{Number(item.fit_score || 0).toFixed(2)}</div>
                                <div className="text-[11px] text-muted-foreground">fit</div>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant="secondary" className="rounded-full text-[10px] capitalize">
                                {item.selection_state === 'manual' ? 'manual override' : 'added'}
                              </Badge>
                              <Badge variant="outline" className="rounded-full text-[10px]">
                                {architectureRoleLabel}
                              </Badge>
                              {usageLabel ? (
                                <Badge variant="outline" className="rounded-full text-[10px] text-sky-700">
                                  {usageLabel}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Button size="sm" variant="outline" className="rounded-xl" onClick={() => handleStageItemState(item, 'recommended')}>
                                Remove
                              </Button>
                              <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => handleRemoveStageItem(item)}>
                                Delete
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                      Belum ada material yang di-add untuk stage ini. Pilih dari tabel kiri.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {currentRejectedRows.length ? (
              <div className="mt-4 rounded-xl border bg-background/50 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Skipped for now</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {currentRejectedRows.map((item) => (
                    <Button
                      key={item.id}
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => handleStageItemState(item, 'recommended')}
                    >
                      {item.expand?.raw_material_id?.name || 'Unknown material'}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {compareCandidates.length ? (
              <div className="mt-4 rounded-xl border bg-background/55 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Compare candidates</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Lihat ranking stage ini berdampingan supaya keputusan keep atau exclude lebih mudah diaudit.
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full">
                    {compareCandidates.length} compared
                  </Badge>
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {compareCandidates.map((item) => {
                    const explanation = stageMaterialExplainMap.get(item.raw_material_id);
                    const breakdown = explanation?.score_breakdown || null;
                    const usageLabel = getCandidateUsageLabel(item, explanation);
                    const effectTags = getCandidateEffectTags(item, explanation).slice(0, 2);
                    const learningSignals = getCandidateLearningSignals(item, explanation);
                    const architectureRoleLabel = getArchitectureRoleLabel({ candidate: item, stage: activeStage });
                    return (
                      <div key={`compare-${item.id}`} className="rounded-xl border bg-background/75 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">{item.expand?.raw_material_id?.name || 'Unknown material'}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {item.recommendation_reason || 'Generated from stage fit'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold">{Number(item.fit_score || 0).toFixed(2)}</div>
                            <div className="text-[11px] text-muted-foreground">fit score</div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant={item.selection_state === 'rejected' ? 'outline' : 'secondary'} className="rounded-full text-[10px] capitalize">
                            {item.selection_state === 'manual' ? 'manual' : item.selection_state}
                          </Badge>
                          {item.primary_function ? (
                            <Badge variant="outline" className="rounded-full text-[10px] capitalize">
                              {formatStatus(item.primary_function)}
                            </Badge>
                          ) : null}
                          {item.secondary_function ? (
                            <Badge variant="outline" className="rounded-full text-[10px] capitalize">
                              {formatStatus(item.secondary_function)}
                            </Badge>
                          ) : null}
                          <Badge variant="outline" className="rounded-full text-[10px]">
                            {architectureRoleLabel}
                          </Badge>
                          {usageLabel ? (
                            <Badge variant="outline" className="rounded-full text-[10px] text-sky-700">
                              {usageLabel}
                            </Badge>
                          ) : null}
                          {effectTags.map((tag) => (
                            <Badge key={`compare-${item.id}-${tag}`} variant="outline" className="rounded-full text-[10px] capitalize">
                              {formatEffectTag(tag)}
                            </Badge>
                          ))}
                          {learningSignals.map((signal) => (
                            <Badge key={`compare-${item.id}-${signal}`} variant="outline" className="rounded-full border-emerald-200 text-[10px] text-emerald-700">
                              {signal}
                            </Badge>
                          ))}
                        </div>

                        {breakdown ? (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <div className="rounded-lg border bg-background/60 px-3 py-2 text-[11px] text-muted-foreground">
                              Stage {Number(breakdown.stage_natural_score || 0).toFixed(1)} • Class {formatDebugPercent(breakdown.class_fit_score)}
                            </div>
                            <div className="rounded-lg border bg-background/60 px-3 py-2 text-[11px] text-muted-foreground">
                              Function {formatDebugPercent(breakdown.function_fit_score)} • Life {formatDebugPercent(breakdown.life_fit_score)}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {decisionAssist.suggestions.length ? (
                  <div className="mt-4 rounded-xl border bg-background/65 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Decision assist</div>
                    <div className="mt-3 space-y-3">
                      {decisionAssist.suggestions.map((suggestion, index) => (
                        <div key={`${suggestion.type}-${index}`} className="rounded-lg border bg-background/80 px-3 py-3">
                          <div className="text-sm font-semibold">{suggestion.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{suggestion.message}</div>
                        </div>
                      ))}
                    </div>
                    {decisionAssist.duplicatePairs.length ? (
                      <div className="mt-4 grid gap-2 xl:grid-cols-2">
                        {decisionAssist.duplicatePairs.slice(0, 4).map((pair) => (
                          <div key={`${pair.keep_item_id}-${pair.drop_item_id}`} className="rounded-lg border bg-background/80 px-3 py-3">
                            <div className="text-sm font-medium">{pair.keep_name} vs {pair.drop_name}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Overlap {pair.overlap_score}% • {pair.reason}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </DetailSection>
  </>
);

export default BriefStageBoardSection;
