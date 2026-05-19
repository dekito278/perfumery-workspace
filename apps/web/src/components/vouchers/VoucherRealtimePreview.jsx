import React from 'react';
import { AlertCircle, BadgePercent, CheckCircle2 } from 'lucide-react';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
const formatNumber = (value) => new Intl.NumberFormat('id-ID').format(Number(value || 0));

const Metric = ({ label, value, helper, tone = 'neutral' }) => {
  const tones = {
    neutral: 'bg-white text-[#0b130c] ring-[#e5e7eb]',
    amber: 'bg-amber-50 text-amber-900 ring-amber-100',
    emerald: 'bg-emerald-50 text-emerald-900 ring-emerald-100',
    rose: 'bg-rose-50 text-rose-800 ring-rose-100',
  };

  return (
    <div className={`rounded-2xl px-3 py-2 ring-1 ${tones[tone] || tones.neutral}`}>
      <div className="text-[10px] font-bold uppercase text-current/70">{label}</div>
      <div className="mt-1 truncate text-sm font-bold">{value}</div>
      {helper ? <div className="mt-0.5 truncate text-[11px] font-semibold text-current/70">{helper}</div> : null}
    </div>
  );
};

const VoucherRealtimePreview = ({ preview, className = '' }) => {
  if (!preview) return null;

  const eligibleNames = preview.eligibleItems
    .slice(0, 4)
    .map((item) => item.name)
    .filter(Boolean);
  const issueCount = preview.blockingIssues.length;
  const statusTone = issueCount ? 'rose' : 'emerald';
  const minimumOrderHelper = preview.voucher.minimumOrder > 0
    ? (preview.minimumOrderShortage > 0 ? `Kurang ${formatTotal(preview.minimumOrderShortage)}` : 'Minimum terpenuhi')
    : 'Tanpa minimum order';
  const minimumQuantityHelper = preview.voucher.minimumQuantity > 0
    ? (preview.minimumQuantityShortage > 0 ? `Kurang ${formatNumber(preview.minimumQuantityShortage)} item` : 'Minimum terpenuhi')
    : 'Tanpa minimum quantity';
  const getRuleDetail = (rule) => {
    if (rule.key === 'minimum-order' && preview.minimumOrderShortage > 0) {
      return `Kurang ${formatTotal(preview.minimumOrderShortage)}`;
    }
    return rule.detail;
  };

  return (
    <section className={`rounded-2xl border border-[#e5e7eb] bg-[#f7f8f2] p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase text-amber-700">Preview real-time</div>
          <h3 className="mt-1 text-base font-bold text-[#0b130c]">Simulasi aturan voucher</h3>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
            Estimasi dihitung dari produk Studio yang eligible, masing-masing 1 item.
          </p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${issueCount ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {issueCount ? <AlertCircle className="h-4 w-4" /> : <BadgePercent className="h-4 w-4" />}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Metric
          label="Aturan berlaku"
          value={issueCount ? `${issueCount} perlu dicek` : 'Siap dipakai'}
          helper={issueCount ? preview.blockingIssues[0]?.label : 'Semua aturan utama lolos'}
          tone={statusTone}
        />
        <Metric
          label="Produk eligible"
          value={`${formatNumber(preview.eligibleItems.length)} produk`}
          helper={eligibleNames.length ? eligibleNames.join(', ') : 'Tidak ada produk cocok'}
          tone={preview.eligibleItems.length ? 'neutral' : 'rose'}
        />
        <Metric
          label="Minimum"
          value={`${formatTotal(preview.eligibleSubtotal)} / ${formatNumber(preview.eligibleQuantity)} item`}
          helper={`${minimumOrderHelper} • ${minimumQuantityHelper}`}
          tone={preview.minimumOrderShortage || preview.minimumQuantityShortage ? 'amber' : 'neutral'}
        />
        <Metric
          label="Estimasi diskon"
          value={formatTotal(preview.estimatedDiscount)}
          helper={`Setelah diskon ${formatTotal(preview.subtotalAfterDiscount)}`}
          tone={preview.estimatedDiscount > 0 ? 'emerald' : 'amber'}
        />
      </div>

      <div className="mt-4 grid gap-2">
        {preview.rules.map((rule) => (
          <div key={rule.key} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-xs font-semibold ring-1 ring-[#e5e7eb]">
            <div className="flex min-w-0 items-center gap-2">
              {rule.pass ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" />}
              <span className="truncate font-bold text-[#0b130c]">{rule.label}</span>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${rule.pass ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
              {getRuleDetail(rule)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default VoucherRealtimePreview;
