import React from 'react';
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
  const trimmedSearchQuery = String(searchQuery || '').trim();
  const canCreateMissing = Boolean(onCreateMissingMaterial && trimmedSearchQuery.length >= 2);

  return (
    <div className={mobile ? 'space-y-2' : 'space-y-1.5'}>
      {materials.map((material) => {
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
          className={`flex w-full min-w-0 flex-col items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
            disabled
              ? 'cursor-not-allowed border-[#e7dfcf] bg-[#f3eee4] text-muted-foreground opacity-70'
              : 'border-transparent bg-white hover:border-[#decda6] hover:bg-[#fff9ec]'
          }`}
        >
          <div className="min-w-0 w-full">
            <div className="break-words text-sm font-medium leading-snug">{material.name}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {material.type === 'solvent' ? 'Solvent' : 'Raw material'}
              {material.unit ? ` - ${material.unit}` : ''}
            </div>
          </div>
          <div className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
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
      {materials.length === 0 ? (
        <div className="space-y-2">
          <div className="rounded-xl bg-white px-3 py-4 text-sm text-muted-foreground">
            No raw materials found.
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
