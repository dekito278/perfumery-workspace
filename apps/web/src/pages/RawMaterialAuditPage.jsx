import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Eye, FolderTree, RefreshCw, ScanSearch, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import DataTable from '@/components/DataTable.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getRawMaterialOptions } from '@/services/rawMaterialsService.js';
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

const RawMaterialAuditPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAudit = async (forceRefresh = false) => {
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
  };

  useEffect(() => {
    loadAudit();
  }, []);

  const audit = useMemo(() => buildRawMaterialDuplicateAudit(materials), [materials]);

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
      onClick={() => navigate(`/raw-material/${row.master?.id || row.target?.id || row.source?.id || row.materials?.[0]?.id}`, {
        state: { from: `${location.pathname}${location.search}` },
      })}
      title="Open raw material"
      aria-label="Open raw material"
    >
      <Eye className="h-4 w-4" />
    </Button>
  );

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Material Audit - Perfumer Studio</title>
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
            <Tabs defaultValue="safe" className="space-y-4">
              <TabsList className="h-auto flex-wrap rounded-2xl bg-muted/70 p-1">
                <TabsTrigger value="safe" className="rounded-xl">Safe cleanup</TabsTrigger>
                <TabsTrigger value="review" className="rounded-xl">Manual review</TabsTrigger>
                <TabsTrigger value="keep" className="rounded-xl">Keep separate</TabsTrigger>
              </TabsList>

              <TabsContent value="safe" className="space-y-6">
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
                        actions={primaryAction}
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
                        actions={primaryAction}
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
                            onClick={() => navigate(`/raw-material/${row.materials[0]?.id}`, {
                              state: { from: `${location.pathname}${location.search}` },
                            })}
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
                            onClick={() => navigate(`/raw-material/${row.materials[0]?.id}`, {
                              state: { from: `${location.pathname}${location.search}` },
                            })}
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
    </AuthenticatedLayout>
  );
};

export default RawMaterialAuditPage;
