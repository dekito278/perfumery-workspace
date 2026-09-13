import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Globe2, Info } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import { listExportDestinations } from '@/data/exportZones.js';
import { EXPORT_RATE_EFFECTIVE } from '@/data/exportRates.js';
import { quoteExportShipping } from '@/utils/exportShipping.js';
import { formatPrice } from '@/utils/pricingUtils.js';

// One component behind both the desktop and the mobile route. The two-copy habit in this repo is where
// five separate fixes went to one side and not the other; a page this small has no reason to repeat it.
const GRAM_PER_BOTTLE = Number(import.meta.env.VITE_DEFAULT_ITEM_WEIGHT_GRAM || 300);
const COMPARE_QUANTITIES = [1, 3, 6, 12, 24];

const ExportShippingCalculatorPage = ({ mobile = false }) => {
  const destinations = useMemo(() => listExportDestinations(), []);
  const [countryCode, setCountryCode] = useState('MY');
  const [bottles, setBottles] = useState(6);
  const [outsideDeliveryArea, setOutsideDeliveryArea] = useState(false);

  const safeBottles = Math.max(1, Math.round(Number(bottles) || 1));
  const quote = quoteExportShipping({
    countryCode,
    weightGram: safeBottles * GRAM_PER_BOTTLE,
    outsideDeliveryArea,
  });
  const destination = destinations.find((item) => item.code === countryCode);

  const Layout = mobile ? MobileAuthenticatedLayout : AuthenticatedLayout;

  return (
    <Layout>
      <Helmet><title>Ongkir Ekspor - SOLIVAGANT Studio</title></Helmet>

      <main className={mobile ? 'mobile-page space-y-4 pb-10' : 'mx-auto max-w-3xl px-4 py-8 sm:px-6'}>
        <header className="space-y-1">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#6b7280]">
            <Globe2 className="h-4 w-4" /> Ongkir ekspor
          </p>
          <h1 className="text-2xl font-bold text-[#111827]">Hitung ongkir ke luar negeri</h1>
          <p className="text-sm font-medium text-[#6b7280]">
            Tarif LTU Express, berlaku {EXPORT_RATE_EFFECTIVE}. Dipakai untuk menjawab pertanyaan pembeli
            sebelum ordernya dibuat.
          </p>
        </header>

        <section className="mt-5 grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-bold uppercase text-[#6b7280]">
            Negara tujuan
            <select
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value)}
              className="h-11 rounded-xl border border-[#e5e7eb] bg-white px-3 text-sm font-semibold text-[#111827] outline-none focus:border-amber-300"
            >
              {destinations.map((item) => (
                <option key={item.code} value={item.code}>{item.name} — zona {item.zone}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-xs font-bold uppercase text-[#6b7280]">
            Jumlah botol
            <input
              type="number"
              min="1"
              step="1"
              value={bottles}
              onChange={(event) => setBottles(event.target.value)}
              className="h-11 rounded-xl border border-[#e5e7eb] px-3 text-sm font-semibold text-[#111827] outline-none focus:border-amber-300"
            />
            <span className="text-[11px] font-medium normal-case text-[#8b949e]">
              {GRAM_PER_BOTTLE} gram per botol — {(safeBottles * GRAM_PER_BOTTLE / 1000).toFixed(1)} kg
            </span>
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold text-[#374151] sm:col-span-2">
            <input
              type="checkbox"
              checked={outsideDeliveryArea}
              onChange={(event) => setOutsideDeliveryArea(event.target.checked)}
            />
            Alamat di luar jangkauan normal (ODA) — tambah {formatPrice(390000)}
          </label>
        </section>

        {quote ? (
          <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
              {destination?.name} · zona {quote.zone} · ditagih {quote.chargeableKg} kg
            </p>
            <p className="mt-1 text-3xl font-bold text-emerald-950">{formatPrice(quote.total)}</p>
            {quote.odaFee ? (
              <p className="mt-1 text-xs font-semibold text-emerald-900">
                {formatPrice(quote.baseCost)} + ODA {formatPrice(quote.odaFee)}
              </p>
            ) : null}
            {quote.overThirtyKg ? (
              <p className="mt-1 text-xs font-semibold text-emerald-900">
                Di atas 30 kg — tarif flat per kg, dibulatkan ke {quote.chargeableKg} kg.
              </p>
            ) : null}
          </section>
        ) : (
          <section className="mt-4 rounded-2xl border border-dashed border-[#d8d5ca] bg-white p-4 text-sm font-semibold text-[#6b7280]">
            Negara ini tidak ada di daftar tujuan ekspor kurir.
          </section>
        )}

        <section className="mt-4 rounded-2xl border border-[#e5e7eb] bg-white p-4">
          <h2 className="text-sm font-bold text-[#111827]">Kalau dikirim sekaligus</h2>
          <p className="mt-0.5 text-xs font-medium text-[#6b7280]">
            Ongkir per botol turun tajam dengan jumlah. Berguna saat menawar ke pembeli.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead>
                <tr className="text-[11px] font-bold uppercase text-[#6b7280]">
                  <th className="py-1.5">Jumlah</th>
                  <th className="py-1.5">Total ongkir</th>
                  <th className="py-1.5">Per botol</th>
                </tr>
              </thead>
              <tbody className="font-semibold text-[#111827]">
                {COMPARE_QUANTITIES.map((count) => {
                  const row = quoteExportShipping({
                    countryCode,
                    weightGram: count * GRAM_PER_BOTTLE,
                    outsideDeliveryArea,
                  });
                  if (!row) return null;
                  return (
                    <tr key={count} className="border-t border-[#f3f4f6]">
                      <td className="py-1.5">{count} botol</td>
                      <td className="py-1.5">{formatPrice(row.total)}</td>
                      <td className="py-1.5">{formatPrice(row.total / count)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-4 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-relaxed text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Belum termasuk pajak masuk di negara tujuan, yang ditagih ke penerima saat barang tiba.
            Juga belum termasuk biaya packing, dan jendela pengiriman premium. Untuk parfum, pastikan
            status Dangerous Good sudah dikonfirmasi ke kurir.
          </span>
        </section>
      </main>
    </Layout>
  );
};

export default ExportShippingCalculatorPage;
