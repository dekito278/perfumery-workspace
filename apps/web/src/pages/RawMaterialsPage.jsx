import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Home, Package, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import DataTable from '@/components/DataTable.jsx';
import ListPagination from '@/components/ListPagination.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import NoResultsState from '@/components/NoResultsState.jsx';
import StudioLoadingState from '@/components/StudioLoadingState.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import AddRawMaterialModal from '@/components/AddRawMaterialModal.jsx';
import EditRawMaterialModal from '@/components/EditRawMaterialModal.jsx';
import RawMaterialGuidanceQuickEditDialog from '@/components/RawMaterialGuidanceQuickEditDialog.jsx';
import ConfirmDialog from '@/components/ConfirmDialog.jsx';
import RemapRawMaterialCategoriesModal from '@/components/RemapRawMaterialCategoriesModal.jsx';
import RawMaterialsDeleteDependencySummary from '@/components/raw-materials/RawMaterialsDeleteDependencySummary.jsx';
import RawMaterialsSummaryCards from '@/components/raw-materials/RawMaterialsSummaryCards.jsx';
import RawMaterialsToolbar from '@/components/raw-materials/RawMaterialsToolbar.jsx';
import RawMaterialMobileCard from '@/components/raw-materials/RawMaterialMobileCard.jsx';
import { createRawMaterialsColumns } from '@/components/raw-materials/RawMaterialsTableConfig.jsx';
import { useRawMaterialsPage } from '@/hooks/useRawMaterialsPage.js';

const RawMaterialsPage = () => {
  const navigate = useNavigate();
  const page = useRawMaterialsPage({ navigate });
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
        <title>Bahan baku - Solivagant</title>
        <meta name="description" content="Lihat pustaka bahan baku, kelengkapan panduan, dan kesiapan pengenceran dari satu ruang kerja formulasi." />
      </Helmet>
      <div className="page-container">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/studio')}
            className="gap-2 mb-4 h-9"
          >
            <Home className="w-4 h-4" />
            Kembali ke dashboard
          </Button>
        </div>

        <PageHeader
          title="Bahan baku"
          description="Tinjau kelengkapan bahan baku, data supplier, kesiapan pengenceran, dan panduan acuan workbook dari satu pustaka induk."
          action="Tambah bahan baku"
          actionIcon={Plus}
          onAction={() => page.setAddModalOpen(true)}
        />


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

        {page.summaryError ? (
          <div className="mb-5 grid gap-3">
            <StateBlock
              tone="error"
              title="Ringkasan bahan baku gagal dimuat ulang"
              description={page.summaryError}
              action={page.summaryLoading ? '' : 'Muat ulang ringkasan'}
              onAction={page.summaryLoading ? null : page.loadSummary}
              className="bg-rose-50/80 p-5"
            />
          </div>
        ) : null}

        <RawMaterialsToolbar
          searchTerm={page.searchTerm}
          setSearchTerm={page.setSearchTerm}
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

        {page.loadError && page.materials.length > 0 ? (
          <div className="mb-5">
            <StateBlock
              tone="error"
              title="Data bahan baku mungkin sudah usang"
              description={page.loadError}
              action={page.loading ? '' : 'Coba lagi'}
              onAction={page.loading ? null : page.loadMaterials}
              className="bg-rose-50/80 p-5"
            />
          </div>
        ) : null}

        {page.showInitialLoading ? (
          <StudioLoadingState
            eyebrow="Memuat bahan baku"
            title="Menyiapkan pustaka bahan baku"
            description="Mengambil stok, panduan workbook, dan status kerapian bahan baku."
          />
        ) : page.loadError && page.materials.length === 0 ? (
          <StateBlock
            tone="error"
            title="Bahan baku gagal dimuat"
            description={page.loadError}
            action="Coba lagi"
            onAction={page.loadMaterials}
          />
        ) : !page.summaryLoading && !page.summaryError && page.summaryMaterials.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Belum ada bahan baku"
            description="Tambahkan bahan baku pertama untuk mulai mengisi pustaka formulasi."
            action="Tambah bahan baku"
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
              itemLabel="bahan baku"
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
        title={page.selectedMaterial ? 'Hapus bahan baku' : 'Hapus bahan baku terpilih'}
        description={page.selectedMaterial
          ? `Yakin hapus "${page.selectedMaterial.name}"? Tindakan ini tidak bisa dibatalkan, dan data workbook/acuan yang tertaut ikut dihapus.`
          : `Yakin hapus ${page.selectedMaterials.length} bahan baku terpilih? Tindakan ini tidak bisa dibatalkan, dan data workbook/acuan yang tertaut pada tiap bahan ikut dihapus.`}
        confirmText={page.deletingId ? 'Menghapus...' : 'Hapus'}
        cancelText="Batal"
        confirmDisabled={Boolean(page.deletingId)}
        destructive
      >
        <RawMaterialsDeleteDependencySummary
          dependencies={page.deleteDependencies}
          loading={page.deleteDependencyLoading}
          checkFailed={page.deleteDependencyFailed}
          selectedMaterial={page.selectedMaterial}
          selectedMaterials={page.selectedMaterials}
        />
      </ConfirmDialog>
    </AuthenticatedLayout>
  );
};

export default RawMaterialsPage;

