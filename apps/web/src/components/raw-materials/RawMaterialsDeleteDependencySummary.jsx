import React from 'react';

const RawMaterialsDeleteDependencySummary = ({
  dependencies,
  loading,
  checkFailed,
  selectedMaterial,
  selectedMaterials,
}) => {
  if (!selectedMaterial) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Hapus sekaligus memproses {selectedMaterials.length} bahan terpilih satu per satu dan berhenti di bahan pertama yang tertahan.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Memeriksa di mana bahan ini masih dipakai...
      </div>
    );
  }

  // A lookup that threw knows nothing about references. Falling through to the green panel below would
  // turn that failure into a safety guarantee.
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

export default RawMaterialsDeleteDependencySummary;
