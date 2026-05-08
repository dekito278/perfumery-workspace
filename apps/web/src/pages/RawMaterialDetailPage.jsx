import React, { useState, useEffect } from 'react';
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

const REFERENCE_STATUS_LABELS = {
  approved_pw: 'Perfumer\'s World',
  approved_external: 'External approved',
  provisional_external: 'Needs review',
  conflict_review: 'Conflict review',
  fallback_manual: 'Manual fallback',
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

const renderDeleteDependencySummary = (dependencies, loading) => {
  if (loading) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Checking where this material is still used...
      </div>
    );
  }

  if (dependencies.length) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <div className="font-medium">This material is still referenced in:</div>
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
      No blocking references found. This material is ready to delete, and its linked workbook/reference artifacts will be removed too.
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

  useEffect(() => {
    loadMaterial();
    loadReferenceProfile();
  }, [id]);

  useEffect(() => {
    const loadDeleteDependencies = async () => {
      if (!deleteDialogOpen || !id) {
        setDeleteDependencyLoading(false);
        return;
      }

      setDeleteDependencyLoading(true);
      try {
        const blockers = await getRawMaterialDeletionDependencies(id);
        setDeleteDependencies(blockers);
      } catch (error) {
        console.error('Failed to load raw material delete dependencies:', error);
        setDeleteDependencies([]);
      } finally {
        setDeleteDependencyLoading(false);
      }
    };

    if (!deleteDialogOpen) {
      setDeleteDependencies([]);
      return;
    }

    loadDeleteDependencies();
  }, [deleteDialogOpen, id]);

  const loadMaterial = async () => {
    setLoading(true);
    try {
      const data = await getRawMaterialById(id);
      setMaterial(data);
    } catch (error) {
      toast.error('Failed to load material details');
      navigate('/raw-materials');
    } finally {
      setLoading(false);
    }
  };

  const loadReferenceProfile = async () => {
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
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMaterial(id);
      toast.success('Material deleted successfully');
      navigate('/raw-materials');
    } catch (error) {
      toast.error(error.message || 'Failed to delete material');
      setDeleting(false);
    }
  };

  const refreshReferenceContext = async () => {
    await Promise.all([loadMaterial(), loadReferenceProfile()]);
  };

  const handleApproveReference = async () => {
    try {
      await approveReferenceCandidateForRawMaterial(id);
      toast.success('Reference candidate approved');
      await refreshReferenceContext();
    } catch (error) {
      toast.error(error.message || 'Failed to approve reference candidate');
    }
  };

  const handleMarkConflict = async () => {
    try {
      await markReferenceConflictForRawMaterial(id);
      toast.success('Reference marked for conflict review');
      await refreshReferenceContext();
    } catch (error) {
      toast.error(error.message || 'Failed to mark conflict');
    }
  };

  const handleResetToProvisional = async () => {
    try {
      await resetReferenceCandidateToProvisional(id);
      toast.success('Reference returned to provisional review');
      await refreshReferenceContext();
    } catch (error) {
      toast.error(error.message || 'Failed to reset review state');
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
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-64 w-full" />
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
        <meta name="description" content={`Detailed view of ${material.name} material with guidance and reference data.`} />
      </Helmet>

      <DetailPageLayout>
        <DetailPageHeader
          eyebrow="Material"
          title={material.name}
          subtitle={[
            material.category ? formatStatus(material.category) : 'Uncategorized material',
            scentFamily || null,
          ].filter(Boolean).join(' / ')}
          badge={(
            <Badge variant="outline" className="capitalize text-xs">
              {formatStatus(material.type)}
            </Badge>
          )}
          onBack={handleBack}
          backLabel={location.state?.from ? 'Back to materials' : 'Back to home'}
          meta={(
            <>
              {referenceProfile ? (
                <div className="detail-page-meta-chip">
                  <span className="detail-page-meta-label">Reference</span>
                  <span className="detail-page-meta-value">{referenceProfile.reference_code}</span>
                </div>
              ) : null}
              {referenceProfile ? (
                <div className="detail-page-meta-chip">
                  <span className="detail-page-meta-label">Status</span>
                  <span className="detail-page-meta-value">{REFERENCE_STATUS_LABELS[referenceStatus] || 'Reference'}</span>
                </div>
              ) : null}
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Workbook code</span>
                <span className="detail-page-meta-value">{formatNullable(material.workbook_code, '-')}</span>
              </div>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Unit</span>
                <span className="detail-page-meta-value">{material.unit || '-'}</span>
              </div>
              <div className={`detail-page-meta-chip ${lowStock ? 'border-rose-200 bg-rose-50 text-rose-900' : ''}`}>
                <span className="detail-page-meta-label">{lowStock ? 'Low stock' : 'Stock'}</span>
                <span className="detail-page-meta-value">{formatStock(stockQuantity)}</span>
              </div>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Unit price</span>
                <span className="detail-page-meta-value">{formatPricePerUnit(material.cost_per_unit, material.unit)}</span>
              </div>
            </>
          )}
          actions={(
            <>
              <Button variant="outline" onClick={() => navigate('/home')} className="gap-2 h-9">
                <Home className="w-4 h-4" />
                Home
              </Button>
              <Button variant="outline" onClick={() => setEditModalOpen(true)} className="gap-2 h-9">
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
              <Button variant="outline" onClick={() => setMatchModalOpen(true)} className="gap-2 h-9">
                <LinkIcon className="w-4 h-4" />
                {referenceProfile ? 'Update reference' : 'Match reference'}
              </Button>
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} className="gap-2 h-9">
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </>
          )}
        />

        <div className="space-y-5">
          <DetailSection title="Snapshot">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">{lowStock ? 'Low stock' : 'Stock on hand'}</div>
                <div className={`text-lg font-semibold font-mono ${lowStock ? 'text-rose-700' : ''}`}>{formatStock(stockQuantity)}</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">IFRA limit</div>
                <div className="text-lg font-semibold">{material.ifra_limit ? formatPercentage(material.ifra_limit) : 'N/A'}</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Impact</div>
                <div className="text-lg font-semibold">{material.reference_impact ? formatQuantity(material.reference_impact) : 'N/A'}</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Life hours</div>
                <div className="text-lg font-semibold">{material.reference_life_hours ? formatQuantity(material.reference_life_hours) : 'N/A'}</div>
              </div>
            </div>
          </DetailSection>

          <DetailSection title="Summary">
            <DetailFieldGroup columns={4}>
              <DetailField label="Name" value={material.name} />
              <DetailField label="Type" value={formatStatus(material.type)} />
              <DetailField label="Category" value={formatStatus(material.category)} />
              <DetailField label="Vendor" value={formatNullable(material.vendor)} />
            </DetailFieldGroup>
            <div className="mt-3">
              <DetailFieldGroup columns={4}>
                <DetailField label="Cleanup status" value={formatStatus(material.data_status || 'active')} />
                <DetailField label="Review note" value={formatNullable(material.review_notes)} />
                <DetailField label="Archived at" value={formatNullable(material.archived_at)} />
                <DetailField label="Created" value={formatNullable(material.created_at)} />
              </DetailFieldGroup>
            </div>
            <div className="mt-3">
              <DetailFieldGroup columns={4}>
                <DetailField label="Workbook code" value={formatNullable(material.workbook_code)} />
                <DetailField label="CAS number" value={formatNullable(material.cas_number)} />
                <DetailField label="Reference family" value={formatNullable(material.reference_abc_primary_family || scentFamily)} />
                <DetailField label="Unit price" value={formatPricePerUnit(material.cost_per_unit, material.unit)} />
              </DetailFieldGroup>
            </div>
            <div className="mt-3">
              <DetailFieldGroup columns={4}>
                <DetailField label="Stock on hand" value={formatStock(stockQuantity)} />
                <DetailField label="Minimum stock" value={formatStock(material.minimum_stock)} />
                <DetailField label="Low alert" value={stockThreshold > 0 ? formatStock(stockThreshold) : 'N/A'} />
                <DetailField label="Stock status" value={lowStock ? 'Low stock' : 'Available'} />
              </DetailFieldGroup>
            </div>
            <div className="mt-3">
              <DetailFieldGroup columns={4}>
                <DetailField label="IFRA limit" value={material.ifra_limit ? formatPercentage(material.ifra_limit) : 'N/A'} />
                <DetailField
                  label="Typical use"
                  value={material.reference_use_level_typical_percent !== null && material.reference_use_level_typical_percent !== undefined
                    ? formatPercentage(material.reference_use_level_typical_percent, 2)
                    : 'N/A'}
                />
                <DetailField
                  label="Max use"
                  value={material.reference_use_level_max_percent !== null && material.reference_use_level_max_percent !== undefined
                    ? formatPercentage(material.reference_use_level_max_percent, 2)
                    : 'N/A'}
                />
                <DetailField label="Family" value={formatNullable(scentFamily)} />
              </DetailFieldGroup>
            </div>
          </DetailSection>

          <DetailSection title="Reference profile">
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
                      {REFERENCE_STATUS_LABELS[referenceStatus] || 'Reference'}
                    </Badge>
                    {referenceProfile.confidence_score !== null ? (
                      <Badge variant="outline">
                        Confidence {referenceProfile.confidence_score}
                      </Badge>
                    ) : null}
                    {referenceProfile.provenance_summary?.primary_source_kind ? (
                      <Badge variant="outline" className="capitalize">
                        Winner {referenceProfile.provenance_summary.primary_source_kind}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {referenceStatus === 'provisional_external' ? (
                      <Button variant="outline" size="sm" onClick={handleApproveReference} className="gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Approve external
                      </Button>
                    ) : null}
                    {referenceStatus !== 'conflict_review' ? (
                      <Button variant="outline" size="sm" onClick={handleMarkConflict} className="gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Mark conflict
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={handleResetToProvisional} className="gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Return to review
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setMatchModalOpen(true)} className="gap-2">
                      <LinkIcon className="w-4 h-4" />
                      Change linked profile
                    </Button>
                  </div>
                </div>
                <DetailFieldGroup columns={4}>
                  <DetailField label="Reference code" value={referenceProfile.reference_code} />
                  <DetailField label="ABC code" value={formatNullable(referenceProfile.abc_code)} />
                  <DetailField label="Primary family" value={formatNullable(referenceProfile.abc_primary_family)} />
                  <DetailField label="Secondary family" value={formatNullable(referenceProfile.abc_secondary_family)} />
                </DetailFieldGroup>

                <DetailFieldGroup columns={4}>
                  <DetailField label="Impact" value={referenceProfile.impact !== null ? formatQuantity(referenceProfile.impact) : 'N/A'} />
                  <DetailField label="Life hours" value={referenceProfile.life_hours !== null ? formatQuantity(referenceProfile.life_hours) : 'N/A'} />
                  <DetailField label="Typical use level" value={referenceProfile.use_level_typical_percent !== null ? formatPercentage(referenceProfile.use_level_typical_percent, 2) : 'N/A'} />
                  <DetailField label="Use level max" value={referenceProfile.use_level_max_percent !== null ? formatPercentage(referenceProfile.use_level_max_percent, 2) : 'N/A'} />
                </DetailFieldGroup>

                <DetailFieldGroup columns={4}>
                  <DetailField label="IFRA reference limit" value={referenceProfile.ifra_limit_percent !== null ? formatPercentage(referenceProfile.ifra_limit_percent, 2) : 'N/A'} />
                  <DetailField label="Supplier" value={formatNullable(referenceProfile.supplier)} />
                  <DetailField label="Catalog unit" value={formatNullable(referenceProfile.catalog_unit)} />
                  <DetailField label="Catalog price" value={referenceProfile.catalog_price !== null ? formatPrice(referenceProfile.catalog_price) : 'N/A'} />
                </DetailFieldGroup>

                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold">Reference provenance</div>
                    {referenceProfile.provenance_summary?.conflict_fields?.length ? (
                      <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-900">
                        Conflict on {referenceProfile.provenance_summary.conflict_fields.join(', ')}
                      </Badge>
                    ) : null}
                  </div>
                  <DetailFieldGroup columns={4}>
                    <DetailField label="Primary source" value={formatNullable(referenceProfile.provenance_summary?.primary_source_kind)} />
                    <DetailField label="Total sources" value={formatNullable(referenceProfile.provenance_summary?.total_sources)} />
                    <DetailField label="Pending review" value={formatNullable(referenceProfile.provenance_summary?.pending_review_sources)} />
                    <DetailField label="Approved external" value={formatNullable(referenceProfile.provenance_summary?.approved_external_sources)} />
                  </DetailFieldGroup>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {Object.entries(referenceProfile.source_snapshots || {}).map(([snapshotKey, snapshot]) => (
                      <div key={snapshotKey} className="rounded-xl border bg-background px-3 py-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium capitalize">{snapshot.source_kind || snapshotKey}</span>
                          <Badge variant="outline" className={getReferenceStatusBadgeClassName(snapshot.review_status)}>
                            {REFERENCE_STATUS_LABELS[snapshot.review_status] || snapshot.review_status || 'Snapshot'}
                          </Badge>
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          <div>{snapshot.reference_code || snapshot.workbook_code ? `Reference ${snapshot.reference_code || snapshot.workbook_code}` : 'No reference code'}</div>
                          <div>{snapshot.cas_number ? `CAS ${snapshot.cas_number}` : 'No CAS'}</div>
                          <div>{snapshot.reference_abc_primary_family ? `Family ${snapshot.reference_abc_primary_family}` : 'No family mapping'}</div>
                          <div>
                            {snapshot.reference_impact !== null && snapshot.reference_impact !== undefined
                              ? `Impact ${snapshot.reference_impact}`
                              : 'No impact'}
                            {' | '}
                            {snapshot.reference_life_hours !== null && snapshot.reference_life_hours !== undefined
                              ? `Life ${snapshot.reference_life_hours}h`
                              : 'No life'}
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
                    <div className="text-sm font-semibold">Odour profile</div>
                    <div className="flex flex-wrap gap-2">
                      {referenceProfile.odour_facets.map((facet) => (
                        <Badge key={facet.id} variant="outline" className="rounded-full px-3 py-1 text-xs">
                          {facet.letter} / {facet.family || 'Family'} / {formatQuantity(facet.value)}%
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                <DetailFieldGroup columns={4}>
                  <DetailField label="Function labels" value={formatNullable(referenceProfile.function_labels)} />
                  <DetailField label="Reference category" value={formatNullable(referenceProfile.category)} />
                  <DetailField label="Classification" value={formatNullable(referenceProfile.classification)} />
                  <DetailField label="Order no." value={formatNullable(referenceProfile.order_no)} />
                </DetailFieldGroup>

                <DetailFieldGroup columns={4}>
                  <DetailField label="Physical state" value={formatNullable(referenceProfile.physical_state)} />
                  <DetailField label="Molecular formula" value={formatNullable(referenceProfile.mol_formula)} />
                  <DetailField label="Molecular weight" value={referenceProfile.molecular_weight !== null ? formatQuantity(referenceProfile.molecular_weight, 2) : 'N/A'} />
                  <DetailField label="Safety note" value={formatNullable(referenceProfile.safety)} />
                </DetailFieldGroup>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                <p>No linked reference profile yet.</p>
                <Button variant="outline" size="sm" onClick={() => setMatchModalOpen(true)} className="mt-4 gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Match reference profile
                </Button>
              </div>
            )}
          </DetailSection>

          {material.is_diluted && (
            <DetailSection title="Dilution setup">
              <DetailFieldGroup columns={3}>
                <DetailField
                  label="Diluted material"
                  value={(
                    <Badge variant="outline" className="text-xs">
                      Yes
                    </Badge>
                  )}
                />
                <DetailField
                  label="Dilution percentage"
                  value={formatPercentage(material.dilution_percentage || 0)}
                />
                <DetailField
                  label="Dilution solvent"
                  value={formatNullable(dilutionSolventName)}
                />
              </DetailFieldGroup>
            </DetailSection>
          )}

          {material.type === 'solvent' && (
            <DetailSection title="Solvent calibration">
              <DetailFieldGroup columns={3}>
                <DetailField
                  label="Impact shift"
                  value={material.solvent_impact_shift_percent !== null && material.solvent_impact_shift_percent !== undefined
                    ? formatPercentage(material.solvent_impact_shift_percent, 2)
                    : 'Default preset'}
                />
                <DetailField
                  label="Life shift"
                  value={material.solvent_life_shift_percent !== null && material.solvent_life_shift_percent !== undefined
                    ? formatPercentage(material.solvent_life_shift_percent, 2)
                    : 'Default preset'}
                />
                <DetailField
                  label="Runtime behavior"
                  value={
                    material.solvent_impact_shift_percent !== null
                    || material.solvent_life_shift_percent !== null
                      ? 'Custom calibration'
                      : 'Fallback preset'
                  }
                />
              </DetailFieldGroup>
            </DetailSection>
          )}

          {material.notes && (
            <DetailSection title="Notes">
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
        title="Delete material"
        description={`Are you sure you want to delete "${material.name}"? This action cannot be undone, and linked workbook/reference artifacts will be removed too.`}
        confirmText={deleting ? 'Deleting...' : 'Delete'}
        confirmDisabled={deleting}
      >
        {renderDeleteDependencySummary(deleteDependencies, deleteDependencyLoading)}
      </ConfirmDialog>

      <ManualReferenceMatchModal
        open={matchModalOpen}
        onOpenChange={setMatchModalOpen}
        material={material}
        currentLink={referenceLink}
        onSuccess={async () => {
          await loadReferenceProfile();
          toast.success('Reference profile updated');
        }}
      />
    </>
  );
};

export default RawMaterialDetailPage;
