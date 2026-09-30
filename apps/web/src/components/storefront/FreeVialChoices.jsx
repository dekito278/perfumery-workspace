import React from 'react';
import { buildFreeVialCartItem, freeVialChoices } from '@/utils/freeVial.js';

/**
 * The aroma buttons, and the three behaviours that go with them.
 *
 * Extracted because there are now TWO places a buyer meets this — the panel on the cart page and the
 * prompt that opens on add-to-cart — and "tap to choose, tap another to swap, tap the same one to
 * release" is one rule. Written twice it would be one rule that holds once, which is the mistake this
 * repository keeps paying for.
 *
 * `onPick` is handed the finished cart line, or null to release. The caller passes cartService's single
 * writer, which drops every vial line before adding, so a second aroma REPLACES rather than stacking.
 */
const FreeVialChoices = ({ vialProduct, gift, onPick, className = '' }) => {
  const choices = freeVialChoices(vialProduct);
  if (!choices.length) return null;

  return (
    <div className={`free-vial__choices ${className}`.trim()} role="group">
      {choices.map((choice) => {
        const chosen = gift?.variantId === choice.variantId;
        return (
          <button
            key={choice.variantId}
            type="button"
            className={`free-vial__choice${chosen ? ' is-chosen' : ''}`}
            aria-pressed={chosen}
            onClick={() => onPick(chosen ? null : buildFreeVialCartItem({ vialProduct, choice }))}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
};

export default FreeVialChoices;
