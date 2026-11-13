import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate.js';
import { clearCart } from '@/services/cartService.js';
import { placeInternationalOrder } from '@/services/orderService.js';
import { phoneExampleFor, postcodeLabelKeyFor, postcodeRequiredFor, regionLabelKeyFor, regionRequiredFor } from '@/utils/internationalAddress.js';

// maxLength = the endpoint's own limits (INTERNATIONAL_FIELDS in api/orders/create.js), so a too-long field
// is stopped while typing rather than refused after "Place order". Patterns: a phone is digits with a + and
// separators, not "call me maybe"; an email has a domain with a dot, as the endpoint requires (visitor
// audit, 13 Nov 2026 — both were accepted by the form and only refused by the server).
const FIELDS = [
  { key: 'name', label: 'cart.intl.formName', autoComplete: 'name', required: true, maxLength: 120 },
  { key: 'email', label: 'cart.intl.formEmail', autoComplete: 'email', type: 'email', required: true, maxLength: 200, pattern: '[^\\s@]+@[^\\s@]+\\.[^\\s@]+' },
  // Required: DHL asks for a phone on every international waybill (internationalAddress.js).
  { key: 'phone', label: 'cart.intl.formPhone', autoComplete: 'tel', type: 'tel', required: true, maxLength: 40, pattern: '[+]?[0-9 \\.\\-\\/\\(\\)]{6,40}', hint: 'cart.intl.formPhoneHint' },
  { key: 'address', label: 'cart.intl.formAddress', autoComplete: 'street-address', hint: 'cart.intl.formAddressHint', required: true, multiline: true, maxLength: 600 },
  { key: 'city', label: 'cart.intl.formCity', autoComplete: 'address-level2', required: true, maxLength: 120 },
  // Required only where DHL needs it (US, CA, AU); asked of everyone, since most addresses have one.
  { key: 'region', label: 'cart.intl.formRegion', labelFor: regionLabelKeyFor, autoComplete: 'address-level1', requiredFor: regionRequiredFor, maxLength: 120 },
  // Required where the country uses postcodes (internationalAddress.js); labelled in the country's own words.
  { key: 'postcode', label: 'cart.intl.formPostcode', labelFor: postcodeLabelKeyFor, autoComplete: 'postal-code', maxLength: 20, requiredFor: postcodeRequiredFor },
];

// What was typed survives a reload (the audit lost a whole address to one). Per browser, cleared once the
// order is placed; a blocked store simply does not remember.
const DRAFT_KEY = 'solivagant.intlOrderDraft.v1';
const EMPTY_BUYER = { name: '', email: '', phone: '', address: '', city: '', region: '', postcode: '' };
const readDraft = () => {
  try { return { ...EMPTY_BUYER, ...(JSON.parse(window.localStorage.getItem(DRAFT_KEY) || '{}') || {}) }; } catch { return EMPTY_BUYER; }
};
const writeDraft = (value) => { try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(value)); } catch { /* not remembered */ } };
const clearDraft = () => { try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* nothing to clear */ } };

// DHL prints the waybill in Latin letters; an address in another script is accepted, with a word of warning.
const NON_LATIN = /[^\u0000-\u024F\u1E00-\u1EFF\s]/;

/**
 * The English cart's till (Dekito, 10 Nov 2026): the buyer's address, and the order is written by the
 * server at the price this cart shows — then straight to the payment page, where the receipt is uploaded.
 * No WhatsApp in between. Shown only when the quote is settled; anything the rule cannot price still
 * goes to WhatsApp from the cart.
 *
 * A real form: Enter submits, the browser checks the required fields and the email, and autofill fills
 * the address.
 */
const InternationalOrderForm = ({ quote }) => {
  const { t } = useTranslate();
  const navigate = useNavigate();
  const [buyer, setBuyer] = useState(readDraft);
  useEffect(() => { writeDraft(buyer); }, [buyer]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const { paymentToken } = await placeInternationalOrder({
        country: quote.country,
        buyer,
        items: [...quote.lines, ...(quote.gift ? [quote.gift] : [])],
      });
      clearCart();
      clearDraft();
      navigate(`/pay/${paymentToken}`);
    } catch (failure) {
      setError(failure?.message || t('cart.intl.placeFailed'));
      setSaving(false);
    }
  };

  return (
    <form className="flex flex-col gap-4 border-t border-ng-bone/15 pt-6" onSubmit={submit} aria-labelledby="intl-order-form">
      <h3 id="intl-order-form" className="ng-mono m-0 text-ng-bone">{t('cart.intl.formTitle')}</h3>
      {FIELDS.map((field) => {
        const Input = field.multiline ? 'textarea' : 'input';
        return (
          <label key={field.key} className="ng-label">
            <span className="ng-mono text-ng-dust">{t(field.labelFor ? field.labelFor(quote.country) : field.label)}</span>
            <Input
              className="ng-field"
              type={field.multiline ? undefined : (field.type || 'text')}
              rows={field.multiline ? 3 : undefined}
              value={buyer[field.key]}
              onChange={(event) => setBuyer((current) => ({ ...current, [field.key]: event.target.value }))}
              // The phone example in the buyer's own calling code: a US buyer was shown "+65 9123 4567".
              placeholder={field.key === 'phone' && phoneExampleFor(quote.country) ? phoneExampleFor(quote.country) : (field.hint ? t(field.hint) : undefined)}
              autoComplete={field.autoComplete}
              required={field.required || Boolean(field.requiredFor?.(quote.country))}
              maxLength={field.maxLength}
              pattern={field.pattern}
              inputMode={field.type === 'tel' ? 'tel' : undefined}
            />
            {(field.key === 'address' || field.key === 'city') && NON_LATIN.test(buyer[field.key]) ? (
              <span className="text-sm text-ng-sand" role="status">{t('cart.intl.formLatin')}</span>
            ) : null}
          </label>
        );
      })}
      <p className="m-0 text-sm text-ng-dust">{t('cart.intl.formCountry', { country: quote.destination })}</p>
      {error ? <p className="ng-error m-0 text-sm" role="alert">{error}</p> : null}
      <button type="submit" className="ng-btn ng-btn--lg ng-btn--block" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {saving ? t('cart.intl.placing') : t('cart.intl.place', { total: `US$${quote.totalUsd}` })}
      </button>
      <p className="m-0 text-sm leading-relaxed text-ng-dust">{t('cart.intl.placeHow')}</p>
    </form>
  );
};

export default InternationalOrderForm;
