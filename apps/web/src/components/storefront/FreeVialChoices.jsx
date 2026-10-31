import React from 'react';
import { buildFreeVialCartItem, freeVialChoices } from '@/utils/freeVial.js';
import { splitScriptName } from '@/utils/scriptName.js';

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
    <div className={`flex flex-wrap gap-2 ${className}`.trim()} role="group">
      {choices.map((choice) => {
        const chosen = gift?.variantId === choice.variantId;
        return (
          <button
            key={choice.variantId}
            type="button"
            className="ng-chip ng-chip--plain"
            aria-pressed={chosen}
            onClick={() => onPick(chosen ? null : buildFreeVialCartItem({ vialProduct, choice }))}
          >
            {/* The Latin name only: a chip is too small to set the aksara legibly, and the product page
                already does. */}
            {splitScriptName(choice.label).name}
          </button>
        );
      })}
    </div>
  );
};

export default FreeVialChoices;
