import React from 'react';
import { ChevronRight, Link2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import { getResolvedGuidanceNumber, getResolvedGuidanceValues } from '@/utils/mobileRawMaterialGuidance.js';

const RawMaterialCardMobile = ({ material, onOpen, onAddToFormula, onOpenGuidance }) => {
  const resolved = getResolvedGuidanceValues(material);
  const impact = getResolvedGuidanceNumber(material, 'reference_impact');
  const life = getResolvedGuidanceNumber(material, 'reference_life_hours');
  const tags = [
    resolved.reference_abc_primary_family,
    material.category,
    material.type,
  ].filter(Boolean).slice(0, 2);

  const ready = Boolean(resolved.workbook_code || impact || life || resolved.ifra_limit);

  return (
    <article className="mobile-card mobile-compact-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-[#1f2937]">{material.name}</h3>
          <div className="mt-0.5 grid grid-cols-2 gap-1 text-[11px] font-semibold text-[#6b7280]">
            <span className="truncate">life {life ?? '-'}</span>
            <span className="truncate">impact {impact ?? '-'}</span>
          </div>
        </div>
        <MobileStatusBadge tone={ready ? 'active' : 'warning'} className="h-5 px-2 text-[10px]">
          {ready ? 'Ready' : 'Audit'}
        </MobileStatusBadge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-bold capitalize text-[#6b7280]">{tag}</span>
        ))}
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">CAS {resolved.cas_number || 'not set'}</span>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_1fr_36px] gap-2">
        <Button type="button" variant="outline" onClick={onOpenGuidance} className="h-9 rounded-xl bg-white text-[11px]">
          <Link2 className="mr-1 h-4 w-4" />
          Guidance
        </Button>
        <Button type="button" variant="outline" onClick={onAddToFormula} className="h-9 rounded-xl bg-white text-[11px]">
          <Plus className="mr-1 h-4 w-4" />
          Formula
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={onOpen} className="h-9 w-9 rounded-xl bg-white" aria-label="Open material">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </article>
  );
};

export default RawMaterialCardMobile;
