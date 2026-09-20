import { useTranslate } from '@/hooks/useTranslate.js';
import { describeOrderKey } from '@/utils/trackingLead.js';
import { invitesWhatsApp } from '@/utils/contactPrompt.js';
import AskAtelierButton from '@/components/storefront/AskAtelierButton.jsx';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, Search } from 'lucide-react';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { buildCourierTrackingSearchUrl, getPublicTrackingOrder } from '@/services/publicTrackingService.js';
import { formatDate } from '@/utils/formatting.js';
import { publicErrorMessage } from '@/utils/publicErrorMessage.js';

// Keys, not sentences. These are module-level constants — evaluated once, before any component exists —
// so they cannot call t(). Holding keys here and translating at render time is what lets the same order
// status read in whichever shop the buyer chose.
const steps = [
  { key: 'pending_payment', labelKey: 'track.stepReceived' },
  { key: 'paid', labelKey: 'track.stepPaid' },
  { key: 'processing', labelKey: 'track.stepPreparing' },
  { key: 'packing', labelKey: 'track.stepPacked' },
  { key: 'shipped', labelKey: 'track.stepShipped' },
  { key: 'delivered', labelKey: 'track.stepDelivered' },
];

const statusKeys = {
  pending: 'track.stepQueued',
  pending_payment: 'track.awaitingPayment',
  paid: 'track.paid',
  processing: 'track.stepPreparing',
  packing: 'track.stepPacked',
  shipped: 'track.stepShipped',
  delivered: 'track.stepDelivered',
  cancelled: 'track.cancelled',
  unpaid: 'track.unpaid',
  awaiting_payment: 'track.awaitingPayment',
  confirmed: 'track.confirmed',
};

const formatStatus = (value, t, fallback = '-') => {
  if (!value) return fallback;
  return statusKeys[value] ? t(statusKeys[value]) : String(value).replace(/_/g, ' ');
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

const PublicTrackingPage = () => {
  const { t } = useTranslate();
  const revealRef = useScrollReveal();
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [lookup, setLookup] = useState(code);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(Boolean(code));
  // Three states, not two, the same shape PaymentPage uses for orderFound: we have not looked, we
  // looked and there is nothing, or we could not look at all. Without the third, a lookup that FAILED
  // still printed "Order belum ditemukan" — a confident negative about a question that was never asked.
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState('');
  const isCancelled = order?.status === 'cancelled';
  // A cancelled order must not render as a normal in-progress timeline with a "(saat ini)" step.
  const completeCount = useMemo(() => (isCancelled ? 0 : completedStepCount(order)), [order, isCancelled]);
  const courierUrl = order?.trackingUrl || buildCourierTrackingSearchUrl(order || {});

  // useCallback with [t]: loadOrder writes a translated error message, so it changes when the shop's
  // language does. Left as a plain function it became a missing effect dependency — the same
  // exhaustive-deps warning that hid a dead code path in #159.
  const loadOrder = useCallback(async (value) => {
    const normalized = String(value || '').trim();
    if (!normalized) return;
    setLoading(true);
    setError('');
    setFailed(false);
    setSearched(true);
    try {
      const result = await getPublicTrackingOrder(normalized);
      setOrder(result);
      // No setError here. "We looked and there is no such order" is not a failure — the empty card
      // below already says it, in the right place and in the right words: the eyebrow, the heading
      // "Order belum ditemukan", and the line "Pastikan nomor order atau resi sudah benar." Setting the
      // error on top printed those same two sentences AGAIN in red underneath, so a buyer who mistyped
      // one digit was told twice, and the red made the second telling read like a different, worse
      // problem. setError belongs to the catch below, where something actually broke.
    } catch (err) {
      setOrder(null);
      setFailed(true);
      setError(publicErrorMessage(err, t("track.loadFailed")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // We looked and there is nothing. Not "we could not look".
  const foundNothing = searched && !failed;

  useEffect(() => {
    if (code) {
      setLookup(code);
      loadOrder(code);
    }
  }, [code, loadOrder]);

  const submitLookup = (event) => {
    event.preventDefault();
    const normalized = lookup.trim();
    if (!normalized) return;
    // Stay on whichever tracking route the user is already on instead of always bouncing to /track-order.
    const base = location.pathname.startsWith('/track-order') ? '/track-order' : '/track';
    navigate(`${base}/${encodeURIComponent(normalized)}`);
    if (normalized === code) {
      loadOrder(normalized);
    }
  };

  return (
    <>
      <Helmet>
        <title>{t("track.tab")}</title>
        <meta name="description" content={t("track.meta")} />
        <meta name="robots" content="noindex,follow" />
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <PublicHeader />

        <section className="cart-hero">
          <p className="editorial-eyebrow hero-animate-text hero-animate-text--d1">{t("track.eyebrow")}</p>
          <h1 className="hero-animate-text hero-animate-text--d2">{t("track.title")}</h1>
          <p className="hero-animate-text hero-animate-text--d3">{t(describeOrderKey(order))}</p>
          {/* The button appears because the SENTENCE asked for it, not because of a status picked by
              hand: whichever lead this page opens with, if it says to message us, the way to do it is
              right here rather than in the footer. */}
          {invitesWhatsApp(t(describeOrderKey(order))) ? (
            <AskAtelierButton orderNumber={order?.orderNumber} className="mt-4" />
          ) : null}
        </section>

        <section className="tracking-content" data-reveal>
          {/* Search form */}
          <form className="tracking-search" onSubmit={submitLookup}>
            <input
              type="text"
              value={lookup}
              onChange={(event) => setLookup(event.target.value)}
              placeholder={t("track.placeholderLong")}
              aria-label={t("track.placeholderShort")}
            />
            <button type="submit" disabled={loading || !lookup.trim()}>
              <Search className="h-4 w-4" />
              {loading ? t("track.searching") : t('track.submit')}
            </button>
          </form>

          {/* Timeline */}
          <div className="tracking-card">
            {order ? (
              <>
                <div className="tracking-card__header">
                  <p className="editorial-eyebrow">{t("track.statusEyebrow")}</p>
                  <h2>{order.orderNumber}</h2>
                  <span className="tracking-card__customer">{order.customerName}</span>
                </div>

                {isCancelled ? (
                  <div
                    role="status"
                    style={{ margin: '4px 0 16px', padding: '12px 16px', borderRadius: 16, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 14, fontWeight: 500 }}
                  >
                    {t('track.cancelledNotice')}
                    {invitesWhatsApp(t('track.cancelledNotice')) ? (
                      <AskAtelierButton orderNumber={order.orderNumber} className="mt-3 w-full border-[#fecaca] bg-white text-[#b91c1c]" />
                    ) : null}
                  </div>
                ) : null}

                <ol className="tracking-timeline" aria-label={t("track.progress")} aria-hidden={isCancelled ? 'true' : undefined}>
                  {steps.map((item, index) => (
                    <li
                      key={item.key}
                      className={`tracking-step${index < completeCount ? ' is-complete' : ''}`}
                      aria-current={index === completeCount - 1 ? 'step' : undefined}
                    >
                      <span className="tracking-step__dot" aria-hidden="true" />
                      <span className="tracking-step__label">{t(item.labelKey)}{index === completeCount - 1 ? t('track.current') : ''}</span>
                    </li>
                  ))}
                </ol>

                <div className="tracking-details">
                  <div className="tracking-detail-row">
                    <span>{t("track.statusTitle")}</span><strong>{formatStatus(order.status, t)}</strong>
                  </div>
                  <div className="tracking-detail-row">
                    <span>{t('track.payment')}</span><strong>{formatStatus(order.paymentStatus, t)}</strong>
                  </div>
                  <div className="tracking-detail-row">
                    <span>{t('track.shipment')}</span><strong>{formatStatus(order.shipmentStatus, t, t('track.notShipped'))}</strong>
                  </div>
                  <div className="tracking-detail-row">
                    <span>Item</span><strong>{order.itemCount || '-'}</strong>
                  </div>
                  <div className="tracking-detail-row">
                    <span>{t('track.created')}</span><strong>{order.createdAt ? formatDate(order.createdAt) : '-'}</strong>
                  </div>
                  <div className="tracking-detail-row">
                    <span>{t("track.lastUpdate")}</span><strong>{order.updatedAt ? formatDate(order.updatedAt) : '-'}</strong>
                  </div>
                  <div className="tracking-detail-row">
                    <span>{t('track.courier')}</span><strong>{order.courierName || t("track.notAvailable")}</strong>
                  </div>
                  <div className="tracking-detail-row">
                    <span>{t("track.waybill")}</span><strong>{order.trackingNumber || t("track.notAvailable")}</strong>
                  </div>
                </div>

                {courierUrl ? (
                  <a href={courierUrl} target="_blank" rel="noreferrer" className="tracking-courier-link">
                    {t('track.openCourier')} <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </>
            ) : (
              <div className="tracking-card__empty">
                {/* foundNothing, not searched: a failed lookup falls back to the neutral prompt and
                    lets the red line below carry what actually happened. */}
                <p className="editorial-eyebrow">{foundNothing ? t("track.notFoundEyebrow") : t("track.searchEyebrow")}</p>
                <h2>{foundNothing ? t("track.notFoundTitle") : t("track.enterNumber")}</h2>
                <p>{foundNothing ? t("track.checkNumber") : t("track.whereNumber")}</p>
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
