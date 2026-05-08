import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Eye, FolderTree, RefreshCw, ScanSearch, ShieldCheck, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import DataTable from '@/components/DataTable.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import ConfirmDialog from '@/components/ConfirmDialog.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getRawMaterialOptions, mergeRawMaterialIntoMaster } from '@/services/rawMaterialsService.js';
import { buildRawMaterialDuplicateAudit } from '@/utils/rawMaterialDuplicateAudit.js';

const SummaryCard = ({ label, value, tone = 'default' }) => {
  const toneClassName = {
    default: 'border-white/70 bg-white/80',
    warning: 'border-amber-200/70 bg-amber-50/80',
    success: 'border-emerald-200/70 bg-emerald-50/80',
  }[tone];

  return (
    <Card className={`rounded-[28px] shadow-sm ${toneClassName}`}>
      <CardHeader className="pb-3">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-[-0.03em] text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
};

const MaterialPill = ({ material }) => {
  const guidanceCount =
    (Number(material.reference_impact) > 0 ? 1 : 0)
    + (Number(material.reference_life_hours) > 0 ? 1 : 0)
    + (Number(material.ifra_limit) > 0 ? 1 : 0)
    + (material.cas_number ? 1 : 0)
    + (material.workbook_code ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-medium text-foreground">{material.name}</span>
      {material.workbook_code ? <Badge variant="outline">{material.workbook_code}</Badge> : null}
      {material.cas_number ? <Badge variant="outline">CAS {material.cas_number}</Badge> : null}
      {material.is_diluted ? <Badge variant="secondary">Dilution</Badge> : null}
      <Badge variant={guidanceCount >= 4 ? 'default' : 'secondary'}>
        {guidanceCount >= 4 ? 'Guidance rich' : `Guidance ${guidanceCount}/5`}
      </Badge>
    </div>
  );
};

const renderMaterialList = (materials) => (
  <div className="space-y-2">
    {materials.map((material) => (
      <MaterialPill key={material.id} material={material} />
    ))}
  </div>
);

const renderSynonymList = (names) => (
  <div className="flex flex-wrap gap-2">
    {(names || []).map((name) => (
      <Badge key={name} variant="secondary" className="font-normal">
        {name}
      </Badge>
    ))}
  </div>
);

const RawMaterialAuditPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mergeIntent, setMergeIntent] = useState(null);
  const [mergeSubmitting, setMergeSubmitting] = useState(false);
  const [bulkMergeIntentOpen, setBulkMergeIntentOpen] = useState(false);
  const [bulkMergeSubmitting, setBulkMergeSubmitting] = useState(false);

  const loadAudit = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const rows = await getRawMaterialOptions({ forceRefresh });
      setMaterials(rows || []);
    } catch (error) {
      console.error('Failed to load raw material audit:', error);
      toast.error('Failed to load raw material audit');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAudit(true);
  }, [loadAudit]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        loadAudit(true);
      }
    };

    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('pageshow', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('pageshow', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadAudit]);

  const audit = useMemo(() => buildRawMaterialDuplicateAudit(materials), [materials]);
  const safeCleanupCandidateCount = useMemo(
    () => audit.collapsedNameGroups.length + audit.slashAliasCandidates.length,
    [audit]
  );

  const openMaterial = (rawMaterialId) => {
    if (!rawMaterialId) {
      return;
    }

    navigate(`/raw-material/${rawMaterialId}`, {
      state: { from: `${location.pathname}${location.search}` },
    });
  };

  const buildCollapsedMergeIntent = (row) => ({
    kind: 'collapsed-group',
    title: `Merge ${row.duplicates.length} duplicate row${row.duplicates.length > 1 ? 's' : ''}`,
    description: `Master "${row.master.name}" will stay. Duplicate rows will be moved to this master, references will be reassigned, then the duplicate rows will be removed.`,
    master: row.master,
    duplicates: row.duplicates,
  });

  const buildAliasMergeIntent = (row) => ({
    kind: 'alias-pair',
    title: 'Merge alias candidate',
    description: `Alias row "${row.source.name}" will be merged into "${row.target.name}". Usage, shortlist, and reference links will be reassigned automatically.`,
    master: row.target,
    duplicates: [row.source],
  });

  const handleConfirmMerge = async () => {
    if (!mergeIntent?.master?.id || !mergeIntent.duplicates?.length) {
      return;
    }

    setMergeSubmitting(true);
    try {
      for (const duplicate of mergeIntent.duplicates) {
        await mergeRawMaterialIntoMaster(mergeIntent.master.id, duplicate.id);
      }

      toast.success(
        mergeIntent.kind === 'collapsed-group'
          ? `${mergeIntent.duplicates.length} duplicate raw material berhasil digabung ke ${mergeIntent.master.name}.`
          : `Alias raw material berhasil digabung ke ${mergeIntent.master.name}.`
      );
      setMergeIntent(null);
      await loadAudit(true);
    } catch (error) {
      console.error('Failed to merge raw material audit candidate:', error);
      toast.error(error.message || 'Failed to merge raw materials');
    } finally {
      setMergeSubmitting(false);
    }
  };

  const handleConfirmBulkMerge = async () => {
    const collapsedGroups = audit.collapsedNameGroups || [];
    const aliasCandidates = audit.slashAliasCandidates || [];
    const jobs = [
      ...collapsedGroups.flatMap((row) => row.duplicates.map((duplicate) => ({
        kind: 'collapsed-group',
        master: row.master,
        duplicate,
      }))),
      ...aliasCandidates.map((row) => ({
        kind: 'alias-pair',
        master: row.target,
        duplicate: row.source,
      })),
    ];

    if (!jobs.length) {
      setBulkMergeIntentOpen(false);
      toast.info('Tidak ada kandidat safe cleanup untuk di-merge.');
      return;
    }

    setBulkMergeSubmitting(true);
    let successCount = 0;
    const failures = [];

    try {
      for (const job of jobs) {
        try {
          await mergeRawMaterialIntoMaster(job.master.id, job.duplicate.id);
          successCount += 1;
        } catch (error) {
          failures.push({
            masterName: job.master.name,
            duplicateName: job.duplicate.name,
            message: error.message || 'Unknown merge error',
          });
        }
      }

      setBulkMergeIntentOpen(false);
      await loadAudit(true);

      if (successCount && !failures.length) {
        toast.success(`${successCount} safe duplicate raw material berhasil digabung.`);
        return;
      }

      if (successCount && failures.length) {
        toast.warning(
          `${successCount} merge berhasil, ${failures.length} kandidat dilewati. Contoh: ${failures[0].duplicateName} -> ${failures[0].masterName} (${failures[0].message})`
        );
        return;
      }

      toast.error(failures[0]?.message || 'Bulk merge gagal.');
    } finally {
      setBulkMergeSubmitting(false);
    }
  };

  const collapsedColumns = [
    {
      key: 'label',
      label: 'Master candidate',
      render: (row) => (
        <div className="space-y-2">
          <MaterialPill material={row.master} />
          <p className="text-sm text-muted-foreground">{row.reason}</p>
        </div>
      ),
    },
    {
      key: 'duplicates',
      label: 'Duplicate rows',
      render: (row) => renderMaterialList(row.duplicates),
    },
  ];

  const aliasColumns = [
    {
      key: 'source',
      label: 'Alias row',
      render: (row) => (
        <div className="space-y-2">
          <MaterialPill material={row.source} />
          <p className="text-sm text-muted-foreground">Alias match: {row.alias}</p>
        </div>
      ),
    },
    {
      key: 'target',
      label: 'Suggested master',
      render: (row) => (
        <div className="space-y-2">
          <MaterialPill material={row.target} />
          <p className="text-sm text-muted-foreground">{row.reason}</p>
        </div>
      ),
    },
  ];

  const practicalColumns = [
    {
      key: 'master',
      label: 'Recommended merge',
      render: (row) => (
        <div className="space-y-2">
          <MaterialPill material={row.master} />
          <div className="text-sm text-muted-foreground">
            Remove: <span className="font-medium text-foreground">{row.duplicate.name}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'synonyms',
      label: 'Detected synonyms',
      render: (row) => (
        <div className="space-y-2">
          {renderSynonymList(row.synonymNames)}
          <p className="text-sm text-muted-foreground">{row.note}</p>
        </div>
      ),
    },
    {
      key: 'reason',
      label: 'Why flagged',
      render: (row) => (
        <div className="space-y-2">
          <Badge variant={row.confidence === 'high' ? 'default' : 'secondary'}>
            {row.confidence === 'high' ? 'High confidence' : 'Needs quick review'}
          </Badge>
          <p className="text-sm text-muted-foreground">{row.reason}</p>
        </div>
      ),
    },
  ];

  const casColumns = [
    {
      key: 'casNumber',
      label: 'CAS',
      render: (row) => (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{row.casNumber}</span>
            <Badge variant={row.classification === 'worth-review' ? 'default' : 'secondary'}>
              {row.classification === 'worth-review' ? 'Review merge' : 'Keep separate'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{row.reason}</p>
        </div>
      ),
    },
    {
      key: 'materials',
      label: 'Materials',
      render: (row) => renderMaterialList(row.materials),
    },
  ];

  const primaryAction = (row) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="table-action-button"
      onClick={() => openMaterial(row.master?.id || row.target?.id || row.source?.id || row.materials?.[0]?.id)}
      title="Open raw material"
      aria-label="Open raw material"
    >
      <Eye className="h-4 w-4" />
    </Button>
  );

  const collapsedActions = (row) => (
    <>
      {primaryAction(row)}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="table-action-button text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
        onClick={() => setMergeIntent(buildCollapsedMergeIntent(row))}
        title="Merge duplicate rows"
        aria-label={`Merge duplicates into ${row.master.name}`}
      >
        Merge
      </Button>
    </>
  );

  const aliasActions = (row) => (
    <>
      {primaryAction(row)}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="table-action-button text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
        onClick={() => setMergeIntent(buildAliasMergeIntent(row))}
        title="Merge alias row"
        aria-label={`Merge ${row.source.name} into ${row.target.name}`}
      >
        Merge
      </Button>
    </>
  );

  const practicalActions = (row) => (
    <>
      {primaryAction(row)}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="table-action-button text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
        onClick={() => setMergeIntent({
          kind: row.type,
          title: row.type === 'collapsed-group' ? 'Merge practical candidate' : 'Merge synonym candidate',
          description: `Duplicate row "${row.duplicate.name}" will be merged into "${row.master.name}".`,
          master: row.master,
          duplicates: [row.duplicate],
        })}
        title={row.actionLabel}
        aria-label={`${row.actionLabel} ${row.duplicate.name}`}
      >
        Merge
      </Button>
    </>
  );

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Material Audit - Solivagant</title>
      </Helmet>

      <div className="page-container space-y-6">
        <PageHeader
          eyebrow="Data quality"
          title="Raw material audit"
          description="Audit duplicate candidates, alias collisions, dan CAS groups langsung dari data live."
          action="Refresh audit"
          actionIcon={RefreshCw}
          onAction={() => loadAudit(true)}
        />

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-[28px]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Materials scanned" value={audit.summary.materialCount} />
            <SummaryCard label="Practical queue" value={audit.summary.practicalMergeCandidateCount} tone="warning" />
            <SummaryCard label="Safe name groups" value={audit.summary.collapsedNameGroupCount} tone="warning" />
            <SummaryCard label="Alias candidates" value={audit.summary.slashAliasCandidateCount} tone="warning" />
            <SummaryCard label="CAS keep separate" value={audit.summary.keepSeparateGroupCount} tone="success" />
          </div>
        )}

        <Card className="rounded-[32px] border-white/70 bg-white/80 shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline">Live dataset</Badge>
              <Badge variant="outline">Smart-match aligned</Badge>
            </div>
            <CardTitle className="text-xl">Candidate buckets</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tab pertama untuk kandidat yang biasanya aman dirapikan, tab kedua untuk review manual, dan tab ketiga untuk grup yang sengaja dipertahankan terpisah.
            </p>
          </CardHeader>
          <CardContent>
            <Card className="mb-6 rounded-[28px] border-emerald-200/70 bg-emerald-50/70 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <WandSparkles className="h-5 w-5 text-emerald-700" />
                  Practical merge queue
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Daftar kandidat merge yang paling actionable, lengkap dengan nama sinonim yang terdeteksi.
                </p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-48 rounded-[24px]" />
                ) : audit.practicalMergeCandidates.length ? (
                  <DataTable
                    columns={practicalColumns}
                    data={audit.practicalMergeCandidates}
                    actions={practicalActions}
                    emptyMessage="No practical merge candidates found."
                  />
                ) : (
                  <EmptyState
                    icon={ShieldCheck}
                    title="Practical queue bersih"
                    description="Belum ada kandidat merge yang cukup jelas untuk langsung ditindak."
                  />
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="safe" className="space-y-4">
              <TabsList className="h-auto flex-wrap rounded-2xl bg-muted/70 p-1">
                <TabsTrigger value="safe" className="rounded-xl">Safe cleanup</TabsTrigger>
                <TabsTrigger value="review" className="rounded-xl">Manual review</TabsTrigger>
                <TabsTrigger value="keep" className="rounded-xl">Keep separate</TabsTrigger>
              </TabsList>

              <TabsContent value="safe" className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-amber-200/70 bg-amber-50/70 px-4 py-4">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">Bulk safe cleanup</div>
                    <p className="text-sm text-muted-foreground">
                      Merge semua kandidat aman sekaligus dari collapsed-name groups dan alias candidates.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="gap-2 rounded-2xl"
                    disabled={loading || bulkMergeSubmitting || safeCleanupCandidateCount === 0}
                    onClick={() => setBulkMergeIntentOpen(true)}
                  >
                    <WandSparkles className="h-4 w-4" />
                    {bulkMergeSubmitting ? 'Merging...' : `Merge all safe (${safeCleanupCandidateCount})`}
                  </Button>
                </div>

                <Card className="rounded-[28px] border-white/70 bg-background/80 shadow-none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FolderTree className="h-5 w-5 text-primary" />
                      Collapsed name groups
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-48 rounded-[24px]" />
                    ) : audit.collapsedNameGroups.length ? (
                      <DataTable
                        columns={collapsedColumns}
                        data={audit.collapsedNameGroups}
                        actions={collapsedActions}
                        emptyMessage="No collapsed-name groups found."
                      />
                    ) : (
                      <EmptyState
                        icon={ShieldCheck}
                        title="Tidak ada duplicate aman"
                        description="Nama yang hanya beda spasi atau tanda baca sudah bersih."
                      />
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-[28px] border-white/70 bg-background/80 shadow-none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ScanSearch className="h-5 w-5 text-primary" />
                      Alias candidates
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-48 rounded-[24px]" />
                    ) : audit.slashAliasCandidates.length ? (
                      <DataTable
                        columns={aliasColumns}
                        data={audit.slashAliasCandidates}
                        actions={aliasActions}
                        emptyMessage="No alias-match candidates found."
                      />
                    ) : (
                      <EmptyState
                        icon={ShieldCheck}
                        title="Alias candidate bersih"
                        description="Nama slash atau synonym yang aman di-match tidak tersisa."
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="review">
                <Card className="rounded-[28px] border-white/70 bg-background/80 shadow-none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <AlertTriangle className="h-5 w-5 text-primary" />
                      CAS groups worth review
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-48 rounded-[24px]" />
                    ) : audit.reviewGroups.length ? (
                      <DataTable
                        columns={casColumns}
                        data={audit.reviewGroups}
                        actions={(row) => (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="table-action-button"
                            onClick={() => openMaterial(row.materials[0]?.id)}
                            title="Open raw material"
                            aria-label="Open raw material"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        emptyMessage="No CAS review groups found."
                      />
                    ) : (
                      <EmptyState
                        icon={ShieldCheck}
                        title="Tidak ada review manual tambahan"
                        description="Grup CAS yang tersisa tidak menunjukkan duplicate kuat untuk di-merge."
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="keep">
                <Card className="rounded-[28px] border-white/70 bg-background/80 shadow-none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      CAS groups to keep separate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-48 rounded-[24px]" />
                    ) : audit.keepSeparateGroups.length ? (
                      <DataTable
                        columns={casColumns}
                        data={audit.keepSeparateGroups}
                        actions={(row) => (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="table-action-button"
                            onClick={() => openMaterial(row.materials[0]?.id)}
                            title="Open raw material"
                            aria-label="Open raw material"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        emptyMessage="No keep-separate groups found."
                      />
                    ) : (
                      <EmptyState
                        icon={ShieldCheck}
                        title="Tidak ada grup CAS tersisa"
                        description="Tidak ada grup CAS yang perlu dipertahankan terpisah."
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={Boolean(mergeIntent)}
        onOpenChange={(open) => {
          if (!open && !mergeSubmitting) {
            setMergeIntent(null);
          }
        }}
        onConfirm={handleConfirmMerge}
        title={mergeIntent?.title || 'Merge raw material'}
        description={mergeIntent?.description || 'This merge will reassign usage to the selected master and remove the duplicate row.'}
        confirmText={mergeSubmitting ? 'Merging...' : 'Merge now'}
        cancelText="Cancel"
        destructive={false}
        variant="default"
        confirmDisabled={mergeSubmitting}
      >
        {mergeIntent ? (
          <div className="space-y-3 rounded-2xl border bg-muted/30 p-4 text-sm">
            <div>
              <div className="font-medium text-foreground">Master</div>
              <div className="text-muted-foreground">{mergeIntent.master.name}</div>
            </div>
            <div>
              <div className="font-medium text-foreground">Will be removed</div>
              <div className="space-y-1 text-muted-foreground">
                {mergeIntent.duplicates.map((material) => (
                  <div key={material.id}>{material.name}</div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={bulkMergeIntentOpen}
        onOpenChange={(open) => {
          if (!open && !bulkMergeSubmitting) {
            setBulkMergeIntentOpen(false);
          }
        }}
        onConfirm={handleConfirmBulkMerge}
        title="Merge all safe candidates"
        description={`Semua kandidat aman di tab Safe cleanup akan diproses berurutan. Yang gagal akan dilewati, dan yang berhasil tetap disimpan.`}
        confirmText={bulkMergeSubmitting ? 'Merging...' : 'Merge all'}
        cancelText="Cancel"
        destructive={false}
        variant="default"
        confirmDisabled={bulkMergeSubmitting || safeCleanupCandidateCount === 0}
      >
        <div className="space-y-3 rounded-2xl border bg-muted/30 p-4 text-sm">
          <div>
            <div className="font-medium text-foreground">Will be processed</div>
            <div className="text-muted-foreground">
              {audit.collapsedNameGroups.length} collapsed groups and {audit.slashAliasCandidates.length} alias candidates.
            </div>
          </div>
          <div>
            <div className="font-medium text-foreground">Behavior</div>
            <div className="text-muted-foreground">
              Merge berjalan satu per satu. Kalau ada kandidat yang tidak aman digabung, kandidat itu akan dilewati dan proses lanjut ke kandidat berikutnya.
            </div>
          </div>
        </div>
      </ConfirmDialog>
    </AuthenticatedLayout>
  );
};

export default RawMaterialAuditPage;

