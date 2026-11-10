import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate.js';
import { clearCart } from '@/services/cartService.js';
import { placeInternationalOrder } from '@/services/orderService.js';

const FIELDS = [
  { key: 'name', label: 'cart.intl.formName', autoComplete: 'name', required: true },
  { key: 'email', label: 'cart.intl.formEmail', autoComplete: 'email', type: 'email', required: true },
  { key: 'phone', label: 'cart.intl.formPhone', autoComplete: 'tel', type: 'tel' },
  { key: 'address', label: 'cart.intl.formAddress', autoComplete: 'street-address', hint: 'cart.intl.formAddressHint', required: true, multiline: true },
  { key: 'city', label: 'cart.intl.formCity', autoComplete: 'address-level2', required: true },
  { key: 'postcode', label: 'cart.intl.formPostcode', autoComplete: 'postal-code' },
];

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
  const [buyer, setBuyer] = useState({ name: '', email: '', phone: '', address: '', city: '', postcode: '' });
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
            <span className="ng-mono text-ng-dust">{t(field.label)}</span>
            <Input
              className="ng-field"
              type={field.multiline ? undefined : (field.type || 'text')}
              rows={field.multiline ? 3 : undefined}
              value={buyer[field.key]}
              onChange={(event) => setBuyer((current) => ({ ...current, [field.key]: event.target.value }))}
              placeholder={field.hint ? t(field.hint) : undefined}
              autoComplete={field.autoComplete}
              required={field.required}
            />
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
