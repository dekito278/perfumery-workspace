import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate.js';

/**
 * − quantity + for one cart line, shared by both carts.
 *
 * Seventh visitor audit, 13 Nov 2026: pressing "−" down to 1, or "+" up to the stock limit, DISABLED the
 * button under the keyboard's focus, and a disabled button cannot hold focus — it fell to <body> and a
 * screen-reader user lost their place in the cart. The ends are aria-disabled instead (still focusable,
 * still announced as unavailable, the press does nothing), and the count is announced with the name of the
 * perfume rather than as a bare "2".
 */
const CartQuantityStepper = ({ name, quantity, canDecrease, canIncrease, onDecrease, onIncrease }) => {
  const { t } = useTranslate();
  return (
    <div className="ng-stepper">
      <button
        type="button"
        onClick={() => { if (canDecrease) onDecrease(); }}
        aria-disabled={canDecrease ? undefined : 'true'}
        aria-label={t('cart.decreaseOf', { name })}
      >
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span aria-hidden="true">{quantity}</span>
      <span className="sr-only" aria-live="polite">{t('cart.qtyNow', { name, count: quantity })}</span>
      <button
        type="button"
        onClick={() => { if (canIncrease) onIncrease(); }}
        aria-disabled={canIncrease ? undefined : 'true'}
        aria-label={t('cart.increaseOf', { name })}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
};

export default CartQuantityStepper;
