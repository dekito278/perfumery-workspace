import React from 'react';
import { Archive, ChevronRight, Link2, PackageCheck, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import { getResolvedGuidanceNumber, getResolvedGuidanceValues } from '@/utils/mobileRawMaterialGuidance.js';

const RawMaterialCardMobile = ({
  addActionActive = false,
  addActionDisabled = false,
  addActionIcon: AddActionIcon = PackageCheck,
  addActionLabel = 'Stock',
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
    material.type,
  ].filter(Boolean).slice(0, 2);
  const stock = Number(material.stock_quantity || 0);
  const stockThreshold = Number(material.low_stock_threshold ?? material.minimum_stock ?? 0);
  const lowStock = stockThreshold > 0 && stock <= stockThreshold;
  const archived = material.data_status === 'archived';

  const ready = Boolean(resolved.workbook_code || impact || life || resolved.ifra_limit);

  return (
    <article className="mobile-card mobile-compact-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-[#1f2937]">{material.name}</h3>
          <div className="mt-0.5 grid grid-cols-2 gap-1 text-[11px] font-semibold text-[#6b7280]">
            <span className="truncate">life {life ?? '-'}</span>
            <span className="truncate">impact {impact ?? '-'}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <MobileStatusBadge tone={ready ? 'active' : 'warning'} className="h-5 px-2 text-[10px]">
            {ready ? 'Ready' : 'Audit'}
          </MobileStatusBadge>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onArchive}
            className="h-7 w-7 rounded-xl border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-800"
            aria-label={`${archived ? 'Restore' : 'Archive'} ${material.name}`}
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onDelete}
            className="h-7 w-7 rounded-xl border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
            aria-label={`Delete ${material.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className={`mt-3 rounded-2xl border px-3 py-2 ${lowStock ? 'border-rose-200 bg-rose-50' : 'border-emerald-100 bg-emerald-50'}`}>
        <div className="flex items-center justify-between gap-3">
          <span className={`text-[10px] font-bold uppercase ${lowStock ? 'text-rose-700' : 'text-emerald-700'}`}>
            {lowStock ? 'Low stock' : 'Stock'}
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
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold capitalize text-slate-700">{material.data_status.replace('_', ' ')}</span>
        ) : null}
        {resolved.cas_number ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">CAS {resolved.cas_number}</span> : null}
      </div>
      <div className="mt-3 grid grid-cols-[1fr_1fr_40px] gap-2">
        <Button type="button" variant="outline" onClick={onOpenGuidance} className="h-9 rounded-xl bg-white text-[11px]">
          <Link2 className="mr-1 h-4 w-4" />
          Guidance
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onAddToFormula}
          disabled={addActionDisabled}
          className={`h-9 rounded-xl text-[11px] ${addActionActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'bg-white'}`}
        >
          <AddActionIcon className="mr-1 h-4 w-4" />
          {addActionLabel}
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={onOpen} className="h-9 w-10 rounded-xl bg-white" aria-label="Open material">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </article>
  );
};

export default RawMaterialCardMobile;
