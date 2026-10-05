import { useMemo } from 'react';
import { useShippingDestination } from '@/hooks/useShippingDestination.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { useTierPrices, useStorefrontProducts } from '@/hooks/useStorefrontProducts.js';
import { usdPriceFor } from '@/utils/usdPrice.js';
import { countryNameFor, DESTINATION_OTHER, DESTINATION_PICKER_ID } from '@/utils/shippingDestination.js';
import { quoteInternationalShippingPrice } from '@/utils/internationalShippingPrice.js';
import { internationalPriceFor } from '@/utils/shippingRegion.js';
import { tierPricesForLine } from '@/utils/tierPrice.js';
import { splitFreeVialLines } from '@/utils/freeVial.js';
import { SHIPPING_RATE_BOTTLE_SIZE_ML } from '@/data/internationalShippingRates.js';

/**
 * One international total, computed once, for every surface that shows or sends it.
 *
 * Two hooks, one arithmetic. The product page quotes ONE bottle (useInternationalQuote); the English
 * cart quotes the whole basket (useCartInternationalQuote). They used to be one hook, and the cart was
 * first built by calling it with the basket's totals — which quietly multiplied the first bottle's price
 * by the count. So the arithmetic is a pure function both hooks call, and the test runs THAT.
 *
 * The draft comes back as a KEY and VARS, never as rendered text: this repo forbids the storefront from
 * carrying message text in a data object, because Indonesian arriving at runtime is invisible to every
 * scan for Indonesian literals.
 */

/**
 * The bottle size the rule was written against, in millilitres, or null when it cannot be read.
 *
 * Every bottle in the shop is 30 ml today, which is exactly the kind of rule that is alive only because
 * of today's data. A 50 ml added next month would be quoted 30 ml freight as a published promise, so the
 * size is checked rather than assumed, and anything that is not 30 ml is quoted on request.
 */
export const bottleMillilitres = (size) => {
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*ml\b/i.exec(String(size || ''));
  return match ? Number(match[1].replace(',', '.')) : null;
};
const sizeIsOnTheCard = (size) => bottleMillilitres(size) === SHIPPING_RATE_BOTTLE_SIZE_ML;

/**
 * The arithmetic, with nothing React in it.
 *
 * @param goodsUsd  the dollars for the bottles themselves, already summed by the caller — null when
 *                  there is nothing priced
 * @param bottles   how many 30 ml bottles ride in the parcel
 * @param onTheCard whether every bottle is a size the rule was written for
 */
export const internationalQuoteFor = ({
  country = '', bottles = 1, goodsUsd = null, onTheCard = true, t, region = 'en',
} = {}) => {
  // Nothing picked is its own case and must not be confused with a destination we cannot serve: the
  // first is a question the buyer has not answered, the second is an answer we do not have.
  const quote = country && onTheCard
    ? quoteInternationalShippingPrice({ countryCode: country, bottles })
    : null;
  const shippingUsd = quote?.usd ?? null;
  const shippingCostUsd = quote?.costUsd ?? null;
  const shippingSupportUsd = quote?.supportUsd ?? null;
  const transitDays = quote?.transitDays ?? null;
  const totalUsd = goodsUsd && shippingUsd ? goodsUsd + shippingUsd : null;

  // Which "no number" this is, most specific first. A size the rule was not written for is not the
  // buyer's fault and not their country's either, so it outranks both.
  let onRequest = null;
  if (!shippingUsd) {
    if (!onTheCard) onRequest = 'size';
    else if (!country) onRequest = 'country';
    else if (country === DESTINATION_OTHER) onRequest = 'destination';
    else onRequest = quote?.onRequest || 'destination';
  }

  const destination = country && country !== DESTINATION_OTHER ? countryNameFor(country, region) : '';
  // "1 bottle(s)" is what a template with the noun baked in produces; the count arrives already worded
  // from the catalogue, in the shop's own language, so the template only places it.
  const countLabel = t(bottles === 1 ? 'intlQuote.bottleOne' : 'intlQuote.bottleMany', { count: bottles });
  // The arrival estimate, worded once here for both the screen and the draft.
  const eta = transitDays ? t('intlQuote.etaRange', { min: transitDays[0], max: transitDays[1] }) : '';

  // The draft vars say only what is settled: a total, or a destination that still needs a rate.
  let draftVars = null;
  if (totalUsd) {
    draftVars = {
      destination, count: countLabel, goods: `US$${goodsUsd}`, shipping: `US$${shippingUsd}`, total: `US$${totalUsd}`, eta,
    };
  } else if (destination && goodsUsd) {
    draftVars = { destination, count: countLabel, goods: `US$${goodsUsd}` };
  }

  // THE GATE. A buyer who opens WhatsApp should arrive with the shipping and the arrival estimate already
  // in the message, not ask for them. Until a destination is chosen the order button is not a link to
  // WhatsApp; it is a pointer to the picker.
  const needsDestination = Boolean(goodsUsd) && !country;

  return {
    country, bottles, destination, transitDays, eta,
    goodsUsd, shippingUsd, shippingCostUsd, shippingSupportUsd, totalUsd, onRequest,
    settled: Boolean(totalUsd), draftVars, needsDestination,
  };
};

export const focusDestinationPicker = (event) => {
  if (event?.preventDefault) event.preventDefault();
  if (typeof document === 'undefined') return;
  const picker = document.getElementById(DESTINATION_PICKER_ID);
  if (!picker) return;
  picker.scrollIntoView({ block: 'center', behavior: 'smooth' });
  picker.focus();
};

/** The product page: one bottle, this product, this variant. */
export const useInternationalQuote = ({ price, product = null, variant = null } = {}) => {
  const { t, region } = useTranslate();
  const { country, bottles, setCountry, setBottles } = useShippingDestination();
  const bottleSizeLabel = variant?.size || product?.size || '';
  const perBottleUsd = usdPriceFor(price);
  const core = internationalQuoteFor({
    country, bottles, goodsUsd: perBottleUsd ? perBottleUsd * bottles : null,
    onTheCard: sizeIsOnTheCard(bottleSizeLabel), t, region,
  });
  const draft = core.draftVars
    ? { key: core.settled ? 'export.waDraftQuote' : 'export.waDraftDestination', vars: core.draftVars }
    : null;
  return { ...core, setCountry, setBottles, bottleSizeLabel, draft, focusDestinationPicker };
};

/**
 * The RETAIL price of a cart line, never the one this visitor happens to be entitled to.
 *
 * The same rule useExportPrice holds for a product page, and for the same reason: applyTierPrices
 * rewrites priceNumber to the member price for a signed-in member and keeps the original as
 * retailPriceNumber. Reading priceNumber here would multiply a domestic loyalty discount into an export
 * price. Dekito's decision, 2026-09-24 — the member discount does not travel.
 */
const retailPriceOfLine = (item, product, variant) => Number(
  variant?.retailPriceNumber
  ?? variant?.priceNumber
  ?? product?.retailPriceNumber
  ?? product?.priceNumber
  ?? item?.priceNumber
  ?? 0,
);

/**
 * The English cart: every bought line at its export price, in dollars, and one parcel for all of them.
 *
 * The free vial is not a bought line here — the English cart does not offer it (a domestic promotion
 * with its own stock) — so gift lines are split off before counting, exactly as the cart pages do.
 *
 * A line with NO export price set cannot be quoted, and inventing one from the domestic price is the
 * thing CardPrice and OverseasPriceNote exist to refuse. Such lines come back in `unpriced`, the goods
 * total is null, and the order button stays shut until they are removed.
 */
export const useCartInternationalQuote = (items = []) => {
  const { t, region } = useTranslate();
  const { country, setCountry } = useShippingDestination();
  const { index } = useTierPrices();
  const catalog = useStorefrontProducts();

  const lines = useMemo(() => {
    const { lines: bought } = splitFreeVialLines(items);
    return bought.map((item) => {
      const slug = item.productSlug || item.slug;
      const product = catalog.find((entry) => entry.slug === slug || entry.id === item.productId) || null;
      const variants = Array.isArray(product?.variants) ? product.variants : [];
      const variantId = item.variantId || item.variant_id || '';
      const variant = variants.find((entry) => (entry.id || entry.size) === variantId) || variants[0] || null;
      const exportIdr = internationalPriceFor({
        tierPrices: tierPricesForLine(index, slug, variantId),
        linePrice: retailPriceOfLine(item, product, variant),
      });
      const unitUsd = usdPriceFor(exportIdr);
      const quantity = Math.max(1, Math.round(Number(item.quantity) || 0));
      return {
        ...item,
        slug: item.slug,
        productSlug: slug,
        quantity,
        unitUsd,
        lineUsd: unitUsd ? unitUsd * quantity : null,
        onTheCard: sizeIsOnTheCard(item.size),
      };
    });
  }, [items, catalog, index]);

  const unpriced = lines.filter((line) => !line.unitUsd);
  const bottles = lines.reduce((sum, line) => sum + line.quantity, 0);
  const goodsUsd = lines.length && !unpriced.length
    ? lines.reduce((sum, line) => sum + line.lineUsd, 0)
    : null;
  const core = internationalQuoteFor({
    country, bottles: Math.max(1, bottles), goodsUsd,
    onTheCard: lines.every((line) => line.onTheCard), t, region,
  });
  const draft = core.settled
    ? {
      key: 'export.waCartDraft',
      vars: {
        ...core.draftVars,
        lines: lines.map((line) => t('export.waCartLine', {
          name: line.name, size: line.size || '', quantity: line.quantity, price: `US$${line.lineUsd}`,
        })).join('\n'),
      },
    }
    : null;
  return { ...core, lines, unpriced, bottles, setCountry, draft, focusDestinationPicker };
};

export default useInternationalQuote;
