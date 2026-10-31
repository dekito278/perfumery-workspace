import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import { findOrderByPaymentToken } from '@/services/paymentLinkService.js';
import { usdPriceFor } from '@/utils/usdPrice.js';
import {
  PAY_BANK, PAY_CASH, PAY_WIRE, bankIsConfigured, cashIsConfigured, wireIsConfigured,
} from '@/data/paymentDetails.js';

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
  const usd = order ? usdPriceFor(order.amountIdr) : null;

  return (
    <>
      <Helmet>
        {/* Without an order there is no number to name, and "Payment — - SOLIVAGANT" is what a
            placeholder looked like. The eyebrow carries the word on its own. */}
        <title>{orderNumber ? t('pay.link.tab', { order: orderNumber }) : t('pay.link.eyebrowTab')}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <main className="solivagant-editorial-home">
        <PublicHeader />
        <section className="ng-section">
          <div className="ng-container pay-link flex max-w-[760px] flex-col gap-6">
          <p className="ng-eyebrow ng-mono m-0">{t('pay.link.eyebrow')}</p>

          {!loaded || !order ? (
            <p className="pay-link__note">{loaded ? t('pay.link.notFound') : ''}</p>
          ) : (
            <>
              <h1 className="ng-display text-[44px] md:text-[64px]">{t('pay.link.title', { order: orderNumber })}</h1>
              <p className="pay-link__amount">
                <span>{t('pay.link.amount')}</span>
                {/* The dollar figure, with the shop's own rounding — the same number the quote carried. */}
                <strong>{usd ? `US$${usd}` : ''}</strong>
              </p>

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
            </>
          )}
          </div>
        </section>
      </main>
      <StorefrontFooter />
    </>
  );
};

export default PaymentInstructionsPage;
