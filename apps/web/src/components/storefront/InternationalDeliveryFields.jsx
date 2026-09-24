import React, { useMemo } from 'react';
import { Globe } from 'lucide-react';
import { listCheckoutDestinations } from '@/utils/internationalDestination.js';
import { getCountryName } from '@/data/exportZones.js';
import { useTranslate } from '@/hooks/useTranslate.js';

/**
 * What an international checkout asks for instead of a courier.
 *
 * One component behind both the desktop and the mobile checkout. The two-copy habit in this repo is
 * where five separate fixes went to one side and not the other, and this is the field that decides both
 * the price and the shipping promise — the last place to keep two versions of.
 *
 * Grouped by the rate card's own regions, so the buyer can see which group they are in. That group is
 * not decoration: it decides which of the two international prices they pay and whether the shipping is
 * already inside it.
 */
const InternationalDeliveryFields = ({ value, onChange, destination, invalid = false }) => {
  const { t, region } = useTranslate();
  // Named in the language of the shop being read.
  const groups = useMemo(() => listCheckoutDestinations((code) => getCountryName(code, region)), [region]);

  return (
    <>
      <label className="checkout-field">
        <span>{t('checkout.country')}</span>
        <div className="checkout-select-wrap">
          <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={t('checkout.country')} aria-invalid={invalid ? 'true' : undefined}>
            <option value="">{t('checkout.pickCountry')}</option>
            {groups.map((group) => (
              <optgroup key={group.key} label={group.label}>
                {group.countries.map((country) => (
                  <option key={country.code} value={country.code}>{country.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        {invalid ? <span className="checkout-field__error" role="alert">{t('checkout.errCountry')}</span> : null}
      </label>

      {/* Said as soon as the country is chosen, not discovered at the payment page. The two answers are
          genuinely different orders: one is payable immediately, the other waits for a figure only
          Dekito can produce. */}
      {destination ? (
        <p className="checkout-helper-text" role="status">
          <Globe className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          {destination.shippingIncluded
            ? t('checkout.countryShippingIncluded', { region: destination.regionLabel })
            : t('checkout.countryShippingQuoted', { region: destination.regionLabel })}
        </p>
      ) : null}
    </>
  );
};

export default InternationalDeliveryFields;
