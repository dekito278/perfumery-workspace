import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Home, Package, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import DataTable from '@/components/DataTable.jsx';
import ListPagination from '@/components/ListPagination.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import NoResultsState from '@/components/NoResultsState.jsx';
import AddRawMaterialModal from '@/components/AddRawMaterialModal.jsx';
import EditRawMaterialModal from '@/components/EditRawMaterialModal.jsx';
import RawMaterialGuidanceQuickEditDialog from '@/components/RawMaterialGuidanceQuickEditDialog.jsx';
import ConfirmDialog from '@/components/ConfirmDialog.jsx';
import RemapRawMaterialCategoriesModal from '@/components/RemapRawMaterialCategoriesModal.jsx';
import RawMaterialsDeleteDependencySummary from '@/components/raw-materials/RawMaterialsDeleteDependencySummary.jsx';
import RawMaterialsSummaryCards from '@/components/raw-materials/RawMaterialsSummaryCards.jsx';
import RawMaterialsToolbar from '@/components/raw-materials/RawMaterialsToolbar.jsx';
import RawMaterialsShortlistWorkspace from '@/components/raw-materials/RawMaterialsShortlistWorkspace.jsx';
import RawMaterialMobileCard from '@/components/raw-materials/RawMaterialMobileCard.jsx';
import { createRawMaterialsColumns } from '@/components/raw-materials/RawMaterialsTableConfig.jsx';
import { useRawMaterialsPage } from '@/hooks/useRawMaterialsPage.js';

const RawMaterialsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const briefId = searchParams.get('briefId') || '';
  const page = useRawMaterialsPage({ briefId, navigate });
  const columns = useMemo(
    () => createRawMaterialsColumns({
      categoryColorMap: page.categoryColorMap,
      getMaterialGuidanceDetails: page.getMaterialGuidanceDetails,
      handleView: page.handleView,
      openGuidanceEditor: page.openGuidanceEditor,
    }),
    [page.categoryColorMap, page.getMaterialGuidanceDetails, page.handleView, page.openGuidanceEditor]
  );

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Materials - Solivagant</title>
        <meta name="description" content="Browse your material library, guidance coverage, and dilution readiness from one formulation workspace." />
      </Helmet>
      <div className="page-container">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/studio')}
            className="gap-2 mb-4 h-9"
          >
            <Home className="w-4 h-4" />
            Back to dashboard
          </Button>
        </div>

        <PageHeader
          title="Materials"
          description={briefId
            ? 'Pilih kandidat bahan untuk brief ini, beri peran struktural, lalu kirim langsung ke formula wizard.'
            : 'Review material coverage, vendor metadata, dilution readiness, and workbook reference guidance from one master library.'}
          action="Add material"
          actionIcon={Plus}
          onAction={() => page.setAddModalOpen(true)}
        />

        {briefId ? (
          <RawMaterialsShortlistWorkspace
            briefContext={page.briefContext}
            shortlistLoading={page.shortlistLoading}
            shortlistItems={page.shortlistItems}
            shortlistRoles={page.shortlistRoles}
            selectedMaterialIds={page.selectedMaterialIds}
            shortlistMaterialIds={page.shortlistMaterialIds}
            handleSaveSelectionToShortlist={page.handleSaveSelectionToShortlist}
            handleRemoveShortlistItem={page.handleRemoveShortlistItem}
            handleUpdateShortlistRole={page.handleUpdateShortlistRole}
            openFormulaWizard={page.openFormulaWizard}
            navigateToBriefBoard={() => navigate(page.briefContext ? `/briefs/${page.briefContext.id}` : '/briefs')}
          />
        ) : null}

        <RawMaterialsSummaryCards
          summaryLoading={page.summaryLoading}
          totalMaterials={page.totalMaterials}
          matchedReferenceCount={page.matchedReferenceCount}
          guidanceGapCount={page.guidanceGapCount}
          solventCount={page.solventCount}
          categoryCount={page.categoryCount}
          ifraReferenceCount={page.ifraReferenceCount}
          practicalMergeCandidateCount={page.practicalMergeCandidateCount}
        />

        <RawMaterialsToolbar
          searchTerm={page.searchTerm}
          setSearchTerm={page.setSearchTerm}
          showRefreshing={page.showRefreshing}
          loading={page.loading}
          onRefresh={page.refreshAll}
          filters={page.filters}
          onFilterChange={page.handleFilterChange}
          onClearFilters={page.handleClearFilters}
          selectedMaterialIds={page.selectedMaterialIds}
          clearSelection={page.clearSelection}
          handleBulkDelete={page.handleBulkDelete}
          totalMaterials={page.totalMaterials}
          materialsCount={page.materials.length}
          hasActiveFilters={page.hasActiveFilters}
          referenceFilter={page.referenceFilter}
        />

        {page.showInitialLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !page.summaryLoading && page.summaryMaterials.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No materials yet"
            description="Add your first material to start building your formulation library."
            action="Add material"
            actionIcon={Plus}
            onAction={() => page.setAddModalOpen(true)}
          />
        ) : page.materials.length === 0 ? (
          <NoResultsState
            searchTerm={page.searchTerm}
            onClearFilters={page.hasActiveFilters ? page.handleClearFilters : null}
          />
        ) : (
          <>
            <div className="relative">
              <DataTable
                columns={columns}
                data={page.materials}
                selectable
                selectedRowIds={page.selectedMaterialIds}
                onToggleRow={page.handleToggleMaterialSelection}
                onToggleAll={page.handleToggleAllMaterials}
                mobileCard={(row) => (
                  <RawMaterialMobileCard
                    row={row}
                    guidance={page.getMaterialGuidanceDetails(row)}
                    selected={page.selectedMaterialIds.includes(row.id)}
                    onToggle={() => page.handleToggleMaterialSelection(row)}
                    onView={() => page.handleView(row)}
                    referenceStatusMap={page.referenceStatusMap}
                  />
                )}
                onEdit={page.handleEdit}
                onDelete={page.handleDelete}
              />
            </div>

            <ListPagination
              currentPage={page.currentPage}
              pageSize={page.pageSize}
              totalItems={page.totalMaterials}
              itemLabel="materials"
              onPageChange={page.setCurrentPage}
            />
          </>
        )}
      </div>

      <AddRawMaterialModal
        open={page.addModalOpen}
        onOpenChange={page.setAddModalOpen}
        onSuccess={async () => {
          await Promise.all([page.loadMaterials(), page.loadSummary()]);
        }}
      />

      <EditRawMaterialModal
        open={page.editModalOpen}
        onOpenChange={page.setEditModalOpen}
        material={page.selectedMaterial}
        onSuccess={async () => {
          await Promise.all([page.loadMaterials(), page.loadSummary()]);
          page.setSelectedMaterial(null);
        }}
      />

      <RawMaterialGuidanceQuickEditDialog
        open={page.guidanceEditorOpen}
        onOpenChange={page.setGuidanceEditorOpen}
        material={page.guidanceEditorMaterial}
        guidanceStatus={page.guidanceEditorMaterial ? page.getMaterialGuidanceDetails(page.guidanceEditorMaterial) : null}
        onSaved={async () => {
          await Promise.all([page.loadMaterials(), page.loadSummary()]);
          if (page.materials.length) {
            await page.refreshReferenceStatusMap(page.materials);
          }
        }}
      />

      <RemapRawMaterialCategoriesModal
        open={page.remapModalOpen}
        onOpenChange={page.setRemapModalOpen}
        materials={page.remapMaterials}
        onSuccess={async () => {
          await Promise.all([page.loadMaterials(), page.loadSummary()]);
          const refreshedMaterials = await page.fetchMaterials();
          page.setRemapMaterials(refreshedMaterials);
        }}
      />

      <ConfirmDialog
        open={page.deleteDialogOpen}
        onOpenChange={page.setDeleteDialogOpen}
        onConfirm={page.confirmDelete}
        title={page.selectedMaterial ? 'Delete material' : 'Delete selected materials'}
        description={page.selectedMaterial
          ? `Are you sure you want to delete "${page.selectedMaterial.name}"? This action cannot be undone, and linked workbook/reference artifacts will be removed too.`
          : `Are you sure you want to delete ${page.selectedMaterials.length} selected materials? This action cannot be undone, and each linked workbook/reference artifact will be removed too.`}
        confirmText={page.deletingId ? 'Deleting...' : 'Delete'}
        confirmDisabled={Boolean(page.deletingId)}
        destructive
      >
        <RawMaterialsDeleteDependencySummary
          dependencies={page.deleteDependencies}
          loading={page.deleteDependencyLoading}
          selectedMaterial={page.selectedMaterial}
          selectedMaterials={page.selectedMaterials}
        />
      </ConfirmDialog>
    </AuthenticatedLayout>
  );
};

export default RawMaterialsPage;

