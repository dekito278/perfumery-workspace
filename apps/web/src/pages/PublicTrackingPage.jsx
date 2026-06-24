import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, Search } from 'lucide-react';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { buildCourierTrackingSearchUrl, getPublicTrackingOrder } from '@/services/publicTrackingService.js';
import { formatDate } from '@/utils/formatting.js';

const steps = [
  { key: 'pending_payment', label: 'Order diterima' },
  { key: 'paid', label: 'Pembayaran dikonfirmasi' },
  { key: 'processing', label: 'Sedang disiapkan' },
  { key: 'packing', label: 'Dikemas' },
  { key: 'shipped', label: 'Dikirim' },
  { key: 'delivered', label: 'Diterima' },
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
  const revealRef = useScrollReveal();
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
        <title>Lacak Pesanan - SOLIVAGANT</title>
        <meta name="description" content="Lacak status pesanan SOLIVAGANT." />
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <PublicHeader />

        <section className="cart-hero">
          <p className="editorial-eyebrow hero-animate-text hero-animate-text--d1">LACAK PESANAN</p>
          <h1 className="hero-animate-text hero-animate-text--d2">Lacak Pesanan</h1>
          <p className="hero-animate-text hero-animate-text--d3">{describeOrder(order)}</p>
        </section>

        <section className="tracking-content" data-reveal>
          {/* Search form */}
          <form className="tracking-search" onSubmit={submitLookup}>
            <input
              type="text"
              value={lookup}
              onChange={(event) => setLookup(event.target.value)}
              placeholder="Nomor order (DKT-XXXXX) atau nomor resi"
            />
            <button type="submit" disabled={loading || !lookup.trim()}>
              <Search className="h-4 w-4" />
              {loading ? 'Mencari...' : 'Lacak'}
            </button>
          </form>

          {/* Timeline */}
          <div className="tracking-card">
            {order ? (
              <>
                <div className="tracking-card__header">
                  <p className="editorial-eyebrow">STATUS PESANAN</p>
                  <h2>{order.orderNumber}</h2>
                  <span className="tracking-card__customer">{order.customerName}</span>
                </div>

                <div className="tracking-timeline">
                  {steps.map((item, index) => (
                    <div key={item.key} className={`tracking-step${index < completeCount ? ' is-complete' : ''}`}>
                      <span className="tracking-step__dot" />
                      <span className="tracking-step__label">{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="tracking-details">
                  <div className="tracking-detail-row">
                    <span>Status order</span><strong>{formatStatus(order.status)}</strong>
                  </div>
                  <div className="tracking-detail-row">
                    <span>Pembayaran</span><strong>{formatStatus(order.paymentStatus)}</strong>
                  </div>
                  <div className="tracking-detail-row">
                    <span>Pengiriman</span><strong>{formatStatus(order.shipmentStatus, 'Belum dikirim')}</strong>
                  </div>
                  <div className="tracking-detail-row">
                    <span>Item</span><strong>{order.itemCount || '-'}</strong>
                  </div>
                  <div className="tracking-detail-row">
                    <span>Dibuat</span><strong>{order.createdAt ? formatDate(order.createdAt) : '-'}</strong>
                  </div>
                  <div className="tracking-detail-row">
                    <span>Update terakhir</span><strong>{order.updatedAt ? formatDate(order.updatedAt) : '-'}</strong>
                  </div>
                  <div className="tracking-detail-row">
                    <span>Kurir</span><strong>{order.courierName || 'Belum tersedia'}</strong>
                  </div>
                  <div className="tracking-detail-row">
                    <span>Nomor resi</span><strong>{order.trackingNumber || 'Belum tersedia'}</strong>
                  </div>
                </div>

                {courierUrl ? (
                  <a href={courierUrl} target="_blank" rel="noreferrer" className="tracking-courier-link">
                    Buka tracking kurir <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </>
            ) : (
              <div className="tracking-card__empty">
                <p className="editorial-eyebrow">{searched ? 'TIDAK DITEMUKAN' : 'CARI PESANAN'}</p>
                <h2>{searched ? 'Order belum ditemukan' : 'Masukkan nomor order'}</h2>
                <p>{searched ? 'Pastikan nomor order atau resi sudah benar.' : 'Gunakan nomor order dari halaman pembayaran atau nomor resi.'}</p>
              </div>
            )}
            {error ? <p className="checkout-notice is-error" style={{ marginTop: '16px' }}>{error}</p> : null}
          </div>
        </section>

        <StorefrontFooter />
      </main>
    </>
  );
};

export default PublicTrackingPage;
