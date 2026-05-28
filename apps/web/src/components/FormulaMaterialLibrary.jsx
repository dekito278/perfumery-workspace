import React, { useMemo, useState } from 'react';
import { PlusCircle } from 'lucide-react';

const FormulaMaterialLibrary = ({
  materials,
  activeRowIndex,
  searchQuery = '',
  currentRowItemId,
  selectedRawMaterialIdsSet,
  mobile = false,
  onSelect,
  onDoubleSelect,
  onCreateMissingMaterial,
  getDisabledState,
  getBadgeLabel,
}) => {
  const [filterMode, setFilterMode] = useState('all');
  const trimmedSearchQuery = String(searchQuery || '').trim();
  const canCreateMissing = Boolean(onCreateMissingMaterial && trimmedSearchQuery.length >= 2);
  const filteredMaterials = useMemo(() => {
    if (filterMode === 'unused') {
      return materials.filter((material) => !selectedRawMaterialIdsSet.has(material.id));
    }

    if (filterMode === 'selected') {
      return materials.filter((material) => selectedRawMaterialIdsSet.has(material.id));
    }

    if (filterMode === 'solvents') {
      return materials.filter((material) => material.type === 'solvent');
    }

    return materials;
  }, [filterMode, materials, selectedRawMaterialIdsSet]);

  const filterOptions = [
    { id: 'all', label: 'All', count: materials.length },
    { id: 'unused', label: 'Unused', count: materials.filter((material) => !selectedRawMaterialIdsSet.has(material.id)).length },
    { id: 'selected', label: 'In formula', count: materials.filter((material) => selectedRawMaterialIdsSet.has(material.id)).length },
    { id: 'solvents', label: 'Solvents', count: materials.filter((material) => material.type === 'solvent').length },
  ];

  return (
    <div className={mobile ? 'space-y-3' : 'space-y-2'}>
      <div className="sticky top-0 z-10 -mx-1 bg-[#fcfaf4]/95 px-1 pb-2 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold text-muted-foreground">
            {filteredMaterials.length} of {materials.length} shown
          </div>
          {trimmedSearchQuery ? (
            <div className="max-w-[52%] truncate rounded-full border border-[#e4d8c0] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#6f603d]">
              "{trimmedSearchQuery}"
            </div>
          ) : null}
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {filterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilterMode(option.id)}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                filterMode === option.id
                  ? 'border-[#b99a54] bg-[#fff0c8] text-[#4d3b14]'
                  : 'border-[#e4d8c0] bg-white text-[#756747] hover:border-[#cbb982]'
              }`}
            >
              {option.label} {option.count}
            </button>
          ))}
        </div>
      </div>

      {filteredMaterials.map((material) => {
      const disabled = getDisabledState({
        material,
        currentRowItemId,
        selectedRawMaterialIdsSet,
      });

      return (
        <button
          key={material.id}
          type="button"
          onClick={() => onSelect(material.id, { mobile })}
          onDoubleClick={mobile ? undefined : () => onDoubleSelect(material.id)}
          disabled={disabled}
          className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
            disabled
              ? 'cursor-not-allowed border-[#e7dfcf] bg-[#f3eee4] text-muted-foreground opacity-70'
              : 'border-transparent bg-white hover:border-[#decda6] hover:bg-[#fff9ec]'
          }`}
        >
          <div className="min-w-0 w-full">
            <div className="truncate text-sm font-medium leading-snug">{material.name}</div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {material.type === 'solvent' ? 'Solvent' : 'Raw material'}
              {material.unit ? ` - ${material.unit}` : ''}
              {material.data_status ? ` - ${material.data_status}` : ''}
            </div>
          </div>
          <div className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${
            disabled
              ? 'bg-[#e4dccb] text-[#8b7d63]'
              : 'bg-[#f6efe0] text-[#7d6942]'
          }`}>
            {getBadgeLabel({
              material,
              currentRowItemId,
              selectedRawMaterialIdsSet,
              activeRowIndex,
              mobile,
            })}
          </div>
        </button>
      );
      })}
      {filteredMaterials.length === 0 ? (
        <div className="space-y-2">
          <div className="rounded-xl bg-white px-3 py-4 text-sm text-muted-foreground">
            {materials.length === 0 ? 'No raw materials found.' : 'No materials in this filter.'}
          </div>
          {canCreateMissing ? (
            <button
              type="button"
              onClick={() => onCreateMissingMaterial({ name: trimmedSearchQuery, rowIndex: activeRowIndex })}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-3 text-left text-amber-950 transition-colors hover:bg-amber-100"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Tambah raw material baru</span>
                <span className="block truncate text-[11px] text-amber-800">"{trimmedSearchQuery}" akan dibuat sebagai raw material.</span>
              </span>
              <PlusCircle className="h-4 w-4 shrink-0" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default FormulaMaterialLibrary;
