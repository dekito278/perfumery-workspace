import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formatPricePerUnit } from '@/utils/pricingUtils.js';
import { deriveScentFamilyFromCategory } from '@/utils/rawMaterialCategoryMeta.js';

const RawMaterialMobileCard = ({
  row,
  guidance,
  selected,
  onToggle,
  onView,
  referenceStatusMap,
}) => (
  <div className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`Select ${row.name}`}
          className="mt-1"
        />
        <button onClick={onView} className="min-w-0 flex-1 text-left">
          <div className="truncate text-base font-semibold text-primary">{row.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {row.scent_family || deriveScentFamilyFromCategory(row.category, '') || 'Family not set'}
          </div>
        </button>
      </div>
      <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] capitalize">
        {row.type}
      </Badge>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl bg-muted/45 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Category</div>
        <div className="mt-1 text-sm">{row.category || 'Uncategorized'}</div>
      </div>
      <div className="rounded-2xl bg-muted/45 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Price</div>
        <div className="mt-1 text-sm">{formatPricePerUnit(row.cost_per_unit, row.unit)}</div>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <Badge variant={guidance.hasWarning ? 'outline' : 'secondary'} className="rounded-full px-2.5 py-1 text-[10px]">
        {guidance.hasWarning ? 'Needs guidance' : 'Guidance ready'}
      </Badge>
      {referenceStatusMap.get(row.id)?.reference_profile ? (
        <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[10px]">
          Ref {referenceStatusMap.get(row.id).reference_profile.reference_code}
        </Badge>
      ) : null}
    </div>
  </div>
);

export default RawMaterialMobileCard;
