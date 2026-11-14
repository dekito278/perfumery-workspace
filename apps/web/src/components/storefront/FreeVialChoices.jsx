import React, { useId } from 'react';
import { useTranslate } from '@/hooks/useTranslate.js';
import { buildFreeVialCartItem, freeVialChoices } from '@/utils/freeVial.js';
import { splitScriptName } from '@/utils/scriptName.js';

/**
 * The aroma choice, and the three behaviours that go with it — one rule, used by the cart's panel, the
 * checkout and the add-to-cart prompt.
 *
 * A DROPDOWN since 14 Nov 2026 (Dekito, from his phone: "jadiin dropdown aja biar gak ribet"). Twenty
 * aromas as buttons filled a phone screen and pushed the order summary below it; one field holds the same
 * choice in a line. Choosing an aroma takes it, choosing another swaps it, choosing "none" releases it.
 *
 * `onPick` is handed the finished cart line, or null to release. The caller passes cartService's single
 * writer, which drops every vial line before adding, so a second aroma REPLACES rather than stacking.
 */
const FreeVialChoices = ({ vialProduct, gift, onPick, bought = [], className = '' }) => {
  const { t } = useTranslate();
  const id = useId();
  const choices = freeVialChoices(vialProduct, bought);
  if (!choices.length) return null;

  const pick = (variantId) => {
    const choice = choices.find((item) => item.variantId === variantId);
    onPick(choice ? buildFreeVialCartItem({ vialProduct, choice }) : null);
  };

  return (
    <label htmlFor={id} className={`flex flex-col gap-2 ${className}`.trim()}>
      <span className="ng-mono text-ng-dust">{t('cart.giftPick')}</span>
      <select id={id} className="ng-field" value={gift?.variantId || ''} onChange={(event) => pick(event.target.value)}>
        <option value="">{t('cart.giftNone')}</option>
        {choices.map((choice) => (
          // The Latin name only: an option cannot set the aksara legibly, and the product page already does.
          <option key={choice.variantId} value={choice.variantId}>{splitScriptName(choice.label).name}</option>
        ))}
      </select>
    </label>
  );
};

export default FreeVialChoices;
