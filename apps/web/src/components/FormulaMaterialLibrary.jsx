import React from 'react';

const FormulaMaterialLibrary = ({
  materials,
  activeRowIndex,
  currentRowItemId,
  selectedRawMaterialIdsSet,
  mobile = false,
  onSelect,
  onDoubleSelect,
  getDisabledState,
  getBadgeLabel,
}) => (
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
      <div className="rounded-xl bg-white px-3 py-4 text-sm text-muted-foreground">
        No raw materials found.
      </div>
    ) : null}
  </div>
);

export default FormulaMaterialLibrary;
