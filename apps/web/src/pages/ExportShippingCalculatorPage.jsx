import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { AlertTriangle, ClipboardCopy, Globe2, Info, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import { listExportDestinations } from '@/data/exportZones.js';
import { EXPORT_RATE_EFFECTIVE } from '@/data/exportRates.js';
import { quoteExportShipping } from '@/utils/exportShipping.js';
import { buildExportQuote } from '@/utils/exportQuote.js';
import { formatPrice } from '@/utils/pricingUtils.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { getTierPricesFor } from '@/services/tierPricingService.js';
import { resolveTierPrice, tierPricesForLine, OVERSEAS_TIER } from '@/utils/tierPrice.js';
import { copyTextToClipboard } from '@/utils/clipboard.js';
import { itemWeightGram, isWeighedSize, DEFAULT_ITEM_WEIGHT_GRAM } from '@/utils/itemWeight.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';

// One component behind both the desktop and the mobile route. The two-copy habit in this repo is where
// five separate fixes went to one side and not the other; a page this small has no reason to repeat it.
const FALLBACK_GRAM = Number(import.meta.env.VITE_DEFAULT_ITEM_WEIGHT_GRAM || DEFAULT_ITEM_WEIGHT_GRAM);
const COMPARE_QUANTITIES = [1, 3, 6, 12, 24];

const ExportShippingCalculatorPage = ({ mobile = false }) => {
  const destinations = useMemo(() => listExportDestinations(), []);
  const catalog = useCatalogProducts();
  const [countryCode, setCountryCode] = useState('MY');
  const [outsideDeliveryArea, setOutsideDeliveryArea] = useState(false);
  const [rows, setRows] = useState([{ key: 'line-1', slug: '', variantId: '', quantity: 6 }]);
  const [tierPrices, setTierPrices] = useState({ index: {}, schemaReady: true });

  // Overseas prices come from the same RPC the storefront uses; overseas is public by design, so this
  // needs no special admin read. A missing schema is loud HERE — quoting an overseas buyer the domestic
  // price is the exact mistake the overseas tier exists to prevent.
  useEffect(() => {
    let mounted = true;
    getTierPricesFor().then((result) => { if (mounted) setTierPrices(result); });
    return () => { mounted = false; };
  }, []);

  const products = useMemo(() => catalog.filter(isProductVisibleInStorefront), [catalog]);

  const lines = useMemo(() => rows.map((row) => {
    const product = products.find((item) => item.slug === row.slug);
    const variants = product?.variants || [];
    const variant = variants.find((item) => (item.id || item.size) === row.variantId) || variants[0] || null;
    const retailPrice = Number(variant?.priceNumber || product?.priceNumber || 0);
    const forLine = tierPricesForLine(tierPrices.index, row.slug, variant?.id || '');
    return {
      ...row,
      product,
      variant,
      retailPrice,
      overseasPriceSet: Number(forLine[OVERSEAS_TIER] || 0) > 0,
      unitPrice: resolveTierPrice({ retailPrice, tierPrices: forLine, overseas: true }),
      name: product?.name || '',
      size: variant?.size || product?.size || '',
      weightGram: itemWeightGram(variant?.size || product?.size || '', FALLBACK_GRAM),
      weighedSize: isWeighedSize(variant?.size || product?.size || ''),
    };
  }), [rows, products, tierPrices.index]);

  const destination = destinations.find((item) => item.code === countryCode);
  const bottles = lines.reduce((sum, line) => sum + Math.max(0, Math.round(Number(line.quantity) || 0)), 0);
  const safeBottles = Math.max(1, bottles);
  // Per size: a 10 ml is 100 g and a 100 ml is 650 g. Export brackets are steep, so assuming 300 g for
  // everything was worst exactly where it cost the most.
  const chosenWeightGram = lines.reduce(
    (sum, line) => sum + Math.max(0, Math.round(Number(line.quantity) || 0)) * line.weightGram, 0,
  );
  // The fallback stands in for an empty form only. Using it as a minimum would quote one 10 ml bottle at
  // 300 g and push it into a dearer bracket than it belongs in.
  const weightGram = chosenWeightGram > 0 ? chosenWeightGram : FALLBACK_GRAM;
  const unweighedSizes = [...new Set(lines
    .filter((line) => line.product && Number(line.quantity) > 0 && !line.weighedSize)
    .map((line) => line.size))];
  const quote = quoteExportShipping({ countryCode, weightGram, outsideDeliveryArea });
  const summary = buildExportQuote({
    destinationName: destination?.name || '',
    lines,
    shipping: quote,
    formatMoney: formatPrice,
  });

  const updateRow = (key, patch) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const addRow = () => setRows((current) => [...current, { key: `line-${Date.now()}`, slug: '', variantId: '', quantity: 1 }]);
  const removeRow = (key) => setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));

  const copySummary = async () => {
    if (!summary.message) {
      toast.error('Pilih produk dan jumlahnya dulu.');
      return;
    }
    const copied = await copyTextToClipboard(summary.message);
    copied ? toast.success('Ringkasan disalin') : toast.error('Belum bisa disalin. Blok teksnya lalu salin manual.');
  };

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

          <div className="grid content-start gap-1.5 text-xs font-bold uppercase text-[#6b7280]">
            Berat kiriman
            <p className="h-11 content-center rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-3 text-sm font-semibold normal-case text-[#111827]">
              {bottles} botol — {(weightGram / 1000).toFixed(2)} kg
            </p>
            <span className="text-[11px] font-medium normal-case text-[#8b949e]">
              Berat per ukuran: 10 ml 100 g, 30 ml 250 g, 50 ml 350 g, 100 ml 650 g.
              {unweighedSizes.length ? ` Ukuran ${unweighedSizes.join(', ')} belum ditimbang — dipakai ${FALLBACK_GRAM} g.` : ''}
            </span>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-[#374151] sm:col-span-2">
            <input
              type="checkbox"
              checked={outsideDeliveryArea}
              onChange={(event) => setOutsideDeliveryArea(event.target.checked)}
            />
            Alamat di luar jangkauan normal (ODA) — tambah {formatPrice(390000)}
          </label>
        </section>

        <section className="mt-4 rounded-2xl border border-[#e5e7eb] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#111827]">Produk yang ditanyakan</h2>
              <p className="mt-0.5 text-xs font-medium text-[#6b7280]">
                Harga luar negeri dipakai kalau sudah diisi di produknya; kalau belum, yang terpakai harga
                domestik dan barisnya ditandai.
              </p>
            </div>
            <Button type="button" variant="outline" className="h-10 gap-1 rounded-2xl bg-white px-3 text-xs" onClick={addRow}>
              <Plus className="h-4 w-4" />Baris
            </Button>
          </div>

          {!tierPrices.schemaReady ? (
            <div role="alert" className="mt-3 flex gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p className="text-xs font-semibold text-amber-900">
                Tabel harga bertingkat belum ada — jalankan migrasi
                <code className="mx-1 rounded bg-white/70 px-1">20260913090000_customer_tiers_and_tier_prices.sql</code>
                dulu. Sampai itu jalan, semua baris di bawah memakai harga domestik.
              </p>
            </div>
          ) : null}

          <div className="mt-3 grid gap-2">
            {lines.map((line) => (
              <div key={line.key} className={`grid gap-2 rounded-2xl border bg-white p-3 ${mobile ? '' : 'sm:grid-cols-[1.6fr_1fr_0.6fr_auto]'}`}>
                <select
                  aria-label="Produk"
                  value={line.slug}
                  onChange={(event) => updateRow(line.key, { slug: event.target.value, variantId: '' })}
                  className="h-10 rounded-xl border border-[#e5e7eb] bg-white px-2 text-sm font-semibold outline-none focus:border-amber-300"
                >
                  <option value="">Pilih produk</option>
                  {products.map((product) => <option key={product.slug} value={product.slug}>{product.name}</option>)}
                </select>
                <select
                  aria-label="Ukuran"
                  value={line.variantId || line.variant?.id || ''}
                  onChange={(event) => updateRow(line.key, { variantId: event.target.value })}
                  disabled={!line.product}
                  className="h-10 rounded-xl border border-[#e5e7eb] bg-white px-2 text-sm font-semibold outline-none focus:border-amber-300 disabled:bg-[#f3f1ec]"
                >
                  {(line.product?.variants || []).map((variant) => (
                    <option key={variant.id || variant.size} value={variant.id || variant.size}>{variant.size}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="1"
                  aria-label="Jumlah"
                  value={line.quantity}
                  onChange={(event) => updateRow(line.key, { quantity: event.target.value })}
                  className="h-10 rounded-xl border border-[#e5e7eb] px-2 text-sm font-semibold outline-none focus:border-amber-300"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#111827]">
                    {line.product ? formatPrice(line.unitPrice) : '—'}
                    {line.product && !line.overseasPriceSet ? (
                      <span className="ml-1 text-[10px] font-bold uppercase text-amber-700">domestik</span>
                    ) : null}
                  </span>
                  <Button
                    type="button" size="icon" variant="outline" aria-label="Hapus baris"
                    className="h-10 w-10 shrink-0 rounded-xl border-rose-200 bg-rose-50 text-rose-700"
                    onClick={() => removeRow(line.key)} disabled={lines.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {summary.withoutOverseasPrice.length ? (
            <p role="alert" className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
              Belum punya harga luar negeri: {summary.withoutOverseasPrice.join(', ')}. Kutipannya memakai
              harga domestik — isi harga luar negerinya di Studio produk kalau itu bukan yang kamu mau.
            </p>
          ) : null}
        </section>

        <section className="mt-4 rounded-2xl border border-[#e5e7eb] bg-white p-4">
          <h2 className="text-sm font-bold text-[#111827]">Kutipan untuk pembeli</h2>
          <dl className="mt-3 grid gap-1.5 text-sm font-semibold text-[#111827]">
            <div className="flex justify-between gap-3"><dt className="text-[#6b7280]">Subtotal produk</dt><dd>{formatPrice(summary.subtotal)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[#6b7280]">Ongkir</dt><dd>{quote ? formatPrice(summary.shippingTotal) : 'belum ada tarif'}</dd></div>
            <div className="flex justify-between gap-3 border-t border-[#f3f4f6] pt-1.5 text-base font-bold"><dt>Total</dt><dd>{formatPrice(summary.total)}</dd></div>
          </dl>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] p-3 text-xs font-medium leading-relaxed text-[#374151]">
            {summary.message || 'Pilih produk dan jumlahnya untuk membuat ringkasan.'}
          </pre>
          <Button type="button" className="mt-3 h-11 w-full gap-2 rounded-2xl" onClick={copySummary} disabled={!summary.message}>
            <ClipboardCopy className="h-4 w-4" />Salin ringkasan
          </Button>
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
                  // Scaled from the mix actually chosen, so the comparison uses the same bottles rather
                  // than an imaginary average one.
                  const row = quoteExportShipping({
                    countryCode,
                    weightGram: Math.round((weightGram / safeBottles) * count),
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
