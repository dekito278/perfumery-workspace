import React, { useCallback, useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Trash2, Link as LinkIcon, Home, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import DetailPageLayout from '@/components/DetailPageLayout.jsx';
import DetailPageHeader from '@/components/DetailPageHeader.jsx';
import DetailSection from '@/components/DetailSection.jsx';
import DetailField from '@/components/DetailField.jsx';
import DetailFieldGroup from '@/components/DetailFieldGroup.jsx';
import DetailMetadata from '@/components/DetailMetadata.jsx';
import StudioLoadingState from '@/components/StudioLoadingState.jsx';
import EditRawMaterialModal from '@/components/EditRawMaterialModal.jsx';
import ConfirmDialog from '@/components/ConfirmDialog.jsx';
import ManualReferenceMatchModal from '@/components/ManualReferenceMatchModal.jsx';
import { formatPercentage, formatNullable, formatStatus, formatQuantity } from '@/utils/formatting.js';
import { formatPricePerUnit, formatPrice } from '@/utils/pricingUtils.js';
import { getRawMaterialById, getRawMaterialDeletionDependencies } from '@/services/rawMaterialsService.js';
import {
  approveReferenceCandidateForRawMaterial,
  getReferenceProfileByRawMaterialId,
  markReferenceConflictForRawMaterial,
  resetReferenceCandidateToProvisional,
} from '@/services/materialReferenceService.js';
import { deriveScentFamilyFromCategory } from '@/utils/rawMaterialCategoryMeta.js';
import { DATA_STATUS_LABELS, TYPE_LABELS } from '@/hooks/useRawMaterialsPage.js';

const REFERENCE_STATUS_LABELS = {
  approved_pw: 'Perfumer\'s World',
  approved_external: 'Sumber luar disetujui',
  provisional_external: 'Perlu ditinjau',
  conflict_review: 'Tinjau bentrok',
  fallback_manual: 'Cadangan manual',
};

const getReferenceStatusBadgeClassName = (status) => {
  switch (status) {
    case 'approved_pw':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'approved_external':
      return 'border-sky-200 bg-sky-50 text-sky-900';
    case 'provisional_external':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'conflict_review':
      return 'border-rose-200 bg-rose-50 text-rose-900';
    default:
      return 'border-border bg-background text-foreground';
  }
};

const renderDeleteDependencySummary = (dependencies, loading, checkFailed) => {
  if (loading) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Memeriksa di mana bahan ini masih dipakai...
      </div>
    );
  }

  // A check that threw tells us nothing. Saying "ready to delete" here turns a failed lookup into a
  // safety guarantee, which is the one thing it cannot be.
  if (checkFailed) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Gagal memeriksa di mana bahan ini masih dipakai. Coba lagi sebentar; jangan hapus sebelum hasilnya keluar.
      </div>
    );
  }

  if (dependencies.length) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <div className="font-medium">Bahan ini masih dipakai di:</div>
        <ul className="mt-2 list-disc pl-5">
          {dependencies.map((entry) => (
            <li key={entry.label}>
              {entry.count} {entry.label}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
      Tidak ada yang menahan. Bahan ini siap dihapus, dan data workbook/acuan yang tertaut ikut dihapus.
    </div>
  );
};

const RawMaterialDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { deleteMaterial } = useRawMaterials();
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [referenceLink, setReferenceLink] = useState(null);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDependencies, setDeleteDependencies] = useState([]);
  const [deleteDependencyLoading, setDeleteDependencyLoading] = useState(false);
  const [deleteDependencyFailed, setDeleteDependencyFailed] = useState(false);

  useEffect(() => {
    // Open the dialog for one material, close it, open another: the first lookup can resolve last and
    // answer for the material now on screen. This dialog's whole job is to say whether deleting is safe.
    let cancelled = false;
    const loadDeleteDependencies = async () => {
      if (!deleteDialogOpen || !id) {
        setDeleteDependencyLoading(false);
        return;
      }

      setDeleteDependencyLoading(true);
      setDeleteDependencyFailed(false);
      try {
        const blockers = await getRawMaterialDeletionDependencies(id);
        if (cancelled) return;
        setDeleteDependencies(blockers);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load raw material delete dependencies:', error);
        setDeleteDependencyFailed(true);
        setDeleteDependencies([]);
      } finally {
        if (!cancelled) setDeleteDependencyLoading(false);
      }
    };

    if (!deleteDialogOpen) {
      setDeleteDependencies([]);
      setDeleteDependencyFailed(false);
      return;
    }

    loadDeleteDependencies();
    return () => { cancelled = true; };
  }, [deleteDialogOpen, id]);

  const loadMaterial = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRawMaterialById(id);
      setMaterial(data);
    } catch (error) {
      toast.error('Gagal memuat detail bahan baku');
      navigate('/raw-materials');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const loadReferenceProfile = useCallback(async () => {
    setReferenceLoading(true);
    try {
      const data = await getReferenceProfileByRawMaterialId(id);
      setReferenceLink(data);
    } catch (error) {
      console.error('Failed to load reference profile:', error);
      setReferenceLink(null);
    } finally {
      setReferenceLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadMaterial();
    loadReferenceProfile();
  }, [loadMaterial, loadReferenceProfile]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMaterial(id);
      toast.success('Bahan baku dihapus');
      navigate('/raw-materials');
    } catch (error) {
      toast.error(error.message || 'Gagal menghapus bahan baku');
      setDeleting(false);
    }
  };

  const refreshReferenceContext = async () => {
    await Promise.all([loadMaterial(), loadReferenceProfile()]);
  };

  const handleApproveReference = async () => {
    try {
      await approveReferenceCandidateForRawMaterial(id);
      toast.success('Kandidat acuan disetujui');
      await refreshReferenceContext();
    } catch (error) {
      toast.error(error.message || 'Gagal menyetujui kandidat acuan');
    }
  };

  const handleMarkConflict = async () => {
    try {
      await markReferenceConflictForRawMaterial(id);
      toast.success('Acuan ditandai untuk tinjauan bentrok');
      await refreshReferenceContext();
    } catch (error) {
      toast.error(error.message || 'Gagal menandai bentrok');
    }
  };

  const handleResetToProvisional = async () => {
    try {
      await resetReferenceCandidateToProvisional(id);
      toast.success('Acuan dikembalikan ke tinjauan sementara');
      await refreshReferenceContext();
    } catch (error) {
      toast.error(error.message || 'Gagal mengatur ulang status tinjauan');
    }
  };

  const handleBack = () => {
    if (location.state?.from) {
      navigate(location.state.from, { state: { restoreScroll: true } });
      return;
    }

    navigate('/home');
  };

  if (loading) {
    return (
      <DetailPageLayout>
        <StudioLoadingState
          variant="detail"
          eyebrow="Memuat bahan baku"
          title="Menyiapkan detail bahan baku"
          description="Mengambil profil bahan, status stok, dan panduan acuan."
        />
      </DetailPageLayout>
    );
  }

  if (!material) {
    return null;
  }

  const scentFamily = material.scent_family || deriveScentFamilyFromCategory(material.category, '');
  const dilutionSolventName = material.expand?.dilution_solvent_id?.name || null;
  const referenceProfile = referenceLink?.reference_profile || null;
  const referenceStatus = referenceProfile?.review_status || 'fallback_manual';
  const stockQuantity = Number(material.stock_quantity || 0);
  const stockThreshold = Number(material.low_stock_threshold ?? material.minimum_stock ?? 0);
  const lowStock = stockThreshold > 0 && stockQuantity <= stockThreshold;
  const formatStock = (value) => `${Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 3 })} ${material.unit || ''}`;
  return (
    <>
      <Helmet>
        <title>{`${material.name} - Solivagant`}</title>
        <meta name="description" content={`Detail bahan baku ${material.name} beserta panduan dan data acuan.`} />
      </Helmet>

      <DetailPageLayout>
        <DetailPageHeader
          eyebrow="Bahan baku"
          title={material.name}
          subtitle={[
            material.category ? formatStatus(material.category) : 'Bahan tanpa kategori',
            scentFamily || null,
          ].filter(Boolean).join(' / ')}
          badge={(
            <Badge variant="outline" className="capitalize text-xs">
              {TYPE_LABELS[material.type] || formatStatus(material.type)}
            </Badge>
          )}
          onBack={handleBack}
          backLabel={location.state?.from ? 'Kembali ke bahan baku' : 'Kembali ke beranda'}
          meta={(
            <>
              {referenceProfile ? (
                <div className="detail-page-meta-chip">
                  <span className="detail-page-meta-label">Acuan</span>
                  <span className="detail-page-meta-value">{referenceProfile.reference_code}</span>
                </div>
              ) : null}
              {referenceProfile ? (
                <div className="detail-page-meta-chip">
                  <span className="detail-page-meta-label">Status</span>
                  <span className="detail-page-meta-value">{REFERENCE_STATUS_LABELS[referenceStatus] || 'Acuan'}</span>
                </div>
              ) : null}
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Kode workbook</span>
                <span className="detail-page-meta-value">{formatNullable(material.workbook_code, '-')}</span>
              </div>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Satuan</span>
                <span className="detail-page-meta-value">{material.unit || '-'}</span>
              </div>
              <div className={`detail-page-meta-chip ${lowStock ? 'border-rose-200 bg-rose-50 text-rose-900' : ''}`}>
                <span className="detail-page-meta-label">{lowStock ? 'Stok menipis' : 'Stok'}</span>
                <span className="detail-page-meta-value">{formatStock(stockQuantity)}</span>
              </div>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Harga satuan</span>
                <span className="detail-page-meta-value">{formatPricePerUnit(material.cost_per_unit, material.unit)}</span>
              </div>
            </>
          )}
          actions={(
            <>
              <Button variant="outline" onClick={() => navigate('/home')} className="gap-2 h-9">
                <Home className="w-4 h-4" />
                Beranda
              </Button>
              <Button variant="outline" onClick={() => setEditModalOpen(true)} className="gap-2 h-9">
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
              <Button variant="outline" onClick={() => setMatchModalOpen(true)} className="gap-2 h-9">
                <LinkIcon className="w-4 h-4" />
                {referenceProfile ? 'Perbarui acuan' : 'Cocokkan acuan'}
              </Button>
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} className="gap-2 h-9">
                <Trash2 className="w-4 h-4" />
                Hapus
              </Button>
            </>
          )}
        />

        <div className="space-y-5">
          <DetailSection title="Sekilas">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">{lowStock ? 'Stok menipis' : 'Stok tersedia'}</div>
                <div className={`text-lg font-semibold font-mono ${lowStock ? 'text-rose-700' : ''}`}>{formatStock(stockQuantity)}</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Batas IFRA</div>
                <div className="text-lg font-semibold">{material.ifra_limit ? formatPercentage(material.ifra_limit) : '-'}</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Kekuatan</div>
                <div className="text-lg font-semibold">{material.reference_impact ? formatQuantity(material.reference_impact) : '-'}</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Ketahanan di strip (jam)</div>
                <div className="text-lg font-semibold">{material.reference_life_hours ? formatQuantity(material.reference_life_hours) : '-'}</div>
              </div>
            </div>
          </DetailSection>

          <DetailSection title="Ringkasan">
            <DetailFieldGroup columns={4}>
              <DetailField label="Nama" value={material.name} />
              <DetailField label="Jenis" value={TYPE_LABELS[material.type] || formatStatus(material.type)} />
              <DetailField label="Kategori" value={formatStatus(material.category)} />
              <DetailField label="Supplier" value={formatNullable(material.vendor, '-')} />
            </DetailFieldGroup>
            <div className="mt-3">
              <DetailFieldGroup columns={4}>
                <DetailField label="Status kerapian" value={DATA_STATUS_LABELS[material.data_status || 'active'] || formatStatus(material.data_status)} />
                <DetailField label="Catatan tinjauan" value={formatNullable(material.review_notes, '-')} />
                <DetailField label="Diarsipkan" value={formatNullable(material.archived_at, '-')} />
                <DetailField label="Dibuat" value={formatNullable(material.created_at, '-')} />
              </DetailFieldGroup>
            </div>
            <div className="mt-3">
              <DetailFieldGroup columns={4}>
                <DetailField label="Kode workbook" value={formatNullable(material.workbook_code, '-')} />
                <DetailField label="Nomor CAS" value={formatNullable(material.cas_number, '-')} />
                <DetailField label="Keluarga aroma acuan" value={formatNullable(material.reference_abc_primary_family || scentFamily, '-')} />
                <DetailField label="Harga satuan" value={formatPricePerUnit(material.cost_per_unit, material.unit)} />
              </DetailFieldGroup>
            </div>
            <div className="mt-3">
              <DetailFieldGroup columns={4}>
                <DetailField label="Stok tersedia" value={formatStock(stockQuantity)} />
                <DetailField label="Stok minimum" value={formatStock(material.minimum_stock)} />
                <DetailField label="Batas stok menipis" value={stockThreshold > 0 ? formatStock(stockThreshold) : '-'} />
                <DetailField label="Status stok" value={lowStock ? 'Stok menipis' : 'Tersedia'} />
              </DetailFieldGroup>
            </div>
            <div className="mt-3">
              <DetailFieldGroup columns={4}>
                <DetailField label="Batas IFRA" value={material.ifra_limit ? formatPercentage(material.ifra_limit) : '-'} />
                <DetailField
                  label="Takaran umum"
                  value={material.reference_use_level_typical_percent !== null && material.reference_use_level_typical_percent !== undefined
                    ? formatPercentage(material.reference_use_level_typical_percent, 2)
                    : '-'}
                />
                <DetailField
                  label="Takaran maks"
                  value={material.reference_use_level_max_percent !== null && material.reference_use_level_max_percent !== undefined
                    ? formatPercentage(material.reference_use_level_max_percent, 2)
                    : '-'}
                />
                <DetailField label="Keluarga aroma" value={formatNullable(scentFamily, '-')} />
              </DetailFieldGroup>
            </div>
          </DetailSection>

          <DetailSection title="Profil acuan">
            {referenceLoading ? (
              <div className="grid gap-3 md:grid-cols-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : referenceProfile ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={getReferenceStatusBadgeClassName(referenceStatus)}>
                      {REFERENCE_STATUS_LABELS[referenceStatus] || 'Acuan'}
                    </Badge>
                    {referenceProfile.confidence_score !== null ? (
                      <Badge variant="outline">
                        Keyakinan {referenceProfile.confidence_score}
                      </Badge>
                    ) : null}
                    {referenceProfile.provenance_summary?.primary_source_kind ? (
                      <Badge variant="outline" className="capitalize">
                        Sumber utama {referenceProfile.provenance_summary.primary_source_kind}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {referenceStatus === 'provisional_external' ? (
                      <Button variant="outline" size="sm" onClick={handleApproveReference} className="gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Setujui sumber luar
                      </Button>
                    ) : null}
                    {referenceStatus !== 'conflict_review' ? (
                      <Button variant="outline" size="sm" onClick={handleMarkConflict} className="gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Tandai bentrok
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={handleResetToProvisional} className="gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Kembalikan ke tinjauan
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setMatchModalOpen(true)} className="gap-2">
                      <LinkIcon className="w-4 h-4" />
                      Ganti profil tertaut
                    </Button>
                  </div>
                </div>
                <DetailFieldGroup columns={4}>
                  <DetailField label="Kode acuan" value={referenceProfile.reference_code} />
                  <DetailField label="Kode ABC" value={formatNullable(referenceProfile.abc_code, '-')} />
                  <DetailField label="Keluarga aroma utama" value={formatNullable(referenceProfile.abc_primary_family, '-')} />
                  <DetailField label="Keluarga aroma kedua" value={formatNullable(referenceProfile.abc_secondary_family, '-')} />
                </DetailFieldGroup>

                <DetailFieldGroup columns={4}>
                  <DetailField label="Kekuatan" value={referenceProfile.impact !== null ? formatQuantity(referenceProfile.impact) : '-'} />
                  <DetailField label="Ketahanan di strip (jam)" value={referenceProfile.life_hours !== null ? formatQuantity(referenceProfile.life_hours) : '-'} />
                  <DetailField label="Takaran umum" value={referenceProfile.use_level_typical_percent !== null ? formatPercentage(referenceProfile.use_level_typical_percent, 2) : '-'} />
                  <DetailField label="Takaran maks" value={referenceProfile.use_level_max_percent !== null ? formatPercentage(referenceProfile.use_level_max_percent, 2) : '-'} />
                </DetailFieldGroup>

                <DetailFieldGroup columns={4}>
                  <DetailField label="Batas IFRA acuan" value={referenceProfile.ifra_limit_percent !== null ? formatPercentage(referenceProfile.ifra_limit_percent, 2) : '-'} />
                  <DetailField label="Supplier" value={formatNullable(referenceProfile.supplier, '-')} />
                  <DetailField label="Satuan katalog" value={formatNullable(referenceProfile.catalog_unit, '-')} />
                  <DetailField label="Harga katalog" value={referenceProfile.catalog_price !== null ? formatPrice(referenceProfile.catalog_price) : '-'} />
                </DetailFieldGroup>

                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold">Asal data acuan</div>
                    {referenceProfile.provenance_summary?.conflict_fields?.length ? (
                      <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-900">
                        Bentrok di {referenceProfile.provenance_summary.conflict_fields.join(', ')}
                      </Badge>
                    ) : null}
                  </div>
                  <DetailFieldGroup columns={4}>
                    <DetailField label="Sumber utama" value={formatNullable(referenceProfile.provenance_summary?.primary_source_kind, '-')} />
                    <DetailField label="Jumlah sumber" value={formatNullable(referenceProfile.provenance_summary?.total_sources, '-')} />
                    <DetailField label="Menunggu tinjauan" value={formatNullable(referenceProfile.provenance_summary?.pending_review_sources, '-')} />
                    <DetailField label="Sumber luar disetujui" value={formatNullable(referenceProfile.provenance_summary?.approved_external_sources, '-')} />
                  </DetailFieldGroup>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {Object.entries(referenceProfile.source_snapshots || {}).map(([snapshotKey, snapshot]) => (
                      <div key={snapshotKey} className="rounded-xl border bg-background px-3 py-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium capitalize">{snapshot.source_kind || snapshotKey}</span>
                          <Badge variant="outline" className={getReferenceStatusBadgeClassName(snapshot.review_status)}>
                            {REFERENCE_STATUS_LABELS[snapshot.review_status] || snapshot.review_status || 'Cuplikan'}
                          </Badge>
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          <div>{snapshot.reference_code || snapshot.workbook_code ? `Acuan ${snapshot.reference_code || snapshot.workbook_code}` : 'Belum ada kode acuan'}</div>
                          <div>{snapshot.cas_number ? `CAS ${snapshot.cas_number}` : 'Belum ada CAS'}</div>
                          <div>{snapshot.reference_abc_primary_family ? `Keluarga aroma ${snapshot.reference_abc_primary_family}` : 'Belum ada keluarga aroma'}</div>
                          <div>
                            {snapshot.reference_impact !== null && snapshot.reference_impact !== undefined
                              ? `Kekuatan ${snapshot.reference_impact}`
                              : 'Belum ada kekuatan'}
                            {' | '}
                            {snapshot.reference_life_hours !== null && snapshot.reference_life_hours !== undefined
                              ? `Ketahanan ${snapshot.reference_life_hours} jam`
                              : 'Belum ada ketahanan'}
                          </div>
                          {snapshot.source_url ? (
                            <div className="break-all">{snapshot.source_url}</div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {referenceProfile.odour_facets?.length ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">Profil bau</div>
                    <div className="flex flex-wrap gap-2">
                      {referenceProfile.odour_facets.map((facet) => (
                        <Badge key={facet.id} variant="outline" className="rounded-full px-3 py-1 text-xs">
                          {facet.letter} / {facet.family || 'Keluarga'} / {formatQuantity(facet.value)}%
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                <DetailFieldGroup columns={4}>
                  <DetailField label="Label fungsi" value={formatNullable(referenceProfile.function_labels, '-')} />
                  <DetailField label="Kategori acuan" value={formatNullable(referenceProfile.category, '-')} />
                  <DetailField label="Klasifikasi" value={formatNullable(referenceProfile.classification, '-')} />
                  <DetailField label="No. pesanan" value={formatNullable(referenceProfile.order_no, '-')} />
                </DetailFieldGroup>

                <DetailFieldGroup columns={4}>
                  <DetailField label="Wujud fisik" value={formatNullable(referenceProfile.physical_state, '-')} />
                  <DetailField label="Rumus molekul" value={formatNullable(referenceProfile.mol_formula, '-')} />
                  <DetailField label="Berat molekul" value={referenceProfile.molecular_weight !== null ? formatQuantity(referenceProfile.molecular_weight, 2) : '-'} />
                  <DetailField label="Catatan keamanan" value={formatNullable(referenceProfile.safety, '-')} />
                </DetailFieldGroup>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                <p>Belum ada profil acuan yang tertaut.</p>
                <Button variant="outline" size="sm" onClick={() => setMatchModalOpen(true)} className="mt-4 gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Cocokkan profil acuan
                </Button>
              </div>
            )}
          </DetailSection>

          {material.is_diluted && (
            <DetailSection title="Pengaturan pengenceran">
              <DetailFieldGroup columns={3}>
                <DetailField
                  label="Bahan diencerkan"
                  value={(
                    <Badge variant="outline" className="text-xs">
                      Ya
                    </Badge>
                  )}
                />
                <DetailField
                  label="Persentase pengenceran"
                  value={formatPercentage(material.dilution_percentage || 0)}
                />
                <DetailField
                  label="Pelarut pengencer"
                  value={formatNullable(dilutionSolventName, '-')}
                />
              </DetailFieldGroup>
            </DetailSection>
          )}

          {material.type === 'solvent' && (
            <DetailSection title="Kalibrasi pelarut">
              <DetailFieldGroup columns={3}>
                <DetailField
                  label="Geser kekuatan"
                  value={material.solvent_impact_shift_percent !== null && material.solvent_impact_shift_percent !== undefined
                    ? formatPercentage(material.solvent_impact_shift_percent, 2)
                    : 'Preset bawaan'}
                />
                <DetailField
                  label="Geser ketahanan"
                  value={material.solvent_life_shift_percent !== null && material.solvent_life_shift_percent !== undefined
                    ? formatPercentage(material.solvent_life_shift_percent, 2)
                    : 'Preset bawaan'}
                />
                <DetailField
                  label="Perilaku saat dipakai"
                  value={
                    material.solvent_impact_shift_percent !== null
                    || material.solvent_life_shift_percent !== null
                      ? 'Kalibrasi sendiri'
                      : 'Preset cadangan'
                  }
                />
              </DetailFieldGroup>
            </DetailSection>
          )}

          {material.notes && (
            <DetailSection title="Catatan">
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">{material.notes}</p>
            </DetailSection>
          )}

          <DetailSection>
            <DetailMetadata
              created={material.created}
              updated={material.updated}
            />
          </DetailSection>
        </div>
      </DetailPageLayout>

      <EditRawMaterialModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        material={material}
        onSuccess={() => {
          loadMaterial();
          loadReferenceProfile();
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Hapus bahan baku"
        description={`Yakin hapus "${material.name}"? Tindakan ini tidak bisa dibatalkan, dan data workbook/acuan yang tertaut ikut dihapus.`}
        confirmText={deleting ? 'Menghapus...' : 'Hapus'}
        cancelText="Batal"
        confirmDisabled={deleting}
      >
        {renderDeleteDependencySummary(deleteDependencies, deleteDependencyLoading, deleteDependencyFailed)}
      </ConfirmDialog>

      <ManualReferenceMatchModal
        open={matchModalOpen}
        onOpenChange={setMatchModalOpen}
        material={material}
        currentLink={referenceLink}
        onSuccess={async () => {
          await loadReferenceProfile();
          toast.success('Profil acuan diperbarui');
        }}
      />
    </>
  );
};

export default RawMaterialDetailPage;
