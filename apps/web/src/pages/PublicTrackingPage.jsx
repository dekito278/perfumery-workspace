import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, ExternalLink, PackageCheck, Search, ShieldCheck, Truck } from 'lucide-react';
import StateBlock from '@/components/ui/state-block.jsx';
import StatusChip, { getPaymentStatusTone, getShipmentStatusTone } from '@/components/ui/status-chip.jsx';
import StorefrontHeader from '@/components/storefront/StorefrontHeader.jsx';
import {
  getOrderStatusLabels,
  getShipmentStatusLabels,
} from '@/services/orderService.js';
import {
  buildCourierTrackingSearchUrl,
  getPublicTrackingOrder,
} from '@/services/publicTrackingService.js';

const formatDate = (value) => (value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-');

const orderStatusLabels = getOrderStatusLabels();
const shipmentStatusLabels = getShipmentStatusLabels();
const paymentStatusLabels = {
  unpaid: 'Belum dibayar',
  pending: 'Menunggu bayar',
  paid: 'Sudah dibayar',
  failed: 'Gagal',
  expired: 'Kedaluwarsa',
  refunded: 'Refund',
};

const progressSteps = [
  { key: 'paid', label: 'Order valid' },
  { key: 'packing', label: 'Dikemas' },
  { key: 'shipped', label: 'Dikirim' },
  { key: 'delivered', label: 'Terkirim' },
];

const getProgressIndex = (order) => {
  if (!order || order.status === 'cancelled') return -1;
  if (order.shipmentStatus === 'delivered' || order.status === 'completed') return 3;
  if (order.shipmentStatus === 'shipped' || order.status === 'shipped') return 2;
  if (order.shipmentStatus === 'packing' || order.status === 'processing') return 1;
  if (order.paymentStatus === 'paid' || ['paid', 'processing'].includes(order.status)) return 0;
  return -1;
};

const TrackingTimeline = ({ order }) => {
  const activeIndex = getProgressIndex(order);

  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {progressSteps.map((step, index) => {
        const done = activeIndex >= index;
        return (
          <div key={step.key} className={`rounded-2xl border px-3 py-3 ${done ? 'border-[#263d27]/20 bg-[#eef2e8] text-[#263d27]' : 'border-stone-200 bg-white text-stone-500'}`}>
            <div className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${done ? 'bg-[#263d27] text-white' : 'bg-stone-200 text-stone-600'}`}>
              {index + 1}
            </div>
            <div className="mt-2 text-xs font-bold">{step.label}</div>
          </div>
        );
      })}
    </div>
  );
};

const DetailRow = ({ label, value }) => (
  <div className="rounded-2xl bg-white px-4 py-3">
    <div className="text-[10px] font-bold uppercase text-[#6b7280]">{label}</div>
    <div className="mt-1 break-words text-sm font-bold text-[#0b130c]">{value || '-'}</div>
  </div>
);

const PublicTrackingPage = () => {
  const { code = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialLookup = code || searchParams.get('q') || '';
  const [lookup, setLookup] = useState(initialLookup);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(Boolean(initialLookup));
  const [searched, setSearched] = useState(Boolean(initialLookup));
  const [error, setError] = useState('');

  useEffect(() => {
    setLookup(initialLookup);
  }, [initialLookup]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!initialLookup) {
        setLoading(false);
        setOrder(null);
        setSearched(false);
        setError('');
        return;
      }
      setLoading(true);
      setSearched(true);
      setError('');
      try {
        const result = await getPublicTrackingOrder(initialLookup);
        if (!active) return;
        setOrder(result);
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || 'Tracking gagal dimuat');
        setOrder(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [initialLookup]);

  const pageTitle = useMemo(() => (
    order?.orderNumber ? `Tracking ${order.orderNumber}` : 'Cek Tracking Order'
  ), [order?.orderNumber]);
  const courierSearchUrl = useMemo(() => (
    buildCourierTrackingSearchUrl({
      courierName: order?.courierName,
      trackingNumber: order?.trackingNumber,
    })
  ), [order?.courierName, order?.trackingNumber]);

  const submitLookup = (event) => {
    event.preventDefault();
    const normalized = lookup.trim();
    if (!normalized) return;
    navigate(`/track/${encodeURIComponent(normalized)}`);
  };

  return (
    <div className="min-h-screen bg-[#f7f8f2] text-[#0b130c]">
      <Helmet>
        <title>{pageTitle} | Solivagant</title>
      </Helmet>
      <StorefrontHeader backTo="/home" backLabel="Beranda" actions={[{ to: '/catalog', label: 'Katalog' }]} />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        <section className="rounded-[28px] border border-[#dfe5d8] bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#263d27]/15 bg-[#eef2e8] px-3 py-1 text-[10px] font-bold uppercase text-[#263d27]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Tracking publik
              </div>
              <h1 className="mt-4 text-3xl font-bold sm:text-5xl">Cek order atau resi</h1>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#5b6658]">
                Masukkan kode internal DKT atau nomor resi kurir untuk melihat status pengiriman tanpa membuka Studio.
              </p>
            </div>

            <form onSubmit={submitLookup} className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-md">
              <label htmlFor="tracking-lookup" className="sr-only">Kode DKT atau resi kurir</label>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
                <input
                  id="tracking-lookup"
                  value={lookup}
                  onChange={(event) => setLookup(event.target.value)}
                  placeholder="DKT-MPCRU98H atau resi kurir"
                  className="h-12 w-full rounded-2xl border border-[#dfe5d8] bg-[#fbfaf7] pl-10 pr-4 text-sm font-bold outline-none transition focus:border-[#263d27] focus:bg-white"
                />
              </div>
              <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#263d27] px-5 text-sm font-bold text-[#eef2e8]">
                Cek
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>

        <section className="mt-6">
          {loading ? (
            <StateBlock tone="loading" title="Mengecek tracking" description="Sebentar, sistem sedang mencari kode order atau nomor resi." />
          ) : error ? (
            <StateBlock tone="error" title="Tracking gagal dimuat" description={error} />
          ) : order ? (
            <div className="overflow-hidden rounded-[28px] border border-[#dfe5d8] bg-[#fbfaf7] shadow-sm">
              <div className="border-b border-[#dfe5d8] bg-[#0b130c] p-5 text-[#eef2e8] sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#cfd8cc]">Kode internal</div>
                    <h2 className="mt-1 break-all text-3xl font-bold">{order.orderNumber}</h2>
                    <p className="mt-2 text-xs font-semibold text-[#cfd8cc]">
                      Update terakhir {formatDate(order.updatedAt || order.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <StatusChip tone={getPaymentStatusTone(order.paymentStatus)}>
                      {paymentStatusLabels[order.paymentStatus] || order.paymentStatus}
                    </StatusChip>
                    <StatusChip icon={Truck} tone={getShipmentStatusTone(order.shipmentStatus)}>
                      {shipmentStatusLabels[order.shipmentStatus] || order.shipmentStatus || 'Belum dikirim'}
                    </StatusChip>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 p-5 sm:p-7">
                <TrackingTimeline order={order} />

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <DetailRow label="Customer" value={order.customerName} />
                  <DetailRow label="Kurir" value={order.courierName || 'Belum ditentukan'} />
                  <DetailRow label="Nomor resi kurir" value={order.trackingNumber || 'Belum tersedia'} />
                  <DetailRow label="Isi order" value={order.itemCount ? `${order.itemCount} item` : 'Order Solivagant'} />
                </div>

                <div className="rounded-2xl border border-[#dfe5d8] bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
                      <PackageCheck className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-[#0b130c]">{orderStatusLabels[order.status] || order.status || 'Order tercatat'}</div>
                      <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                        Kode DKT adalah referensi internal Solivagant. Jika paket sudah masuk ekspedisi, gunakan nomor resi kurir atau tombol tracking kurir.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {order.trackingUrl && order.trackingNumber ? (
                          <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#263d27] px-4 text-xs font-bold text-[#eef2e8]">
                            <ExternalLink className="h-4 w-4" />
                            Buka tracking kurir
                          </a>
                        ) : null}
                        {!order.trackingUrl && courierSearchUrl ? (
                          <a href={courierSearchUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#263d27] px-4 text-xs font-bold text-[#eef2e8]">
                            <ExternalLink className="h-4 w-4" />
                            Cari resi kurir
                          </a>
                        ) : null}
                        <Link to="/track" className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#263d27]/15 bg-white px-4 text-xs font-bold text-[#263d27]">
                          Cek kode lain
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : searched ? (
            <StateBlock tone="empty" title="Tracking tidak ditemukan" description="Pastikan kode DKT atau nomor resi kurir sudah benar, lalu coba lagi." />
          ) : (
            <StateBlock tone="empty" title="Masukkan kode tracking" description="Kode DKT bisa dipakai untuk cek internal, sementara nomor resi kurir dipakai setelah pengiriman dibuat." />
          )}
        </section>
      </main>
    </div>
  );
};

export default PublicTrackingPage;
