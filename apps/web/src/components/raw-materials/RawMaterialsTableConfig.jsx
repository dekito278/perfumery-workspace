import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatPricePerUnit } from '@/utils/pricingUtils.js';
import { deriveScentFamilyFromCategory } from '@/utils/rawMaterialCategoryMeta.js';
import { REFERENCE_STATUS_LABELS, getReferenceStatusBadgeClassName } from '@/hooks/useRawMaterialsPage.js';

const hasCustomSolventCalibration = (row) => (
  row.type === 'solvent'
  && (
    row.solvent_impact_shift_percent != null
    || row.solvent_life_shift_percent != null
  )
);

const getStockAlertThreshold = (row) => Number(row.low_stock_threshold ?? row.minimum_stock ?? 0);
const isLowStock = (row) => {
  const stock = Number(row.stock_quantity || 0);
  const threshold = getStockAlertThreshold(row);
  return threshold > 0 && stock <= threshold;
};

export const createRawMaterialsColumns = ({
  categoryColorMap,
  getMaterialGuidanceDetails,
  handleView,
  openGuidanceEditor,
}) => [
  {
    key: 'name',
    label: 'Name',
    render: (row) => {
      const guidance = getMaterialGuidanceDetails(row);
      const linkedReference = guidance.resolvedReference;

      return (
        <button onClick={() => handleView(row)} className="text-left">
          <div className="text-sm font-semibold text-primary transition hover:underline">{row.name}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">
              {row.scent_family || deriveScentFamilyFromCategory(row.category, '') || 'Family not set'}
            </span>
            {linkedReference ? (
              <>
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] font-medium">
                  Ref {linkedReference.reference_code}
                </Badge>
                <Badge variant="outline" className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getReferenceStatusBadgeClassName(guidance.reviewStatus)}`}>
                  {REFERENCE_STATUS_LABELS[guidance.reviewStatus] || 'Reference'}
                </Badge>
              </>
            ) : (
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] font-medium">
                Unmatched
              </Badge>
            )}
            {row.data_status && row.data_status !== 'active' ? (
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] font-medium">
                {row.data_status.replace('_', ' ')}
              </Badge>
            ) : null}
          </div>
        </button>
      );
    },
  },
  {
    key: 'type',
    label: 'Type',
    render: (row) => (
      <div className="min-w-[132px]">
        <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize">
          {row.type}
        </Badge>
        {row.type === 'solvent' ? (
          <div className="mt-2">
            <Badge
              variant="outline"
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                hasCustomSolventCalibration(row)
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              {hasCustomSolventCalibration(row) ? 'Custom calibration' : 'Preset solvent'}
            </Badge>
          </div>
        ) : null}
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span
            className="h-2.5 w-2.5 rounded-full border border-border/60"
            style={{ backgroundColor: categoryColorMap.get(String(row.category || '').toLowerCase()) || '#CBD5E1' }}
          />
          <span className="truncate">{row.category || 'Uncategorized'}</span>
        </div>
      </div>
    ),
  },
  {
    key: 'guidance',
    label: 'Guidance',
    render: (row) => {
      const guidance = getMaterialGuidanceDetails(row);
      const linkedReference = guidance.resolvedReference || null;

      return (
        <div className="min-w-[190px]">
          <button
            type="button"
            onClick={() => openGuidanceEditor(row)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              guidance.hasWarning
                ? 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
            }`}
          >
            {guidance.hasWarning ? (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
            )}
            {guidance.hasWarning
              ? (guidance.hasCoreGuidance ? 'Guidance partial' : 'Needs guidance')
              : 'Guidance ready'}
          </button>
          <div className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
            {guidance.hasWarning
              ? [
                  guidance.missingClass ? 'family' : null,
                  guidance.missingImpact ? 'impact' : null,
                  guidance.missingLife ? 'life' : null,
                  guidance.missingCas ? 'CAS' : null,
                  guidance.missingIfra ? 'IFRA' : null,
                ].filter(Boolean).join(', ')
              : 'Impact, life, CAS, dan IFRA sudah ada.'}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="outline" className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getReferenceStatusBadgeClassName(guidance.reviewStatus)}`}>
              {REFERENCE_STATUS_LABELS[guidance.reviewStatus] || 'Reference'}
            </Badge>
            {guidance.confidenceScore !== null ? (
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] font-medium">
                Confidence {guidance.confidenceScore}
              </Badge>
            ) : null}
          </div>
          <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            <div>{row.workbook_code ? `Workbook ${row.workbook_code}` : 'No workbook code'}</div>
            <div>{linkedReference?.reference_code ? `Reference ${linkedReference.reference_code}` : 'No linked reference profile'}</div>
            <div>{guidance.resolvedClass ? `Family ${guidance.resolvedClass}` : 'Family not set'}</div>
            <div>
              {guidance.resolvedImpact || guidance.resolvedLife
                ? `Impact ${guidance.resolvedImpact ?? '-'} | Life ${guidance.resolvedLife ?? '-'}h`
                : 'Impact/life not set'}
            </div>
          </div>
        </div>
      );
    },
  },
  {
    key: 'stock_quantity',
    label: 'Stock',
    align: 'right',
    render: (row) => {
      const stock = Number(row.stock_quantity || 0);
      const threshold = getStockAlertThreshold(row);
      return (
        <div className="text-right">
          <div className={`font-mono text-sm font-semibold ${isLowStock(row) ? 'text-rose-700' : 'text-foreground'}`}>
            {stock.toLocaleString('id-ID', { maximumFractionDigits: 3 })} {row.unit || ''}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {threshold > 0 ? `Alert <= ${threshold.toLocaleString('id-ID', { maximumFractionDigits: 3 })}` : 'No alert set'}
          </div>
          {isLowStock(row) ? (
            <Badge variant="outline" className="mt-2 rounded-full border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700">
              Low stock
            </Badge>
          ) : null}
        </div>
      );
    },
  },
  {
    key: 'cost_per_unit',
    label: 'Price',
    align: 'right',
    render: (row) => (
      <div className="text-right">
        <div className="font-mono text-sm font-medium text-foreground">{formatPricePerUnit(row.cost_per_unit, row.unit)}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {row.workbook_code ? `Workbook ${row.workbook_code}` : 'No workbook code'}
        </div>
      </div>
    ),
  },
];
