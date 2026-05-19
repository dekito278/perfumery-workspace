import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { BookOpenText, Pencil, Printer, Trash2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DeleteFormulaModal from '@/components/DeleteFormulaModal.jsx';
import DetailMetadata from '@/components/DetailMetadata.jsx';
import DetailPageHeader from '@/components/DetailPageHeader.jsx';
import DetailPageLayout from '@/components/DetailPageLayout.jsx';
import DetailSection from '@/components/DetailSection.jsx';
import ExportFormulaButton from '@/components/ExportFormulaButton.jsx';
import FormulaDetailCompositionTab from '@/components/formulas/FormulaDetailCompositionTab.jsx';
import FormulaDetailOverviewTab from '@/components/formulas/FormulaDetailOverviewTab.jsx';
import FormulaDetailWorkbookTab from '@/components/formulas/FormulaDetailWorkbookTab.jsx';
import FormulaEvaluationPanel from '@/components/FormulaEvaluationPanel.jsx';
import { useFormulaDetailPage } from '@/hooks/useFormulaDetailPage.js';
import { useJournalPosts } from '@/hooks/useJournalPosts.js';
import { formatDate, formatGramAmount, formatStatus } from '@/utils/formatting.js';
import { formatPrice } from '@/utils/pricingUtils.js';
import { PACE_PRIORITY_QUERY_KEY } from '@/utils/pacePriority.js';

const FormulaDetailPage = () => {
  const { id } = useParams();
  const {
    compactCompositionRows,
    formula,
    formulaReferenceAdvisories,
    handleBack,
    handleCreatePacedRevision,
    handlePacePriorityModeChange,
    handlePrint,
    hasFormulaItems,
    hasReferenceCoverage,
    hiddenCompositionGroupCount,
    ifraAdvisoryCount,
    isCreatingPacedRevision,
    isDeleteModalOpen,
    itemReferenceLinksMap,
    items,
    legacyAccordCount,
    linkedBriefs,
    linkedProject,
    linkedProjectStageItems,
    loading,
    maxUseAdvisoryCount,
    navigate,
    openRawMaterial,
    pacePriorityMode,
    rawMaterialsById,
    referenceCoverageCount,
    setIsDeleteModalOpen,
    setShowAllReferenceAlerts,
    showAllReferenceAlerts,
    totalCost,
    totalGrams,
    totalPercentage,
    totalReferenceAlertCount,
    typicalUseAdvisoryCount,
    validationLoading,
    validationLogs,
    visibleReferenceAdvisories,
    workbookBoardStats,
    workbookSimulation,
  } = useFormulaDetailPage(id);
  const { getJournalPosts } = useJournalPosts();
  const [linkedJournalPosts, setLinkedJournalPosts] = useState([]);

  useEffect(() => {
    let active = true;

    const loadLinkedJournalPosts = async () => {
      try {
        const posts = await getJournalPosts();
        if (active) {
          setLinkedJournalPosts(posts.filter((post) => post.related_formula_id === id));
        }
      } catch (error) {
        if (active) {
          setLinkedJournalPosts([]);
        }
      }
    };

    loadLinkedJournalPosts();

    return () => {
      active = false;
    };
  }, [getJournalPosts, id]);

  if (loading) {
    return (
      <DetailPageLayout>
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-64 w-full" />
      </DetailPageLayout>
    );
  }

  if (!formula) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>{`${formula.name} - Solivagant`}</title>
        <meta name="description" content={`Detailed view of ${formula.name} formula with gram-based composition and cost breakdown.`} />
      </Helmet>

      <DetailPageLayout>
        <DetailPageHeader
          eyebrow="Formula"
          title={formula.name}
          subtitle={[
            `Code ${formula.code}`,
            formula.category ? formatStatus(formula.category) : null,
            formula.version ? `Version ${formula.version}` : null,
          ].filter(Boolean).join(' / ')}
          badge={
            formula.status && (
              <Badge variant="outline" className="capitalize text-xs">
                {formatStatus(formula.status)}
              </Badge>
            )
          }
          onBack={handleBack}
          backLabel="Back to formulas"
          meta={
            <>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Formula size</span>
                <span className="detail-page-meta-value">{formatGramAmount(totalGrams)}</span>
              </div>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Material cost</span>
                <span className="detail-page-meta-value">{formatPrice(totalCost)}</span>
              </div>
            </>
          }
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  const nextSearchParams = new URLSearchParams();
                  if (linkedBriefs[0]) {
                    nextSearchParams.set('briefId', linkedBriefs[0].id);
                  }
                  nextSearchParams.set(PACE_PRIORITY_QUERY_KEY, pacePriorityMode);
                  navigate(`/formulas/${id}/edit?${nextSearchParams.toString()}`);
                }}
                className="gap-2 h-9"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
              <ExportFormulaButton formula={formula} items={items} />
              <Button variant="outline" onClick={handlePrint} className="gap-2 h-9">
                <Printer className="w-4 h-4" />
                Print
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/journal/new?formulaId=${id}`)}
                className="gap-2 h-9"
              >
                <BookOpenText className="w-4 h-4" />
                Journal note
              </Button>
              <Button variant="destructive" onClick={() => setIsDeleteModalOpen(true)} className="gap-2 h-9">
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </>
          }
        />

        <div className="space-y-5 print-full-width">
          <div className="rounded-[28px] border border-white/80 bg-white/90 p-3 shadow-sm sm:p-4">
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="h-auto flex-wrap justify-start rounded-2xl bg-muted/70 p-1">
                <TabsTrigger value="overview" className="rounded-xl">Overview</TabsTrigger>
                <TabsTrigger value="workbook" className="rounded-xl">Workbook</TabsTrigger>
                <TabsTrigger value="composition" className="rounded-xl">Composition</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-5">
                <FormulaDetailOverviewTab
                  formulaReferenceAdvisories={formulaReferenceAdvisories}
                  hasFormulaItems={hasFormulaItems}
                  hasReferenceCoverage={hasReferenceCoverage}
                  ifraAdvisoryCount={ifraAdvisoryCount}
                  items={items}
                  legacyAccordCount={legacyAccordCount}
                  maxUseAdvisoryCount={maxUseAdvisoryCount}
                  referenceCoverageCount={referenceCoverageCount}
                  setShowAllReferenceAlerts={setShowAllReferenceAlerts}
                  showAllReferenceAlerts={showAllReferenceAlerts}
                  totalCost={totalCost}
                  totalReferenceAlertCount={totalReferenceAlertCount}
                  typicalUseAdvisoryCount={typicalUseAdvisoryCount}
                  visibleReferenceAdvisories={visibleReferenceAdvisories}
                  workbookSimulation={workbookSimulation}
                />
              </TabsContent>

              <TabsContent value="workbook" className="space-y-5">
                <FormulaDetailWorkbookTab
                  compactCompositionRows={compactCompositionRows}
                  handleCreatePacedRevision={handleCreatePacedRevision}
                  handlePacePriorityModeChange={handlePacePriorityModeChange}
                  hasFormulaItems={hasFormulaItems}
                  hiddenCompositionGroupCount={hiddenCompositionGroupCount}
                  isCreatingPacedRevision={isCreatingPacedRevision}
                  itemReferenceLinksMap={itemReferenceLinksMap}
                  items={items}
                  pacePriorityMode={pacePriorityMode}
                  rawMaterialsById={rawMaterialsById}
                  totalCost={totalCost}
                  workbookBoardStats={workbookBoardStats}
                />
              </TabsContent>

              <TabsContent value="composition" className="space-y-5">
                <FormulaDetailCompositionTab
                  hasFormulaItems={hasFormulaItems}
                  items={items}
                  onOpenRawMaterial={openRawMaterial}
                  totalCost={totalCost}
                  totalGrams={totalGrams}
                  totalPercentage={totalPercentage}
                />
              </TabsContent>
            </Tabs>
          </div>

          {formula.notes ? (
            <DetailSection title="Notes">
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">{formula.notes}</p>
            </DetailSection>
          ) : null}

          <DetailSection title={linkedBriefs.length ? 'Brief context' : 'Standalone formula'}>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  {linkedBriefs.length
                    ? 'Brief memberi arah sebelum evaluasi. Link formula ini ke brief supaya revision notes tidak kehilangan tujuan awal.'
                    : 'Formula ini berdiri sendiri tanpa brief. Anda tetap bisa edit komposisi, buat PACE revision, dan lanjut validasi langsung dari formula.'}
                </div>
                <Button variant="outline" className="rounded-xl" onClick={() => navigate(`/briefs?formulaId=${id}`)}>
                  {linkedBriefs.length ? 'Open brief workspace' : 'Create related brief'}
                </Button>
              </div>

              {linkedBriefs.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {linkedBriefs.map((brief) => (
                    <div key={brief.id} className="rounded-xl border bg-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">{brief.title}</div>
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {brief.status || 'draft'}
                        </Badge>
                      </div>
                      {brief.mood_story ? (
                        <p className="mt-3 text-sm text-muted-foreground">{brief.mood_story}</p>
                      ) : null}
                      {brief.performance_target ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Performance: {brief.performance_target}
                        </p>
                      ) : null}
                      <div className="mt-3 text-xs text-muted-foreground">
                        Updated {formatDate(brief.updated || brief.created)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                  No brief is linked. This formula can stay standalone, or you can create a related brief later for project direction.
                </div>
              )}

              {linkedProject ? (
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold">Project stage summary</div>
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {linkedProject.current_stage || 'top'}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {linkedProjectStageItems.length
                      ? `${linkedProjectStageItems.length} project stage materials shaped this formula before adjustment.`
                      : 'This brief project does not have selected stage materials yet.'}
                  </div>
                  {linkedProjectStageItems.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['top', 'middle', 'base'].map((stage) => {
                        const stageCount = linkedProjectStageItems.filter((item) => item.stage === stage).length;
                        return (
                          <Badge key={stage} variant="secondary" className="capitalize text-[10px]">
                            {stage} {stageCount}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </DetailSection>

          <DetailSection title="Journal links">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Catatan Journal bisa dikaitkan ke formula ini untuk menyimpan pengalaman, revisi accord, dan observasi pemakaian.
                </div>
                <Button variant="outline" className="rounded-xl gap-2" onClick={() => navigate(`/journal/new?formulaId=${id}`)}>
                  <BookOpenText className="h-4 w-4" />
                  New linked note
                </Button>
              </div>

              {linkedJournalPosts.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {linkedJournalPosts.map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => navigate(`/journal/${post.id}`)}
                      className="rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:bg-muted/20"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">{post.title || 'Untitled note'}</div>
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {post.status || 'draft'}
                        </Badge>
                      </div>
                      {post.excerpt ? (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
                      ) : null}
                      <div className="mt-3 text-xs text-muted-foreground">
                        Updated {formatDate(post.updated || post.created)}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                  Belum ada Journal note yang terhubung ke formula ini.
                </div>
              )}
            </div>
          </DetailSection>

          <DetailSection title="Validation workflow">
            {validationLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-xs text-muted-foreground mb-1">Saved notes</div>
                    <div className="text-lg font-semibold">{validationLogs.length}</div>
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-xs text-muted-foreground mb-1">Action needed</div>
                    <div className="text-lg font-semibold text-amber-600">
                      {validationLogs.filter((log) => log.status === 'action_needed').length}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-xs text-muted-foreground mb-1">Last logged</div>
                    <div className="text-lg font-semibold">
                      {validationLogs[0] ? formatDate(validationLogs[0].tested_at || validationLogs[0].created) : '-'}
                    </div>
                  </div>
                </div>

                <FormulaEvaluationPanel
                  formulas={formula ? [formula] : []}
                  validationLogs={validationLogs}
                  selectedFormulaId={formula?.id || null}
                  onOpenFormula={() => navigate(`/formulas/${id}`)}
                  onOpenValidationWorkspace={() => navigate(`/validation?formulaId=${id}`)}
                />
              </div>
            )}
          </DetailSection>

          <DetailSection>
            <DetailMetadata created={formula.created} updated={formula.updated} />
          </DetailSection>
        </div>
      </DetailPageLayout>

      <DeleteFormulaModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        formulaId={id}
        formulaName={formula?.name}
        onDeleteSuccess={() => navigate('/formulas')}
      />
    </>
  );
};

export default FormulaDetailPage;
