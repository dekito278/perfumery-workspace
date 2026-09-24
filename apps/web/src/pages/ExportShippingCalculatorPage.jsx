import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { AlertTriangle, ClipboardCopy, Globe2, Info, Plus, ReceiptText, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import { listExportDestinations } from '@/data/exportZones.js';
import { EXPORT_RATE_EFFECTIVE } from '@/data/exportRates.js';
import { quoteInternationalShipping } from '@/utils/exportShipping.js';
import { quoteInternationalShippingPrice, formatShippingUsd } from '@/utils/internationalShippingPrice.js';
import { shippingIncludedFor } from '@/utils/shippingRegion.js';
import { usdPriceFor, USD_PRICE_RATE } from '@/utils/usdPrice.js';
import { SHIPPING_RATE_BOTTLE_SIZE_ML, SHIPPING_RATES_EFFECTIVE_YEAR } from '@/data/internationalShippingRates.js';
import { USD_PER_RUPIAH_RATE, USD_RATE_SET_ON } from '@/utils/overseasVisitor.js';
import { filterDestinations, countMatches } from '@/utils/destinationSearch.js';
import { buildExportQuote } from '@/utils/exportQuote.js';
import { buildExportOrderData } from '@/utils/exportOrder.js';
import { buildCheckoutDraft, buildOrderNotes, INTERNATIONAL_TRANSFER_PAYMENT } from '@/services/cartService.js';
import { createOrder } from '@/services/orderService.js';
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
  const [countrySearch, setCountrySearch] = useState('');
  const [outsideDeliveryArea, setOutsideDeliveryArea] = useState(false);
  const [rows, setRows] = useState([{ key: 'line-1', slug: '', variantId: '', quantity: 6 }]);
  const [tierPrices, setTierPrices] = useState({ index: {}, schemaReady: true });
  // Writing the agreed order down. The English shop has no checkout, so this is where an international
  // sale becomes a row — with the overseas price, the shipping quoted above, and the shop it came from.
  const [buyerName, setBuyerName] = useState('');
  const [buyerContact, setBuyerContact] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerNotes, setBuyerNotes] = useState('');
  const [manualShipping, setManualShipping] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);

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

  const visibleDestinations = filterDestinations(destinations, countrySearch, countryCode);
  const destinationMatches = countMatches(destinations, countrySearch);
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
  // The carrier Dekito actually ships with, not the one whose sheet happened to be in the repo. A
  // country RaySpeed serves but whose rate nobody has measured comes back with no total at all — that is
  // deliberate, and the manual field below is the answer to it.
  const carrierQuote = quoteInternationalShipping({ countryCode, weightGram, outsideDeliveryArea });
  const quote = carrierQuote?.total ? carrierQuote : null;
  // What the buyer is CHARGED, from the published rate card — the number Dekito committed to, which the
  // carrier cost above does not decide. The card is written for 30 ml bottles, so a cart holding other
  // sizes is counted but flagged rather than quietly quoted at a price the card never covered.
  const priceCard = quoteInternationalShippingPrice({ countryCode, bottles });
  const priceCardIdr = priceCard?.usd ? Math.round(priceCard.usd * USD_PER_RUPIAH_RATE) : 0;
  const offCardSizes = [...new Set(lines
    .filter((line) => line.product && Number(line.quantity) > 0 && !String(line.size || '').startsWith(String(SHIPPING_RATE_BOTTLE_SIZE_ML)))
    .map((line) => line.size))];
  // One shipping figure for the whole page. The summary Dekito copies into WhatsApp and the order he
  // creates from it were reading two different sources, so the message quoted the carrier cost while the
  // order billed the card price — Rp 180.000 against Rp 2.227.500 for the same six bottles to Malaysia.
  //
  // And on most destinations the answer is ZERO. Every product page tells an international buyer
  // "Shipping is included", and this screen is where that buyer's order gets written down — so adding
  // shipping on top here bills them for something the shop already promised was in the price. The rule
  // is the shop's own (shippingIncludedFor), not a second opinion invented for this page.
  const typedShipping = Math.max(0, Math.round(Number(manualShipping) || 0));
  const shippingInPrice = shippingIncludedFor(countryCode);
  const shippingCharged = typedShipping || (shippingInPrice ? 0 : (priceCardIdr || Number(quote?.total) || 0));
  const shippingLabel = typedShipping
    ? 'dikutip manual'
    : (shippingInPrice
      ? 'sudah termasuk harga internasional'
      : (priceCard?.usd
        ? `${priceCard.regionLabel}, ${priceCard.tierLabel} — ${formatShippingUsd(priceCard.usd)}`
        : (quote ? `${quote.carrier === 'rayspeed' ? 'RaySpeed' : `LTU Express zona ${quote.zone}`}, ${quote.chargeableKg} kg` : '')));
  const summary = buildExportQuote({
    destinationName: destination?.name || '',
    lines,
    shipping: shippingCharged > 0 ? { total: shippingCharged, label: shippingLabel } : null,
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

  // The tariff table when the country is served; a hand-typed number when it is not, which is the only
  // way an unlisted country could be ordered from at all.

  const draftOrder = buildExportOrderData({
    lines,
    shippingTotal: shippingCharged,
    destinationName: destination?.name || '',
    customerName: buyerName,
    contact: buyerContact,
    deliveryAddress: buyerAddress,
    notes: buyerNotes,
    formatMoney: formatPrice,
  });

  const createExportOrder = async () => {
    if (!draftOrder.ok) {
      toast.error(draftOrder.reason);
      return;
    }
    setCreating(true);
    try {
      // Spread whole rather than picked apart: buildOrderPayload is an explicit whitelist, so the three
      // fields it does not know about (notesLines, shippingFee, productsSubtotal) reach nothing.
      const orderData = draftOrder.orderData;
      const { notesLines, shippingFee } = orderData;
      // The dollar figure is frozen onto the order, not recomputed when the buyer opens the link. They
      // pay into a USD account days later — sometimes a Wise transfer takes three — and the number they
      // were quoted has to be the number the payment page still asks for.
      const amountUsd = usdPriceFor(orderData.subtotal);
      const order = await createOrder({
        ...orderData,
        // The dollars AND where to send them, written onto the order together. A payment page that knows
        // the amount but hands out the BCA account is worse than one that knows neither.
        paymentResponse: amountUsd
          ? {
            amountUsd,
            currency: 'USD',
            amountIdr: orderData.subtotal,
            usdRate: USD_PRICE_RATE,
            bankName: INTERNATIONAL_TRANSFER_PAYMENT.bankName,
            swift: INTERNATIONAL_TRANSFER_PAYMENT.swift,
            accountNumber: INTERNATIONAL_TRANSFER_PAYMENT.accountNumber,
            accountName: INTERNATIONAL_TRANSFER_PAYMENT.accountName,
          }
          : undefined,
        notes: buildOrderNotes({
          deliveryAddress: orderData.deliveryAddress,
          deliveryArea: orderData.deliveryArea,
          paymentMethod: 'Transfer manual (WhatsApp)',
          shippingSummary: `Ekspor ${orderData.deliveryArea} — ${formatPrice(shippingFee)}`,
          notes: notesLines.join(' · '),
        }),
        checkoutDraft: buildCheckoutDraft({
          customerName: orderData.customerName,
          contact: orderData.contact,
          deliveryAddress: orderData.deliveryAddress,
          deliveryArea: orderData.deliveryArea,
          paymentMethod: 'Transfer manual (WhatsApp)',
          shippingSummary: `Ekspor ${orderData.deliveryArea}`,
          shippingFee,
          notes: notesLines.join('\n'),
          items: orderData.items,
        }),
      });
      setCreatedOrder(order);
      toast.success(`Order ${order.orderNumber} dibuat`, {
        description: 'Ditandai sebagai toko EN, jadi semua kabar ke pembeli otomatis berbahasa Inggris.',
      });
    } catch (error) {
      toast.error(error?.message || 'Order belum bisa dibuat.');
    } finally {
      setCreating(false);
    }
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
            {/* The list is 200-odd names and a native <select> has no search, so reaching Malaysia meant
                scrolling past a hundred countries. Typing here narrows the list below; the country
                already chosen stays in it whether it matches or not, because a <select> whose value is
                missing from its options blanks itself in some browsers and silently jumps to the first
                option in others. */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9ca3af]" />
              <input
                type="search"
                value={countrySearch}
                onChange={(event) => setCountrySearch(event.target.value)}
                className="h-10 w-full rounded-xl border border-[#e5e7eb] bg-white pl-9 pr-3 text-sm font-semibold normal-case text-[#111827] outline-none focus:border-amber-300"
                placeholder="Cari negara…"
                aria-label="Cari negara tujuan"
              />
            </div>
            <select
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value)}
              // While searching it opens into a short list, so the matches are visible without a second
              // click. An arbitrary Tailwind data- variant would have depended on how React stringifies
              // a false attribute, which is not a thing to bet a layout on.
              size={countrySearch.trim() ? Math.min(8, Math.max(2, visibleDestinations.length)) : undefined}
              className={`rounded-xl border border-[#e5e7eb] bg-white px-3 py-1 text-sm font-semibold text-[#111827] outline-none focus:border-amber-300${countrySearch.trim() ? '' : ' h-11'}`}
            >
              {visibleDestinations.map((item) => (
                <option key={item.code} value={item.code}>{item.name} — zona {item.zone}</option>
              ))}
            </select>
            {countrySearch.trim() ? (
              <span className="text-[11px] font-medium normal-case text-[#8b949e]">
                {destinationMatches
                  ? `${destinationMatches} negara cocok`
                  : `Tidak ada negara bernama “${countrySearch.trim()}” di daftar kurir`}
              </span>
            ) : null}
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

        {/* Where an international sale becomes a row. The English shop has no checkout — the order was
            agreed on WhatsApp, so it is written down here, with the overseas price and the shipping
            quoted above. Marked as the English shop, which is what makes every later message to this
            buyer come out in English instead of Indonesian. */}
        <section className="mt-4 rounded-2xl border border-[#e5e7eb] bg-white p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#111827]">
            <ReceiptText className="h-4 w-4" />Buat ordernya
          </h2>
          <p className="mt-0.5 text-xs font-medium text-[#6b7280]">
            Isi setelah pembeli setuju. Stok langsung dipotong seperti order biasa.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold uppercase text-[#6b7280]">
              Nama pembeli
              <input
                type="text"
                value={buyerName}
                onChange={(event) => setBuyerName(event.target.value)}
                className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold normal-case text-[#111827]"
                placeholder="Nama di WhatsApp"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-bold uppercase text-[#6b7280]">
              Kontak
              <input
                type="text"
                value={buyerContact}
                onChange={(event) => setBuyerContact(event.target.value)}
                className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold normal-case text-[#111827]"
                placeholder="+60… atau email"
              />
            </label>
          </div>

          <label className="mt-3 grid gap-1.5 text-xs font-bold uppercase text-[#6b7280]">
            Alamat kirim
            <textarea
              rows={3}
              value={buyerAddress}
              onChange={(event) => setBuyerAddress(event.target.value)}
              className="rounded-2xl border border-[#e5e7eb] p-3 text-sm font-semibold normal-case text-[#111827]"
              placeholder="Alamat lengkap, termasuk negara dan kode pos"
            />
          </label>

          <label className="mt-3 grid gap-1.5 text-xs font-bold uppercase text-[#6b7280]">
            Catatan (opsional)
            <input
              type="text"
              value={buyerNotes}
              onChange={(event) => setBuyerNotes(event.target.value)}
              className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold normal-case text-[#111827]"
              placeholder="Permintaan khusus, tanggal, apa pun"
            />
          </label>

          {/* Only when the tariff table has no answer. Without it an unlisted country — which is most of
              the world for this courier — could be quoted by hand but never written down. */}
          {/* Available wherever shipping is actually charged. It used to hide as soon as any rate existed,
              which took the override away exactly where it is needed most: Europe, the one region the
              price does not cover and the one where the figure gets negotiated. */}
          {shippingInPrice ? null : (
            <label className="mt-3 grid gap-1.5 text-xs font-bold uppercase text-[#6b7280]">
              {priceCard?.onRequest
                ? 'Ongkir (isi manual — kartu tarif bilang "quoted on request")'
                : (priceCard?.usd
                  ? 'Ongkir (isi manual — kosongkan untuk memakai kartu tarif)'
                  : 'Ongkir (isi manual — tarif negara ini belum diukur)')}
              <input
                type="number"
                min="0"
                value={manualShipping}
                onChange={(event) => setManualShipping(event.target.value)}
                className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold normal-case text-[#111827]"
                placeholder="0"
              />
            </label>
          )}

          <dl className="mt-3 grid gap-1.5 rounded-2xl bg-[#fbfaf7] p-3 text-sm font-semibold text-[#111827]">
            <div className="flex justify-between gap-3"><dt className="text-[#6b7280]">Produk</dt><dd>{formatPrice(draftOrder.orderData?.productsSubtotal || 0)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[#6b7280]">Ongkir</dt><dd>{formatPrice(shippingCharged)}</dd></div>
            <div className="flex justify-between gap-3 border-t border-[#efece3] pt-1.5 text-base font-bold"><dt>Ditagih</dt><dd>{formatPrice(draftOrder.orderData?.subtotal || 0)}</dd></div>
          </dl>

          {draftOrder.warnings.length ? (
            <p className="mt-3 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-relaxed text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Ditagih harga domestik: {draftOrder.warnings.join(', ')}. Ordernya tetap bisa dibuat — ini
                dicatat di catatan ordernya — tapi kalau bukan itu yang kamu mau, isi harga luar negerinya dulu.
              </span>
            </p>
          ) : null}

          <Button
            type="button"
            className="mt-3 h-11 w-full gap-2 rounded-2xl"
            onClick={createExportOrder}
            disabled={creating || !draftOrder.ok}
          >
            <ReceiptText className="h-4 w-4" />
            {creating ? 'Membuat order…' : 'Buat order (toko EN)'}
          </Button>
          {draftOrder.ok ? null : (
            <p className="mt-2 text-xs font-semibold text-[#6b7280]">{draftOrder.reason}</p>
          )}

          {createdOrder ? (
            <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold leading-relaxed text-emerald-900">
              Order <strong>{createdOrder.orderNumber}</strong> dibuat dan ditandai toko EN. Buka di daftar
              order untuk mengirim konfirmasinya — pesannya sudah berbahasa Inggris.
            </p>
          ) : null}
        </section>

        {/* The published price comes first and the carrier cost sits under it: the buyer is quoted from the
            card, and the kilo rate only says what the parcel costs us. Reading them the other way round
            is how a shop quotes its own cost price. */}
        <section className="mt-4 rounded-2xl border border-editorial-charcoal/15 bg-[#fbfaf7] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-editorial-charcoal">
            Kartu tarif {SHIPPING_RATES_EFFECTIVE_YEAR} · {shippingInPrice ? 'belum ditagih' : 'ditagih ke pembeli'}
          </p>
          {shippingInPrice ? (
            <>
              <p className="mt-1 text-3xl font-bold text-editorial-charcoal">Ongkir tidak ditagih</p>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                Halaman produk menjanjikan ongkirnya sudah termasuk harga internasional untuk tujuan ini,
                jadi ordernya ditulis tanpa ongkir.
                {priceCard?.usd ? ` Kalau nanti mulai ditagih, kartu tarifnya ${formatShippingUsd(priceCard.usd)} (${priceCard.regionLabel}, ${priceCard.tierLabel}).` : ''}
              </p>
            </>
          ) : priceCard?.usd ? (
            <>
              <p className="mt-1 text-3xl font-bold text-editorial-charcoal">{formatShippingUsd(priceCard.usd)}</p>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">
                {priceCard.regionLabel} · {priceCard.tierLabel} · {priceCard.bottles} botol · ≈ {formatPrice(priceCardIdr)}
                {' '}(kurs {USD_PER_RUPIAH_RATE.toLocaleString('id-ID')}, {USD_RATE_SET_ON})
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm font-semibold leading-relaxed text-[#6b7280]">
              {priceCard?.onRequest === 'bottles'
                ? `${priceCard.bottles} botol — di atas 6 botol kartu tarifnya minta dikutip manual. Isi ongkirnya di bawah.`
                : 'Negara ini tidak ada di kartu tarif. Kutip manual, lalu isi ongkirnya di bawah.'}
            </p>
          )}
          {offCardSizes.length ? (
            <p className="mt-2 flex gap-2 text-xs font-semibold leading-relaxed text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Kartu tarifnya ditulis untuk botol {SHIPPING_RATE_BOTTLE_SIZE_ML} ml. Di keranjang ini ada{' '}
                {offCardSizes.join(', ')} — jumlahnya tetap dihitung per botol, tapi cek dulu sebelum dikutip.
              </span>
            </p>
          ) : null}
        </section>

        {quote ? (
          <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
              {destination?.name} · {quote.carrier === 'rayspeed' ? 'RaySpeed' : `LTU zona ${quote.zone}`} · ditagih {quote.chargeableKg} kg
            </p>
            <p className="mt-1 text-3xl font-bold text-emerald-950">{formatPrice(quote.total)}</p>
            {quote.odaFee ? (
              <p className="mt-1 text-xs font-semibold text-emerald-900">
                {formatPrice(quote.baseCost)} + ODA {formatPrice(quote.odaFee)}
              </p>
            ) : null}
            {quote.estimated ? (
              <p className="mt-1 text-xs font-semibold text-emerald-900">
                Perkiraan: yang diukur baru tarif 1 kg, di atas itu dikalikan per kilo. Konfirmasi ke
                RaySpeed sebelum mengutip ke pembeli.
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
            {carrierQuote?.carrier === 'rayspeed'
              ? `RaySpeed melayani ${destination?.name || 'negara ini'}, tapi tarifnya belum pernah diukur. Cek di simulator RaySpeed lalu isi ongkirnya di bawah — jangan pakai angka LTU, itu berkali-kali lipat.`
              : 'Negara ini tidak ada di daftar tujuan ekspor kurir.'}
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
                  const row = quoteInternationalShipping({
                    countryCode,
                    weightGram: Math.round((weightGram / safeBottles) * count),
                    outsideDeliveryArea,
                  });
                  if (!row?.total) return null;
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
