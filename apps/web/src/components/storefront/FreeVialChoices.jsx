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
 * `onPick` is handed the finished cart line, or null to release. One dropdown is one vial; the caller
 * puts it in its slot of the order's set (FreeVialPicker) or adds it (FreeVialPrompt).
 */
//
// `taken` (18 Nov 2026): the aromas chosen for this order's OTHER vials, which this one may not repeat.
// `label` names the slot when there is more than one ("Vial 2").
const FreeVialChoices = ({ vialProduct, gift, onPick, bought = [], taken = [], label = '', className = '' }) => {
  const { t } = useTranslate();
  const id = useId();
  const choices = freeVialChoices(vialProduct, bought, taken);
  // The chosen aroma stays listed in its own dropdown even when its stock reads 0 after the pick.
  if (!choices.length && !gift) return null;

  const pick = (variantId) => {
    const choice = choices.find((item) => item.variantId === variantId);
    onPick(choice ? buildFreeVialCartItem({ vialProduct, choice }) : null);
  };

  return (
    <label htmlFor={id} className={`flex flex-col gap-2 ${className}`.trim()}>
      <span className="ng-mono text-ng-dust">{label || t('cart.giftPick')}</span>
      <select id={id} className="ng-field" value={gift?.variantId || ''} onChange={(event) => pick(event.target.value)}>
        <option value="">{t('cart.giftNone')}</option>
        {gift && !choices.some((choice) => choice.variantId === gift.variantId) ? (
          <option value={gift.variantId}>{splitScriptName(String(gift.size || '')).name}</option>
        ) : null}
        {choices.map((choice) => (
          // The Latin name only: an option cannot set the aksara legibly, and the product page already does.
          <option key={choice.variantId} value={choice.variantId}>{splitScriptName(choice.label).name}</option>
        ))}
      </select>
    </label>
  );
};

export default FreeVialChoices;
