import React, { useId } from 'react';
import { Globe } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate.js';
import { useOverseasPrice } from '@/hooks/useOverseasPrice.js';
import { useInternationalQuote } from '@/hooks/useInternationalQuote.js';
import { destinationOptions, DESTINATION_OTHER, DESTINATION_PICKER_ID } from '@/utils/shippingDestination.js';
import { SHIPPING_RATE_MAX_BOTTLES } from '@/data/internationalShippingRates.js';

/**
 * The complete price an international buyer pays, before they ask instead of after.
 *
 * This screen is the answer to two things Dekito said on 2026-10-05, which turned out to be one thing.
 * He asked how to stop a foreign buyer seeing the Indonesian price, and he asked to stop typing shipping
 * into Studio by hand because the card already exists. The honest answer to the first is the second:
 * what actually misled a buyer in Germany was not the rupiah price on another page, it was US$80 shown
 * here with no shipping at all, and US$140 arriving in a WhatsApp reply after they had already decided.
 * A total that nearly triples after the buyer's expectation is set is the surprise this component
 * removes — and a correct total is a better defence of the export price than hiding the domestic one.
 *
 * It quotes from the published card and nothing else. A destination the card does not list, a size it was
 * not written for, or more bottles than it covers all come back "quoted on request", which is what the
 * card's own footnote says to do. None of those is a guess dressed up as a rate.
 */
const InternationalShippingQuote = ({ product, variant = null, className = '' }) => {
  const { t, region } = useTranslate();
  // useOverseasPrice, not useExportPrice: GATED, so this block appears in exactly the places
  // InternationalPrice appears — the English shop, and a reader the detection places abroad. The ungated
  // hook hands the export price to everyone, and with it this whole panel would open on the Indonesian
  // product page: a dollar total with a country picker, under a rupiah price, for a buyer in Bandung
  // whose parcel is going to Bandung. An Indonesian sending a bottle abroad still has the WhatsApp
  // button, which is what they had before this screen existed.
  const price = useOverseasPrice(product, variant);
  const {
    country, bottles, setCountry, setBottles,
    goodsUsd, shippingUsd, shippingSupportUsd, totalUsd, onRequest, bottleSizeLabel, eta,
  } = useInternationalQuote({ price, product, variant });
  // A STABLE id for the country picker, not a useId one: the order buttons on this page send a buyer who
  // has not chosen yet to this control, and they find it by id.
  const countryId = DESTINATION_PICKER_ID;
  const bottlesId = useId();

  // No export price means this reader is not being quoted internationally, or the bottle has no export
  // price set. Either way a quote block over a blank price is a form that cannot answer its own question.
  if (!price) return null;

  const groups = destinationOptions(region);

  return (
    <div className={`rounded-2xl border border-editorial-charcoal/15 bg-[#fbfaf7] p-4 ${className}`}>
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-editorial-charcoal">
        <Globe className="h-3.5 w-3.5" aria-hidden="true" /> {t('intlQuote.heading')}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <div className="min-w-[12rem] flex-1">
          {/* Labelled, not placeholder-only: a select whose only name is its first option is unnamed to a
              screen reader the moment a country is chosen. */}
          <label htmlFor={countryId} className="sr-only">{t('intlQuote.countryLabel')}</label>
          <select
            id={countryId}
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className="w-full rounded-xl border border-editorial-charcoal/20 bg-white px-3 py-2 text-sm font-semibold text-editorial-charcoal"
          >
            <option value="">{t('intlQuote.selectCountry')}</option>
            {groups.map((group) => (
              <optgroup key={group.key} label={t(`intlQuote.region.${group.key}`)}>
                {group.countries.map((item) => (
                  <option key={item.code} value={item.code}>{item.name}</option>
                ))}
              </optgroup>
            ))}
            <option value={DESTINATION_OTHER}>{t('intlQuote.otherCountry')}</option>
          </select>
        </div>
        <div className="w-28">
          <label htmlFor={bottlesId} className="sr-only">{t('intlQuote.bottlesLabel')}</label>
          <select
            id={bottlesId}
            value={bottles}
            onChange={(event) => setBottles(event.target.value)}
            className="w-full rounded-xl border border-editorial-charcoal/20 bg-white px-3 py-2 text-sm font-semibold text-editorial-charcoal"
          >
            {/* Past the card's last tier there is one more option, and choosing it says so rather than
                quoting the 5–6 price for eight bottles. */}
            {Array.from({ length: SHIPPING_RATE_MAX_BOTTLES }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count === 1 ? t('intlQuote.bottleOne') : t('intlQuote.bottleMany', { count })}
              </option>
            ))}
            <option value={SHIPPING_RATE_MAX_BOTTLES + 1}>{t('intlQuote.bottleMore')}</option>
          </select>
        </div>
      </div>

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">
            {t('intlQuote.goodsLine', { count: bottles, size: bottleSizeLabel })}
          </dt>
          <dd className="font-semibold text-editorial-charcoal">US${goodsUsd}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">{t('intlQuote.shippingLine')}</dt>
          <dd className="font-semibold text-editorial-charcoal">
            {/* Three different "no number" cases, each saying WHICH one it is. "Quote on request" with no
                reason reads as a refusal; with a reason it reads as a next step. */}
            {shippingUsd ? `US$${shippingUsd}` : t(`intlQuote.onRequest.${onRequest || 'country'}`)}
          </dd>
        </div>
      </dl>

      {/* The one sentence the whole rule was shaped to be: a number, not a percentage, so it can be said.
          Shown only with a settled figure — "we cover US$30" over "quoted on request" is a promise about a
          parcel we have not priced. */}
      {shippingUsd && shippingSupportUsd ? (
        <p className="mt-1 text-xs font-semibold leading-relaxed text-editorial-charcoal">
          {t('intlQuote.support', { amount: shippingSupportUsd })}
        </p>
      ) : null}

      {totalUsd ? (
        <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-editorial-charcoal/15 pt-2">
          <span className="text-sm font-bold uppercase tracking-[0.08em] text-editorial-charcoal">
            {t('intlQuote.total')}
          </span>
          <strong className="text-lg font-bold text-editorial-charcoal">US${totalUsd}</strong>
        </div>
      ) : null}
      {/* When it arrives, from the same table the draft reads — so the message says what the page said. */}
      {totalUsd && eta ? (
        <p className="mt-1 text-xs font-semibold leading-relaxed text-editorial-charcoal">
          {t('intlQuote.eta', { eta })}
        </p>
      ) : null}

      {/* The card's own footnotes, kept with the numbers they qualify — a total that hides the duties is
          the same surprise one step further along. */}
      <p className="mt-3 text-xs font-semibold leading-relaxed text-muted-foreground">
        {t('intlQuote.duties')}
      </p>
      {/* WHY THERE IS A GAP, said plainly instead of hoped past. Dekito's decision, 2026-10-05: an export
          price large enough to raise the question is better off answering it. */}
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {t('intlQuote.why')}
      </p>
    </div>
  );
};

export default InternationalShippingQuote;
