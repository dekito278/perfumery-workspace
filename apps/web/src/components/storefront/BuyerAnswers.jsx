import React from 'react';
import { useTranslate } from '@/hooks/useTranslate.js';
import { checkoutPaymentMethods } from '@/services/cartService.js';
import { useStorefrontRegion } from '@/hooks/useStorefrontRegion.js';
import AskAtelierButton from '@/components/storefront/AskAtelierButton.jsx';

/**
 * The three things a first-time buyer asks before paying, answered on the page where they are asking.
 *
 * This shop has no FAQ, no shipping page, no policy page — the whole route table was checked. Until now
 * the only way to learn what shipping costs, how you pay, or how a parcel is followed was to reach the
 * checkout and find out. Both houses Dekito pointed at answer these on the product page instead.
 *
 * Every answer states something the shop ALREADY does, verified in the code that does it rather than
 * written from memory:
 *   - the checkout has a courier select and an address, and prices the shipping there (CheckoutPage)
 *   - the live payment methods are manual transfer and DOKU; QRIS is dark, so it is not mentioned
 *     (cartService.checkoutPaymentMethods, and buyerAnswersMatchTheShop.selfcheck.mjs holds the copy to
 *     that list rather than to my memory of it)
 *   - a parcel is followed through WhatsApp, which is what the customer portal has told buyers all along
 *
 * No new policy is invented here. Where the shop has not decided something, this says nothing about it.
 *
 * THE ANSWERS DIFFER BY SHOP, and the first version did not — it described the domestic checkout to
 * everybody. An overseas reader would have been told to pick an Indonesian courier and transfer rupiah
 * for a parcel this checkout cannot price or send. englishShopOrdersOnWhatsApp caught it the moment the
 * file imported checkoutPaymentMethods, which is exactly what that guard is for. The English shop fills
 * a cart in dollars, picks a destination, sees DHL shipping, and settles on WhatsApp.
 *
 * The tracking answer carries AskAtelierButton rather than only naming WhatsApp: contactPrompt refused
 * it otherwise, and rightly — a sentence that tells someone to ask us, beside no way to ask, is the
 * defect that rule was written for. The button renders nothing when no number is configured.
 *
 * It sits in the answer object, on the line that builds the sentence, rather than in the markup below.
 * That is where contactPrompt looks, and it is also where it belongs: the sentence and the way to act on
 * it are one decision, so a reworded answer cannot drift away from its button.
 *
 * Plain <details>, not an accordion component: it opens with no JavaScript, it is keyboard- and
 * screen-reader-correct without any ARIA of mine, and the browser's own find-in-page can reach inside a
 * closed one. A library would have cost a dependency on the first screen a buyer loads to do less.
 */
const BuyerAnswers = ({ className = '' }) => {
  const { t } = useTranslate();
  const { isInternational } = useStorefrontRegion();
  const hasDoku = checkoutPaymentMethods.some((method) => method.provider === 'doku');

  const answers = isInternational
    ? [
      { key: 'shipping', q: t('answers.shippingIntlQ'), a: t('answers.shippingIntlA') },
      { key: 'payment', q: t('answers.payIntlQ'), a: t('answers.payIntlA') },
      { key: 'tracking', q: t('answers.trackingQ'), a: t('answers.trackingA'), ask: <AskAtelierButton className="mb-4" /> },
    ]
    : [
      { key: 'shipping', q: t('answers.shippingQ'), a: t('answers.shippingA') },
      { key: 'payment', q: t('answers.paymentQ'), a: t(hasDoku ? 'answers.paymentA' : 'answers.paymentATransferOnly') },
      { key: 'tracking', q: t('answers.trackingQ'), a: t('answers.trackingA'), ask: <AskAtelierButton className="mb-4" /> },
    ];

  return (
    <section className={`ng-section ${className}`.trim()} aria-labelledby="pdp-answers-title">
      <div className="ng-container grid gap-10 md:grid-cols-2 md:gap-[72px]">
        <div className="flex flex-col gap-3.5">
          <p className="ng-mono m-0 text-ng-ash">{t('answers.title')}</p>
          <h2 id="pdp-answers-title" className="ng-display text-[44px] md:text-[56px]">{t('answers.ngHeading')} <em>{t('answers.ngHeadingEm')}</em></h2>
        </div>
        <div className="flex flex-col border-t border-ng-bone/20">
          {answers.map((answer) => (
            <details key={answer.key} className="ng-answer">
              <summary className="ng-answer__q">{answer.q}</summary>
              <p className="m-0 mb-6 max-w-[560px] text-[15px] leading-relaxed text-ng-dust">{answer.a}</p>
              {answer.ask ?? null}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BuyerAnswers;
