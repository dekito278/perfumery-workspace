import { useShippingDestination } from '@/hooks/useShippingDestination.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { usdPriceFor } from '@/utils/usdPrice.js';
import { countryNameFor, DESTINATION_OTHER } from '@/utils/shippingDestination.js';
import { quoteInternationalShippingPrice } from '@/utils/internationalShippingPrice.js';
import { SHIPPING_RATE_BOTTLE_SIZE_ML } from '@/data/internationalShippingRates.js';

/**
 * One international total, computed once, for every surface that shows or sends it.
 *
 * FOUR surfaces need this number on a product page: the quote block the buyer reads, and the three
 * WhatsApp drafts — the action button and the two sticky bars. They have drifted before. #362 fixed the
 * button's price line and left the bars, so the phone's bar, which is the only button most buyers ever
 * press, went on sending Dekito a figure he had not offered. One hook is the fix for the class, not just
 * for the instance.
 *
 * The draft comes back as a KEY and VARS, never as rendered text: this repo forbids the storefront from
 * carrying message text in a data object, because Indonesian arriving at runtime is invisible to every
 * scan for Indonesian literals.
 */

/**
 * The bottle size the card was written against, in millilitres, or null when it cannot be read.
 *
 * The card says "for 30 ml bottles" in its own first line and every one of the 19 bottles in the shop is
 * 30 ml today, which is exactly the kind of rule that is alive only because of today's data. A 50 ml
 * added next month would be quoted 30 ml shipping — in Studio that is a number Dekito is reading with
 * both tables in front of him, but here it is a published promise to a buyer. So the size is checked
 * rather than assumed, and anything that is not 30 ml is quoted on request.
 */
const bottleMillilitres = (size) => {
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*ml\b/i.exec(String(size || ''));
  return match ? Number(match[1].replace(',', '.')) : null;
};

export const useInternationalQuote = ({ price, product = null, variant = null } = {}) => {
  const { t, region } = useTranslate();
  const { country, bottles, setCountry, setBottles } = useShippingDestination();

  const bottleSizeLabel = variant?.size || product?.size || '';
  const millilitres = bottleMillilitres(bottleSizeLabel);
  const sizeIsOnTheCard = millilitres === SHIPPING_RATE_BOTTLE_SIZE_ML;

  const perBottleUsd = usdPriceFor(price);
  const goodsUsd = perBottleUsd ? perBottleUsd * bottles : null;

  // Nothing picked is its own case and must not be confused with a destination we cannot serve: the first
  // is a question the buyer has not answered, the second is an answer we do not have.
  const quote = country && sizeIsOnTheCard
    ? quoteInternationalShippingPrice({ countryCode: country, bottles })
    : null;
  const shippingUsd = quote?.usd ?? null;
  const totalUsd = goodsUsd && shippingUsd ? goodsUsd + shippingUsd : null;

  // Which "no number" this is, most specific first. A size the card was not written for is not the
  // buyer's fault and not their country's either, so it outranks both.
  let onRequest = null;
  if (!shippingUsd) {
    if (!sizeIsOnTheCard) onRequest = 'size';
    else if (!country) onRequest = 'country';
    else if (country === DESTINATION_OTHER) onRequest = 'destination';
    else onRequest = quote?.onRequest || 'destination';
  }

  const destination = country && country !== DESTINATION_OTHER
    ? countryNameFor(country, region)
    : '';
  // "1 bottle(s)" is what a template with the noun baked in produces, and the draft is the one piece of
  // copy that leaves the page — Dekito reads it, and so does the buyer who sends it. The count arrives
  // already worded from the catalogue, in the shop's own language, so the template only places it.
  const countLabel = t(bottles === 1 ? 'intlQuote.bottleOne' : 'intlQuote.bottleMany', { count: bottles });

  // The draft says only what is settled. With a total it quotes the total; with a destination but no rate
  // it quotes the destination and asks for the rate; with neither it falls back to the caller's own price
  // line, which is what every one of these surfaces sent before this screen existed.
  let draft = null;
  if (totalUsd) {
    draft = {
      key: 'export.waDraftQuote',
      vars: {
        destination, count: countLabel, goods: `US$${goodsUsd}`, shipping: `US$${shippingUsd}`, total: `US$${totalUsd}`,
      },
    };
  } else if (destination && goodsUsd) {
    draft = {
      key: 'export.waDraftDestination',
      vars: { destination, count: countLabel, goods: `US$${goodsUsd}` },
    };
  }

  return {
    country, bottles, setCountry, setBottles,
    bottleSizeLabel, destination,
    goodsUsd, shippingUsd, totalUsd, onRequest, draft,
  };
};

export default useInternationalQuote;
