import React from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SearchBar from '@/components/SearchBar.jsx';
import FilterBar from '@/components/FilterBar.jsx';

const RawMaterialsToolbar = ({
  searchTerm,
  setSearchTerm,
  showRefreshing,
  loading,
  onRefresh,
  filters,
  onFilterChange,
  onClearFilters,
  selectedMaterialIds,
  clearSelection,
  handleBulkDelete,
  totalMaterials,
  materialsCount,
  hasActiveFilters,
  referenceFilter,
}) => (
  <div className="list-toolbar-panel mb-6">
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Search material library or reference data
        </div>
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search by name, vendor, CAS, workbook code, reference code, or family..."
          disabled={showRefreshing}
        />
      </div>
      <div className="flex items-end">
        <Button onClick={onRefresh} variant="outline" size="icon" disabled={loading} className="h-11 w-11 rounded-xl">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>

    <div className="mt-3 rounded-xl border border-white/70 bg-white/55 p-3">
      <FilterBar
        filters={filters}
        onFilterChange={onFilterChange}
        onClearAll={onClearFilters}
        compact
        disabled={showRefreshing}
      />
    </div>

    {selectedMaterialIds.length > 0 ? (
      <div className="mt-3 flex flex-col gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{selectedMaterialIds.length} material selected on this page</p>
          <p className="text-sm text-muted-foreground">Use bulk delete to clean up duplicate or unused materials faster.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={clearSelection} className="rounded-xl">
            Clear selection
          </Button>
          <Button
            variant="destructive"
            onClick={handleBulkDelete}
            className="gap-2 rounded-xl"
          >
            <Trash2 className="h-4 w-4" />
            Delete selected
          </Button>
        </div>
      </div>
    ) : null}

    {!loading && totalMaterials > 0 ? (
      <div className="results-count">
        Showing {materialsCount} of {totalMaterials} materials
        {hasActiveFilters ? ' with active filters applied' : ''}
        {referenceFilter !== 'all' ? ' on this page' : ''}
      </div>
    ) : null}
  </div>
);

export default RawMaterialsToolbar;
