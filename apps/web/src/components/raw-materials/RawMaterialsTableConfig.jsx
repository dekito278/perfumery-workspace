import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatPricePerUnit } from '@/utils/pricingUtils.js';
import { deriveScentFamilyFromCategory } from '@/utils/rawMaterialCategoryMeta.js';
import { DATA_STATUS_LABELS, REFERENCE_STATUS_LABELS, TYPE_LABELS, getReferenceStatusBadgeClassName } from '@/hooks/useRawMaterialsPage.js';

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
    label: 'Nama',
    render: (row) => {
      const guidance = getMaterialGuidanceDetails(row);
      const linkedReference = guidance.resolvedReference;

      return (
        <button onClick={() => handleView(row)} className="text-left">
          <div className="text-sm font-semibold text-primary transition hover:underline">{row.name}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">
              {row.scent_family || deriveScentFamilyFromCategory(row.category, '') || 'Keluarga aroma belum diisi'}
            </span>
            {linkedReference ? (
              <>
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] font-medium">
                  Ref {linkedReference.reference_code}
                </Badge>
                <Badge variant="outline" className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getReferenceStatusBadgeClassName(guidance.reviewStatus)}`}>
                  {REFERENCE_STATUS_LABELS[guidance.reviewStatus] || 'Acuan'}
                </Badge>
              </>
            ) : (
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] font-medium">
                Belum cocok
              </Badge>
            )}
            {row.data_status && row.data_status !== 'active' ? (
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] font-medium">
                {DATA_STATUS_LABELS[row.data_status] || row.data_status.replace('_', ' ')}
              </Badge>
            ) : null}
          </div>
        </button>
      );
    },
  },
  {
    key: 'type',
    label: 'Jenis',
    render: (row) => (
      <div className="min-w-[132px]">
        <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize">
          {TYPE_LABELS[row.type] || row.type}
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
              {hasCustomSolventCalibration(row) ? 'Kalibrasi sendiri' : 'Preset pelarut'}
            </Badge>
          </div>
        ) : null}
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span
            className="h-2.5 w-2.5 rounded-full border border-border/60"
            style={{ backgroundColor: categoryColorMap.get(String(row.category || '').toLowerCase()) || '#CBD5E1' }}
          />
          <span className="truncate">{row.category || 'Tanpa kategori'}</span>
        </div>
      </div>
    ),
  },
  {
    key: 'guidance',
    label: 'Panduan',
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
              ? (guidance.hasCoreGuidance ? 'Panduan sebagian' : 'Perlu panduan')
              : 'Panduan siap'}
          </button>
          <div className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
            {guidance.hasWarning
              ? 'Belum ada: ' + [
                  guidance.missingClass ? 'keluarga aroma' : null,
                  guidance.missingImpact ? 'kekuatan' : null,
                  guidance.missingLife ? 'ketahanan' : null,
                  guidance.missingCas ? 'CAS' : null,
                  guidance.missingIfra ? 'IFRA' : null,
                ].filter(Boolean).join(', ')
              : 'Kekuatan, ketahanan, CAS, dan IFRA sudah ada.'}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="outline" className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getReferenceStatusBadgeClassName(guidance.reviewStatus)}`}>
              {REFERENCE_STATUS_LABELS[guidance.reviewStatus] || 'Acuan'}
            </Badge>
            {guidance.confidenceScore !== null ? (
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] font-medium">
                Keyakinan {guidance.confidenceScore}
              </Badge>
            ) : null}
          </div>
          <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            <div>{row.workbook_code ? `Workbook ${row.workbook_code}` : 'Belum ada kode workbook'}</div>
            <div>{linkedReference?.reference_code ? `Acuan ${linkedReference.reference_code}` : 'Belum ada profil acuan tertaut'}</div>
            <div>{guidance.resolvedClass ? `Keluarga aroma ${guidance.resolvedClass}` : 'Keluarga aroma belum diisi'}</div>
            <div>
              {guidance.resolvedImpact || guidance.resolvedLife
                ? `Kekuatan ${guidance.resolvedImpact ?? '-'} | Ketahanan ${guidance.resolvedLife ?? '-'} jam`
                : 'Kekuatan/ketahanan belum diisi'}
            </div>
          </div>
        </div>
      );
    },
  },
  {
    key: 'stock_quantity',
    label: 'Stok',
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
            {threshold > 0 ? `Peringatan <= ${threshold.toLocaleString('id-ID', { maximumFractionDigits: 3 })}` : 'Belum ada batas peringatan'}
          </div>
          {isLowStock(row) ? (
            <Badge variant="outline" className="mt-2 rounded-full border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700">
              Stok menipis
            </Badge>
          ) : null}
        </div>
      );
    },
  },
  {
    key: 'cost_per_unit',
    label: 'Harga',
    align: 'right',
    render: (row) => (
      <div className="text-right">
        <div className="font-mono text-sm font-medium text-foreground">{formatPricePerUnit(row.cost_per_unit, row.unit)}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {row.workbook_code ? `Workbook ${row.workbook_code}` : 'Belum ada kode workbook'}
        </div>
      </div>
    ),
  },
];
