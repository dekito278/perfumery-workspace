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
      {material.is_diluted ? <Badge variant="secondary">Diencerkan</Badge> : null}
      <Badge variant={guidanceCount >= 4 ? 'default' : 'secondary'}>
        {guidanceCount >= 4 ? 'Panduan lengkap' : `Panduan ${guidanceCount}/5`}
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
      toast.error('Gagal memuat audit bahan baku');
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
    title: `Gabung ${row.duplicates.length} baris duplikat`,
    description: `"${row.master.name}" tetap dipakai sebagai induk. Baris duplikat dipindahkan ke induk ini, semua rujukannya dialihkan, lalu baris duplikatnya dihapus.`,
    master: row.master,
    duplicates: row.duplicates,
  });

  const buildAliasMergeIntent = (row) => ({
    kind: 'alias-pair',
    title: 'Gabung kandidat alias',
    description: `Baris alias "${row.source.name}" akan digabung ke "${row.target.name}". Pemakaian, shortlist, dan tautan acuan dialihkan otomatis.`,
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
          ? `${mergeIntent.duplicates.length} duplikat bahan baku berhasil digabung ke ${mergeIntent.master.name}.`
          : `Alias bahan baku berhasil digabung ke ${mergeIntent.master.name}.`
      );
      setMergeIntent(null);
      await loadAudit(true);
    } catch (error) {
      console.error('Failed to merge raw material audit candidate:', error);
      toast.error(error.message || 'Gagal menggabung bahan baku');
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
      toast.info('Tidak ada kandidat aman untuk digabung.');
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
            message: error.message || 'Gagal digabung tanpa keterangan',
          });
        }
      }

      setBulkMergeIntentOpen(false);
      await loadAudit(true);

      if (successCount && !failures.length) {
        toast.success(`${successCount} duplikat aman bahan baku berhasil digabung.`);
        return;
      }

      if (successCount && failures.length) {
        toast.warning(
          `${successCount} berhasil digabung, ${failures.length} kandidat dilewati. Contoh: ${failures[0].duplicateName} -> ${failures[0].masterName} (${failures[0].message})`
        );
        return;
      }

      toast.error(failures[0]?.message || 'Gabung sekaligus gagal.');
    } finally {
      setBulkMergeSubmitting(false);
    }
  };

  const collapsedColumns = [
    {
      key: 'label',
      label: 'Kandidat induk',
      render: (row) => (
        <div className="space-y-2">
          <MaterialPill material={row.master} />
          <p className="text-sm text-muted-foreground">{row.reason}</p>
        </div>
      ),
    },
    {
      key: 'duplicates',
      label: 'Baris duplikat',
      render: (row) => renderMaterialList(row.duplicates),
    },
  ];

  const aliasColumns = [
    {
      key: 'source',
      label: 'Baris alias',
      render: (row) => (
        <div className="space-y-2">
          <MaterialPill material={row.source} />
          <p className="text-sm text-muted-foreground">Cocok lewat alias: {row.alias}</p>
        </div>
      ),
    },
    {
      key: 'target',
      label: 'Saran induk',
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
      label: 'Saran gabung',
      render: (row) => (
        <div className="space-y-2">
          <MaterialPill material={row.master} />
          <div className="text-sm text-muted-foreground">
            Hapus: <span className="font-medium text-foreground">{row.duplicate.name}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'synonyms',
      label: 'Sinonim terdeteksi',
      render: (row) => (
        <div className="space-y-2">
          {renderSynonymList(row.synonymNames)}
          <p className="text-sm text-muted-foreground">{row.note}</p>
        </div>
      ),
    },
    {
      key: 'reason',
      label: 'Alasan ditandai',
      render: (row) => (
        <div className="space-y-2">
          <Badge variant={row.confidence === 'high' ? 'default' : 'secondary'}>
            {row.confidence === 'high' ? 'Keyakinan tinggi' : 'Perlu ditinjau sebentar'}
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
              {row.classification === 'worth-review' ? 'Tinjau gabung' : 'Biarkan terpisah'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{row.reason}</p>
        </div>
      ),
    },
    {
      key: 'materials',
      label: 'Bahan',
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
      title="Buka bahan baku"
      aria-label="Buka bahan baku"
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
        title="Gabung baris duplikat"
        aria-label={`Gabung duplikat ke ${row.master.name}`}
      >
        Gabung
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
        title="Gabung baris alias"
        aria-label={`Gabung ${row.source.name} ke ${row.target.name}`}
      >
        Gabung
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
          title: row.type === 'collapsed-group' ? 'Gabung kandidat praktis' : 'Gabung kandidat sinonim',
          description: `Baris duplikat "${row.duplicate.name}" akan digabung ke "${row.master.name}".`,
          master: row.master,
          duplicates: [row.duplicate],
        })}
        title={row.actionLabel}
        aria-label={`${row.actionLabel} ${row.duplicate.name}`}
      >
        Gabung
      </Button>
    </>
  );

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Audit bahan baku - Solivagant</title>
      </Helmet>

      <div className="page-container space-y-6">
        <PageHeader
          eyebrow="Kualitas data"
          title="Audit bahan baku"
          description="Periksa kandidat duplikat, alias yang bertabrakan, dan grup CAS langsung dari data terkini."
          action="Muat ulang audit"
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
            <SummaryCard label="Bahan dipindai" value={audit.summary.materialCount} />
            <SummaryCard label="Antrean praktis" value={audit.summary.practicalMergeCandidateCount} tone="warning" />
            <SummaryCard label="Grup nama aman" value={audit.summary.collapsedNameGroupCount} tone="warning" />
            <SummaryCard label="Kandidat alias" value={audit.summary.slashAliasCandidateCount} tone="warning" />
            <SummaryCard label="CAS dibiarkan terpisah" value={audit.summary.keepSeparateGroupCount} tone="success" />
          </div>
        )}

        <Card className="rounded-[32px] border-white/70 bg-white/80 shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline">Data terkini</Badge>
              <Badge variant="outline">Selaras dengan smart-match</Badge>
            </div>
            <CardTitle className="text-xl">Kelompok kandidat</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tab pertama untuk kandidat yang biasanya aman dirapikan, tab kedua untuk tinjauan manual, dan tab ketiga untuk grup yang sengaja dipertahankan terpisah.
            </p>
          </CardHeader>
          <CardContent>
            <Card className="mb-6 rounded-[28px] border-emerald-200/70 bg-emerald-50/70 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <WandSparkles className="h-5 w-5 text-emerald-700" />
                  Antrean gabung praktis
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Daftar kandidat gabung yang paling siap ditindak, lengkap dengan nama sinonim yang terdeteksi.
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
                    emptyMessage="Tidak ada kandidat gabung praktis."
                  />
                ) : (
                  <EmptyState
                    icon={ShieldCheck}
                    title="Antrean praktis bersih"
                    description="Belum ada kandidat gabung yang cukup jelas untuk langsung ditindak."
                  />
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="safe" className="space-y-4">
              <TabsList className="h-auto flex-wrap rounded-2xl bg-muted/70 p-1">
                <TabsTrigger value="safe" className="rounded-xl">Rapikan aman</TabsTrigger>
                <TabsTrigger value="review" className="rounded-xl">Tinjauan manual</TabsTrigger>
                <TabsTrigger value="keep" className="rounded-xl">Biarkan terpisah</TabsTrigger>
              </TabsList>

              <TabsContent value="safe" className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-amber-200/70 bg-amber-50/70 px-4 py-4">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">Rapikan aman sekaligus</div>
                    <p className="text-sm text-muted-foreground">
                      Gabung semua kandidat aman sekaligus dari grup nama serupa dan kandidat alias.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="gap-2 rounded-2xl"
                    disabled={loading || bulkMergeSubmitting || safeCleanupCandidateCount === 0}
                    onClick={() => setBulkMergeIntentOpen(true)}
                  >
                    <WandSparkles className="h-4 w-4" />
                    {bulkMergeSubmitting ? 'Menggabung...' : `Gabung semua yang aman (${safeCleanupCandidateCount})`}
                  </Button>
                </div>

                <Card className="rounded-[28px] border-white/70 bg-background/80 shadow-none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FolderTree className="h-5 w-5 text-primary" />
                      Grup nama serupa
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
                        emptyMessage="Tidak ada grup nama serupa."
                      />
                    ) : (
                      <EmptyState
                        icon={ShieldCheck}
                        title="Tidak ada duplikat aman"
                        description="Nama yang hanya beda spasi atau tanda baca sudah bersih."
                      />
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-[28px] border-white/70 bg-background/80 shadow-none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ScanSearch className="h-5 w-5 text-primary" />
                      Kandidat alias
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
                        emptyMessage="Tidak ada kandidat alias."
                      />
                    ) : (
                      <EmptyState
                        icon={ShieldCheck}
                        title="Kandidat alias bersih"
                        description="Nama bergaris miring atau sinonim yang aman dicocokkan sudah tidak tersisa."
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
                      Grup CAS yang perlu ditinjau
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
                            title="Buka bahan baku"
                            aria-label="Buka bahan baku"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        emptyMessage="Tidak ada grup CAS untuk ditinjau."
                      />
                    ) : (
                      <EmptyState
                        icon={ShieldCheck}
                        title="Tidak ada tinjauan manual tambahan"
                        description="Grup CAS yang tersisa tidak menunjukkan duplikat kuat untuk digabung."
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
                      Grup CAS yang dibiarkan terpisah
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
                            title="Buka bahan baku"
                            aria-label="Buka bahan baku"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        emptyMessage="Tidak ada grup yang dibiarkan terpisah."
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
        title={mergeIntent?.title || 'Gabung bahan baku'}
        description={mergeIntent?.description || 'Penggabungan ini mengalihkan pemakaian ke bahan induk lalu menghapus baris duplikatnya.'}
        confirmText={mergeSubmitting ? 'Menggabung...' : 'Gabung sekarang'}
        cancelText="Batal"
        destructive={false}
        variant="default"
        confirmDisabled={mergeSubmitting}
      >
        {mergeIntent ? (
          <div className="space-y-3 rounded-2xl border bg-muted/30 p-4 text-sm">
            <div>
              <div className="font-medium text-foreground">Induk (tetap dipakai)</div>
              <div className="text-muted-foreground">{mergeIntent.master.name}</div>
            </div>
            <div>
              <div className="font-medium text-foreground">Akan dihapus</div>
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
        title="Gabung semua kandidat aman"
        description={`Semua kandidat aman di tab Rapikan aman akan diproses berurutan. Yang gagal akan dilewati, dan yang berhasil tetap disimpan.`}
        confirmText={bulkMergeSubmitting ? 'Menggabung...' : 'Gabung semua'}
        cancelText="Batal"
        destructive={false}
        variant="default"
        confirmDisabled={bulkMergeSubmitting || safeCleanupCandidateCount === 0}
      >
        <div className="space-y-3 rounded-2xl border bg-muted/30 p-4 text-sm">
          <div>
            <div className="font-medium text-foreground">Akan diproses</div>
            <div className="text-muted-foreground">
              {audit.collapsedNameGroups.length} grup nama serupa dan {audit.slashAliasCandidates.length} kandidat alias.
            </div>
          </div>
          <div>
            <div className="font-medium text-foreground">Cara kerja</div>
            <div className="text-muted-foreground">
              Penggabungan berjalan satu per satu. Kalau ada kandidat yang tidak aman digabung, kandidat itu akan dilewati dan proses lanjut ke kandidat berikutnya.
            </div>
          </div>
        </div>
      </ConfirmDialog>
    </AuthenticatedLayout>
  );
};

export default RawMaterialAuditPage;

