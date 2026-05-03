import React from 'react';
import { BookmarkPlus, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';

const RawMaterialCardMobile = ({ material, onOpen, onAddToFormula, onAddToShortlist }) => {
  const tags = [
    material.reference_abc_primary_family,
    material.category,
    material.type,
  ].filter(Boolean).slice(0, 3);

  const ready = Boolean(material.workbook_code || material.reference_impact || material.reference_life_hours || material.ifra_limit);

  return (
    <article className="mobile-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="mobile-line-clamp-2 text-base font-bold text-[#1f2937]">{material.name}</h3>
          <div className="mt-1 text-xs font-semibold text-[#6b7280]">CAS {material.cas_number || 'Not set'}</div>
        </div>
        <MobileStatusBadge tone={ready ? 'active' : 'warning'}>{ready ? 'Ready' : 'Audit'}</MobileStatusBadge>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[11px] font-bold capitalize text-[#6b7280]">{tag}</span>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-[1fr_1fr_44px] gap-2">
        <Button type="button" variant="outline" onClick={onAddToShortlist} className="rounded-2xl bg-white text-xs">
          <BookmarkPlus className="mr-1 h-4 w-4" />
          Shortlist
        </Button>
        <Button type="button" variant="outline" onClick={onAddToFormula} className="rounded-2xl bg-white text-xs">
          <Plus className="mr-1 h-4 w-4" />
          Formula
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={onOpen} className="rounded-2xl bg-white" aria-label="Open material">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </article>
  );
};

export default RawMaterialCardMobile;
