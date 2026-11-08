import React from 'react';
import { Archive, ChevronRight, Link2, PackageCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import { getResolvedGuidanceNumber, getResolvedGuidanceValues } from '@/utils/mobileRawMaterialGuidance.js';

// Display labels only: the stored values stay `material`/`solvent` and `needs_review`/`archived`.
const TYPE_LABELS = { material: 'bahan', solvent: 'pelarut' };
const DATA_STATUS_LABELS = { needs_review: 'perlu ditinjau', archived: 'diarsipkan', verified: 'terverifikasi' };

const RawMaterialCardMobile = ({
  addActionActive = false,
  addActionDisabled = false,
  addActionIcon: AddActionIcon = PackageCheck,
  addActionLabel = 'Stok',
  material,
  onAddToFormula,
  onArchive,
  onDelete,
  onOpen,
  onOpenGuidance,
}) => {
  const resolved = getResolvedGuidanceValues(material);
  const impact = getResolvedGuidanceNumber(material, 'reference_impact');
  const life = getResolvedGuidanceNumber(material, 'reference_life_hours');
  const tags = [
    resolved.reference_abc_primary_family,
    material.category,
    TYPE_LABELS[material.type] || material.type,
  ].filter(Boolean).slice(0, 2);
  const stock = Number(material.stock_quantity || 0);
  const stockThreshold = Number(material.low_stock_threshold ?? material.minimum_stock ?? 0);
  const lowStock = stockThreshold > 0 && stock <= stockThreshold;
  const archived = material.data_status === 'archived';

  const ready = Boolean(resolved.workbook_code || impact || life || resolved.ifra_limit);

  return (
    <article className="mobile-card mobile-compact-card mobile-list-card mobile-interactive p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-[#1f2937]">{material.name}</h3>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-semibold text-[#6b7280]">
            <span>ketahanan di strip {life ?? '-'}</span>
            <span>kekuatan {impact ?? '-'}</span>
          </div>
        </div>
        {/* 44px squares, 8px apart. At h-7 w-7 the 44px phone minimum stretched them into 28px-wide pills,
            with Delete 6px from Archive. */}
        <div className="flex shrink-0 items-center gap-2">
          <MobileStatusBadge tone={ready ? 'active' : 'warning'} className="h-5 px-2 text-[10px]">
            {ready ? 'Siap' : 'Audit'}
          </MobileStatusBadge>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onArchive}
            className="mobile-interactive mobile-pressable h-11 w-11 rounded-xl border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-800"
            aria-label={`${archived ? 'Pulihkan' : 'Arsipkan'} ${material.name}`}
          >
            <Archive className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onDelete}
            className="mobile-interactive mobile-delete-action h-11 w-11 rounded-xl border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
            aria-label={`Hapus ${material.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className={`mt-3 rounded-2xl border px-3 py-2 ${lowStock ? 'border-rose-200 bg-rose-50' : 'border-emerald-100 bg-emerald-50'}`}>
        <div className="flex items-center justify-between gap-3">
          <span className={`text-[10px] font-bold uppercase ${lowStock ? 'text-rose-700' : 'text-emerald-700'}`}>
            {lowStock ? 'Stok menipis' : 'Stok'}
          </span>
          <span className={`font-mono text-xs font-bold ${lowStock ? 'text-rose-800' : 'text-emerald-800'}`}>
            {stock.toLocaleString('id-ID', { maximumFractionDigits: 3 })} {material.unit || ''}
          </span>
        </div>
        <div className="mt-1 text-[10px] font-semibold text-[#6b7280]">
          Rp {Number(material.cost_per_unit || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })} per 10 {material.unit || 'g'}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.map((tag, index) => (
          <span key={`${tag}-${index}`} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-bold capitalize text-[#6b7280]">{tag}</span>
        ))}
        {material.data_status && material.data_status !== 'active' ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold capitalize text-slate-700">{DATA_STATUS_LABELS[material.data_status] || material.data_status.replace('_', ' ')}</span>
        ) : null}
        {resolved.cas_number ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">CAS {resolved.cas_number}</span> : null}
      </div>
      <div className="mt-3 grid grid-cols-[1fr_1fr_40px] gap-2">
        <Button type="button" variant="outline" onClick={onOpenGuidance} className="mobile-interactive mobile-pressable h-9 rounded-xl bg-white text-[11px]">
          <Link2 className="mr-1 h-4 w-4" />
          Panduan
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onAddToFormula}
          disabled={addActionDisabled}
          className={`mobile-interactive mobile-pressable ${addActionActive ? 'mobile-success-pulse' : 'mobile-add-action'} h-9 rounded-xl text-[11px] ${addActionActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'bg-white'}`}
        >
          <AddActionIcon className="mr-1 h-4 w-4" />
          {addActionLabel}
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={onOpen} className="mobile-interactive mobile-pressable h-9 w-10 rounded-xl bg-white" aria-label="Buka bahan">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </article>
  );
};

export default RawMaterialCardMobile;
