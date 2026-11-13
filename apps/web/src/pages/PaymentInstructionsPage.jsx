import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import { findOrderByPaymentToken } from '@/services/paymentLinkService.js';
import { paymentAmountUsd } from '@/utils/internationalOrder.js';
import { submitOrderPaymentProof } from '@/services/orderService.js';
import { uploadPaymentProof } from '@/services/paymentProofStorageService.js';
import AskAtelierButton from '@/components/storefront/AskAtelierButton.jsx';
import {
  PAY_BANK, PAY_CASH, PAY_WIRE, bankIsConfigured, cashIsConfigured, paypalLinkFor, wireIsConfigured,
} from '@/data/paymentDetails.js';

/**
 * The receipt, uploaded here instead of sent on WhatsApp (10 Nov 2026). The same two calls the domestic
 * payment page makes — storage upload under orders/<NUMBER>/, then storefront_submit_payment_proof, which
 * accepts manual-transfer orders only — and the same nudge to the owner's Telegram.
 */
const ReceiptUpload = ({ orderNumber }) => {
  const { t } = useTranslate();
  const [file, setFile] = useState(null);
  const [state, setState] = useState('idle');

  const send = async (event) => {
    event.preventDefault();
    if (!file || state === 'sending') return;
    setState('sending');
    try {
      const uploaded = await uploadPaymentProof({ file, orderNumber });
      await submitOrderPaymentProof(orderNumber, {
        paymentProofUrl: uploaded.paymentProofUrl,
        fileName: uploaded.fileName,
        contentType: uploaded.contentType,
      });
      fetch('/api/orders/notify-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber }),
      }).catch(() => {});
      setFile(null);
      setState('done');
    } catch (error) {
      console.warn('Receipt upload failed:', error?.message || error);
      setState('failed');
    }
  };

  return (
    <form className="pay-link__block flex flex-col gap-3" onSubmit={send}>
      <h2>{t('pay.link.proofTitle')}</h2>
      <p>{t('pay.link.proofBody')}</p>
      <label className="ng-label">
        <span className="ng-mono text-ng-dust">{t('pay.link.proofPick')}</span>
        <input
          type="file"
          className="ng-field"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(event) => { setFile(event.target.files?.[0] || null); setState('idle'); }}
        />
      </label>
      <button type="submit" className="ng-btn self-start" disabled={!file || state === 'sending'}>
        {state === 'sending' ? t('pay.link.proofSending') : t('pay.link.proofSend')}
      </button>
      {state === 'done' ? <p className="pay-link__note" role="status">{t('pay.link.proofDone')}</p> : null}
      {state === 'failed' ? <p className="ng-error m-0 text-sm" role="alert">{t('pay.link.proofFailed')}</p> : null}
    </form>
  );
};

// /pay/<token> — how to pay ONE order, opened without logging in.
//
// Three orders stalled at this step in a month because the instructions were retyped by hand each time:
// Wise asks for an email, Dekito's Wise account cannot receive funds, a US bank will not wire to a
// personal account. The page says it once, per order, in the order the methods actually work.
//
// NOINDEX AND UNLINKED. Nothing points here; the token is the whole address. robots.txt disallows /pay/
// in all three trees, and the meta below is what a crawler that ignores robots.txt reads.
//
// A MISSING ORDER AND A WRONG TOKEN LOOK THE SAME. Saying "no such order" would turn this into an oracle
// for guessing tokens; saying "already paid" would tell a stranger something about a real buyer. One
// message covers every case, and it is the message that leaves the buyer with something to do.

const Field = ({ label, value }) => (
  <div className="pay-link__field">
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);

const PaymentInstructionsPage = () => {
  const { token = '' } = useParams();
  const { t } = useTranslate();
  const [order, setOrder] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    findOrderByPaymentToken(token)
      .then((found) => { if (!cancelled) { setOrder(found); setLoaded(true); } })
      .catch(() => { if (!cancelled) { setOrder(null); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [token]);

  const orderNumber = order?.orderNumber || '';
  // Exactly the cart's total for an order the English cart wrote; the usual $5 round-up otherwise.
  const usd = order ? paymentAmountUsd(order.amountIdr) : null;
  const paypalUrl = paypalLinkFor(usd);

  return (
    <>
      <Helmet>
        {/* Without an order there is no number to name, and "Payment — - SOLIVAGANT" is what a
            placeholder looked like. The eyebrow carries the word on its own. */}
        <title>{orderNumber ? t('pay.link.tab', { order: orderNumber }) : t('pay.link.eyebrowTab')}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="solivagant-editorial-home">
        <PublicHeader />
        <main>
        <section className="ng-section">
          <div className="ng-container pay-link flex max-w-[760px] flex-col gap-6">
          <p className="ng-eyebrow ng-mono m-0">{t('pay.link.eyebrow')}</p>

          {!loaded ? (
            <p className="pay-link__note" role="status">{t('pay.link.loading')}</p>
          ) : !order ? (
            <>
              <h1 className="ng-display text-[36px] md:text-[44px]">{t('pay.link.invalidTitle')}</h1>
              <p className="pay-link__note">{t('pay.link.notFound')}</p>
              {/* "Balas pesan WhatsApp kami" with nothing to tap but the footer (third audit, 13 Nov 2026). */}
              <AskAtelierButton className="mt-4" />
            </>
          ) : (
            <>
              <h1 className="ng-display text-[44px] md:text-[64px]">{t('pay.link.title', { order: orderNumber })}</h1>
              <p className="pay-link__amount">
                <span>{t('pay.link.amount')}</span>
                {/* The dollar figure, with the shop's own rounding — the same number the quote carried. */}
                <strong>{usd ? `US$${usd}` : ''}</strong>
              </p>

              {paypalUrl ? (
                <article className="pay-link__block flex flex-col gap-3">
                  <h2>{t('pay.link.paypalTitle')}</h2>
                  <p>{t('pay.link.paypalBody', { order: orderNumber })}</p>
                  <a href={paypalUrl} target="_blank" rel="noopener noreferrer" className="ng-btn self-start">
                    {t('pay.link.paypalButton', { amount: `US$${usd}` })}
                  </a>
                </article>
              ) : null}

              <article className="pay-link__block">
                <h2>{t('pay.link.wiseTitle')}</h2>
                <p>{t('pay.link.wiseBest')}</p>
                <ol>
                  <li>{t('pay.link.wiseStep1')}</li>
                  <li>{t('pay.link.wiseStep2')}</li>
                  <li>{t('pay.link.wiseStep3')}</li>
                </ol>
                {bankIsConfigured() ? (
                  <dl className="pay-link__fields">
                    <Field label={t('pay.link.fieldCountry')} value={PAY_BANK.country} />
                    <Field label={t('pay.link.fieldCurrency')} value={PAY_BANK.currency} />
                    <Field label={t('pay.link.fieldBank')} value={PAY_BANK.bank} />
                    <Field label={t('pay.link.fieldAccount')} value={PAY_BANK.account} />
                    <Field label={t('pay.link.fieldHolder')} value={PAY_BANK.holder} />
                  </dl>
                ) : <p className="pay-link__note">{t('pay.link.notConfigured')}</p>}
                <p className="pay-link__note">{t('pay.link.wiseNote')}</p>
              </article>

              <article className="pay-link__block">
                <h2>{t('pay.link.wuTitle')}</h2>
                <p>
                  {cashIsConfigured()
                    ? t('pay.link.wuBody', { holder: PAY_CASH.holder, city: PAY_CASH.city })
                    : t('pay.link.notConfigured')}
                </p>
              </article>

              <article className="pay-link__block">
                <h2>{t('pay.link.wireTitle')}</h2>
                {wireIsConfigured() ? (
                  <dl className="pay-link__fields">
                    <Field label={t('pay.link.fieldBank')} value={PAY_WIRE.bank} />
                    <Field label={t('pay.link.fieldBic')} value={PAY_WIRE.bic} />
                    <Field label={t('pay.link.fieldAccount')} value={PAY_WIRE.account} />
                    <Field label={t('pay.link.fieldHolder')} value={PAY_WIRE.holder} />
                    {PAY_WIRE.address ? <Field label={t('pay.link.fieldAddress')} value={PAY_WIRE.address} /> : null}
                  </dl>
                ) : <p className="pay-link__note">{t('pay.link.notConfigured')}</p>}
                <p className="pay-link__note">{t('pay.link.wireNote')}</p>
              </article>

              <p className="pay-link__note">{t('pay.link.after')}</p>
              <ReceiptUpload orderNumber={orderNumber} />
              <p className="pay-link__note">{t('pay.link.deadline')}</p>
            </>
          )}
          </div>
        </section>
        </main>
        <StorefrontFooter />
      </div>
    </>
  );
};

export default PaymentInstructionsPage;
