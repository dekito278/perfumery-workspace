import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, Search } from 'lucide-react';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import { buildCourierTrackingSearchUrl, getPublicTrackingOrder } from '@/services/publicTrackingService.js';
import { formatDate } from '@/utils/formatting.js';

const steps = [
  { key: 'pending_payment', label: 'Order received' },
  { key: 'paid', label: 'Payment confirmed' },
  { key: 'processing', label: 'In preparation' },
  { key: 'packing', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];

const statusLabels = {
  pending: 'Menunggu proses',
  pending_payment: 'Menunggu pembayaran',
  paid: 'Pembayaran diterima',
  processing: 'Sedang disiapkan',
  packing: 'Dikemas',
  shipped: 'Dikirim',
  delivered: 'Diterima',
  cancelled: 'Dibatalkan',
  unpaid: 'Belum dibayar',
  awaiting_payment: 'Menunggu pembayaran',
  confirmed: 'Terkonfirmasi',
};

const formatStatus = (value, fallback = '-') => {
  if (!value) return fallback;
  return statusLabels[value] || String(value).replace(/_/g, ' ');
};

const completedStepCount = (order) => {
  if (!order) return 0;
  if (order.deliveredAt || order.shipmentStatus === 'delivered') return 6;
  if (order.shippedAt || order.shipmentStatus === 'shipped' || order.status === 'shipped') return 5;
  if (order.shipmentStatus === 'packing') return 4;
  if (order.status === 'processing') return 3;
  if (order.paymentStatus === 'paid' || order.status === 'paid') return 2;
  return 1;
};

const describeOrder = (order) => {
  if (!order) return 'Masukkan nomor order atau resi untuk melihat progres pesanan.';
  if (order.deliveredAt || order.shipmentStatus === 'delivered') return 'Paket sudah diterima. Terima kasih sudah memesan SOLIVAGANT.';
  if (order.shippedAt || order.shipmentStatus === 'shipped') return 'Paket sudah dikirim. Resi tersedia di bawah.';
  if (order.status === 'processing' || order.shipmentStatus === 'packing') return 'Pesanan sedang disiapkan atelier.';
  if (order.paymentStatus === 'paid' || order.status === 'paid') return 'Pembayaran sudah dikonfirmasi dan pesanan masuk antrean proses.';
  return 'Pesanan tercatat. Kami menunggu konfirmasi pembayaran.';
};

const PublicTrackingPage = () => {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const [lookup, setLookup] = useState(code);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(Boolean(code));
  const [error, setError] = useState('');
  const completeCount = useMemo(() => completedStepCount(order), [order]);
  const courierUrl = order?.trackingUrl || buildCourierTrackingSearchUrl(order || {});

  const loadOrder = async (value) => {
    const normalized = String(value || '').trim();
    if (!normalized) return;
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const result = await getPublicTrackingOrder(normalized);
      setOrder(result);
      if (!result) {
        setError('Order belum ditemukan. Pastikan nomor order atau resi sudah benar.');
      }
    } catch (err) {
      setOrder(null);
      setError(err.message || 'Gagal memuat tracking order.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (code) {
      setLookup(code);
      loadOrder(code);
    }
  }, [code]);

  const submitLookup = (event) => {
    event.preventDefault();
    const normalized = lookup.trim();
    if (!normalized) return;
    navigate(`/track-order/${encodeURIComponent(normalized)}`);
    if (normalized === code) {
      loadOrder(normalized);
    }
  };

  return (
    <>
      <Helmet>
        <title>Track Your Order - SOLIVAGANT</title>
        <meta name="description" content="Customer-facing SOLIVAGANT order tracking." />
      </Helmet>

      <main className="solivagant-editorial-home">
        <PublicHeader />

        <section className="editorial-page-hero editorial-page-hero--split editorial-page-hero--compact">
          <div>
            <p className="editorial-eyebrow">CUSTOMER ORDER TRACKING</p>
            <h1>Track Your Order</h1>
            <p>{describeOrder(order)}</p>
          </div>
          <form className="editorial-form editorial-form--compact" onSubmit={submitLookup}>
            <label>
              Order number / resi
              <input
                type="text"
                value={lookup}
                onChange={(event) => setLookup(event.target.value)}
                placeholder="DKT-XXXXX atau nomor resi"
              />
            </label>
            <button type="submit" className="editorial-button editorial-button--primary" disabled={loading || !lookup.trim()}>
              <Search className="h-4 w-4" />
              {loading ? 'Checking...' : 'Track Order'}
            </button>
          </form>
        </section>

        <section className="editorial-section editorial-section--compact">
          <div className="editorial-tracking-preview editorial-tracking-preview--wide">
            <p className="editorial-eyebrow">{order ? 'PUBLIC ORDER STATUS' : 'ORDER LOOKUP'}</p>
            <h2>{order ? `${order.orderNumber} / ${order.customerName}` : (searched ? 'Order not found yet.' : 'Masukkan nomor order untuk mulai.')}</h2>
            {!order && !searched ? (
              <p className="editorial-notice">Gunakan nomor order dari halaman pembayaran atau nomor resi yang diberikan setelah pengiriman.</p>
            ) : null}
            <div className="editorial-timeline">
              {steps.map((item, index) => (
                <span key={item.key} className={index < completeCount ? 'is-complete' : ''}>{item.label}</span>
              ))}
            </div>
            {error ? <p className="editorial-form-error">{error}</p> : null}
            {order ? (
              <div className="editorial-checkout-fields">
                <span>Status order: {formatStatus(order.status)}</span>
                <span>Status pembayaran: {formatStatus(order.paymentStatus)}</span>
                <span>Status pengiriman: {formatStatus(order.shipmentStatus, 'Belum dikirim')}</span>
                <span>Item: {order.itemCount || '-'}</span>
                <span>Dibuat: {order.createdAt ? formatDate(order.createdAt) : '-'}</span>
                <span>Update: {order.updatedAt ? formatDate(order.updatedAt) : '-'}</span>
                <span>Kurir: {order.courierName || 'Belum tersedia'}</span>
                <span>Resi: {order.trackingNumber || 'Belum tersedia'}</span>
              </div>
            ) : null}
            {courierUrl ? (
              <a href={courierUrl} target="_blank" rel="noreferrer" className="editorial-button editorial-button--primary">
                Open courier tracking
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </section>

        <footer className="editorial-footer">
          <span>SOLIVAGANT by Dekito</span>
          <Link to="/cart">View Cart</Link>
        </footer>
      </main>
    </>
  );
};

export default PublicTrackingPage;
