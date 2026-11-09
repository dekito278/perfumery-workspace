import React from 'react';
import { Badge } from '@/components/ui/badge';
import { BookOpenText } from 'lucide-react';

const formatNullable = (value, suffix = '') => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return `${value}${suffix}`;
};

const MetricTile = ({ label, value }) => (
  <div className="rounded-[16px] border border-[#e7decb] bg-white/90 px-3 py-2">
    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a7854]">{label}</div>
    <div className="mt-1 text-sm font-semibold text-[#3f3424]">{value}</div>
  </div>
);

const FormulaReferenceProfileSidebar = ({ details = null, className = '' }) => {
  if (!details?.rawMaterial) {
    return (
      <section className={`overflow-hidden rounded-[22px] border border-[#ddd3bf] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,246,239,0.98)_100%)] shadow-sm ${className}`.trim()}>
        <div className="border-b border-[#e7decb] px-4 py-3">
          <div className="flex items-center gap-2">
            <BookOpenText className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold text-[#3c3222]">Acuan workbook</div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Profil acuan untuk bahan yang aktif akan muncul di sini.
          </p>
        </div>
        <div className="px-4 py-5 text-sm text-muted-foreground">
          Belum ada bahan aktif.
        </div>
      </section>
    );
  }

  const {
    rawMaterial,
    referenceProfile,
    classDistribution,
    resolvedValues,
    missingGuidance,
  } = details;

  const leadClass = classDistribution?.[0] || null;

  return (
    <section className={`overflow-hidden rounded-[22px] border border-[#ddd3bf] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,246,239,0.98)_100%)] shadow-sm ${className}`.trim()}>
      <div className="border-b border-[#e7decb] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <BookOpenText className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold text-[#3c3222]">Acuan panduan</div>
          <Badge variant="outline" className="rounded-full text-[10px]">
            {referenceProfile?.reference_code ? 'Panduan terhubung' : missingGuidance ? 'Profil cadangan' : 'Acuan siap'}
          </Badge>
        </div>
        <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7854]">Profil panduan</div>
        <div className="mt-1 text-sm font-semibold text-[#3f3424]">{rawMaterial.name}</div>
        <p className="mt-1 text-xs text-muted-foreground">
          {referenceProfile?.brief_description || referenceProfile?.odour_description || rawMaterial.description || 'Belum ada deskripsi profil.'}
        </p>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <MetricTile label="Kode workbook" value={formatNullable(resolvedValues.workbook_code)} />
          <MetricTile label="CAS" value={formatNullable(resolvedValues.cas_number)} />
          <MetricTile label="Kelas utama" value={formatNullable(leadClass?.familyName || resolvedValues.reference_abc_primary_family)} />
          <MetricTile label="Batas IFRA" value={formatNullable(resolvedValues.ifra_limit, '%')} />
          <MetricTile label="Kekuatan" value={formatNullable(resolvedValues.reference_impact)} />
          <MetricTile label="Ketahanan" value={formatNullable(resolvedValues.reference_life_hours, ' jam')} />
        </div>

        <div className="flex flex-wrap gap-2">
          {classDistribution?.slice(0, 4).map((entry) => (
            <Badge key={`${entry.letter}-${entry.familyName}`} variant="secondary" className="rounded-full">
              {entry.letter}: {entry.familyName}
            </Badge>
          ))}
        </div>

        <div className="rounded-[16px] border border-[#e7decb] bg-[#fcfaf4] px-3 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a7854]">Pemakaian di parfum</div>
          <div className="mt-1 text-sm text-[#4a4030]">
            {referenceProfile?.perfume_uses || referenceProfile?.odour_profile || rawMaterial.notes || 'Belum ada panduan pemakaian.'}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FormulaReferenceProfileSidebar;
