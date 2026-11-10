// An order from the English shop, priced by the server (Dekito, 10 Nov 2026: "agak cape kalo diarahkan
// ke WA terus"). Until now every overseas sale went cart → WhatsApp → retyped in Studio → payment link
// sent back on WhatsApp → proof sent on WhatsApp. The cart already knew every number; this is the same
// arithmetic, run where the buyer cannot edit it, so api/orders/create.js can write the order itself.
//
// SAME PRIMITIVES AS THE CART (useCartInternationalQuote): internationalPriceFor → usdPriceFor per bottle,
// quoteInternationalShippingPrice for the parcel. A buyer shown $145 and asked for $150 is the failure.
//
// THE ORDER IS KEPT IN RUPIAH AT THE SHOP'S OWN RATE (USD_PRICE_RATE), because every Studio screen reads
// subtotal as rupiah. totalUsd × rate divides back to exactly totalUsd, and the payment page shows that
// exact figure (paymentAmountUsd below) instead of rounding it up to the next $5.
//
// Relative imports only: the order endpoint runs in Node, where '@/' does not resolve.
import { usdPriceFor, USD_PRICE_RATE } from './usdPrice.js';
import { internationalPriceFor } from './shippingRegion.js';
import { quoteInternationalShippingPrice } from './internationalShippingPrice.js';
import { isCardCountry } from './shippingDestination.js';
import { SHIPPING_RATE_BOTTLE_SIZE_ML } from '../data/internationalShippingRates.js';

const millilitres = (size) => {
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*ml\b/i.exec(String(size || ''));
  return match ? Number(match[1].replace(',', '.')) : null;
};

/**
 * @param country  ISO code the buyer picked (must be on the carrier's card — not ID, not "another country")
 * @param lines    [{ name, size, quantity, retailPrice, tierPrices }] — retailPrice and tierPrices from the
 *                 DATABASE, never from the request
 * @param policy   Dekito's export shipping policy row (or null for the compiled defaults)
 * @returns { ok: false, reason } | { ok: true, lines: [...{ unitUsd, lineUsd }], bottles, goodsUsd,
 *          shippingUsd, totalUsd, transitDays, subtotalIdr, shippingIdr }
 *
 * `reason` is shown to an English buyer, so it says what to do.
 */
export const quoteInternationalOrder = ({ country = '', lines = [], policy = null } = {}) => {
  const code = String(country || '').trim().toUpperCase();
  if (!isCardCountry(code)) {
    return { ok: false, reason: 'Choose the country the parcel goes to.' };
  }
  if (!lines.length) return { ok: false, reason: 'Your cart is empty.' };

  const priced = [];
  for (const line of lines) {
    const quantity = Math.max(1, Math.round(Number(line.quantity) || 0));
    if (millilitres(line.size) !== SHIPPING_RATE_BOTTLE_SIZE_ML) {
      return { ok: false, reason: `${line.name} (${line.size || 'this size'}) is quoted by message. Please ask us on WhatsApp.` };
    }
    const unitUsd = usdPriceFor(internationalPriceFor({ tierPrices: line.tierPrices || {}, linePrice: line.retailPrice }));
    if (!unitUsd) {
      return { ok: false, reason: `${line.name} has no international price yet. Please ask us on WhatsApp.` };
    }
    priced.push({ ...line, quantity, unitUsd, lineUsd: unitUsd * quantity });
  }

  const bottles = priced.reduce((sum, line) => sum + line.quantity, 0);
  const shipping = quoteInternationalShippingPrice({ countryCode: code, bottles, policy });
  if (!shipping?.usd) {
    return { ok: false, reason: 'Shipping for this parcel is quoted by message. Please ask us on WhatsApp.' };
  }

  const goodsUsd = priced.reduce((sum, line) => sum + line.lineUsd, 0);
  const totalUsd = goodsUsd + shipping.usd;
  return {
    ok: true,
    country: code,
    lines: priced,
    bottles,
    goodsUsd,
    shippingUsd: shipping.usd,
    totalUsd,
    transitDays: shipping.transitDays || null,
    subtotalIdr: totalUsd * USD_PRICE_RATE,
    shippingIdr: shipping.usd * USD_PRICE_RATE,
  };
};

/**
 * The dollars a payment page asks for. An order written by quoteInternationalOrder divides back exactly;
 * anything else (an order Studio wrote in rupiah) keeps the shop's usual round-up to $5.
 */
export const paymentAmountUsd = (amountIdr) => {
  const amount = Number(amountIdr);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Number.isInteger(amount / USD_PRICE_RATE) ? amount / USD_PRICE_RATE : usdPriceFor(amount);
};
