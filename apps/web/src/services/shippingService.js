import {
  applyShippingPromotionToRates,
  getShippingPromotionSettingsAsync,
} from '@/services/shippingPromotionService.js';
import { DEFAULT_ITEM_WEIGHT_GRAM, totalItemWeightGram } from '@/utils/itemWeight.js';

export const SHIPPING_STORAGE_KEY = 'solivagant.checkout.shipping.v1';

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Shipping service is unavailable');
  }

  return data;
};

export const searchShippingDestinations = async (query) => {
  const search = String(query || '').trim();
  if (search.length < 3) {
    return [];
  }

  const data = await requestJson(`/api/shipping/destinations?search=${encodeURIComponent(search)}`);
  return Array.isArray(data.destinations) ? data.destinations : [];
};

export const getShippingRates = async ({
  destinationId,
  destination,
  destinationLabel,
  subtotal,
  weight,
  couriers,
}) => {
  const data = await requestJson('/api/shipping/rates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      destinationId,
      weight,
      couriers,
    }),
  });

  const rates = Array.isArray(data.rates) ? data.rates : [];
  const promotionDestination = destination || { id: destinationId, label: destinationLabel };

  return applyShippingPromotionToRates(
    rates,
    promotionDestination,
    // Hydrate promo settings from the DB at checkout — the sync cache is empty on a customer's device,
    // so reading it here meant configured promos never applied for anyone but the admin.
    await getShippingPromotionSettingsAsync(),
    { subtotal },
  );
};

export const getCheckoutShippingWeight = (items) => {
  // Weight is per SIZE now, from the one table the order endpoint also reads — a 10 ml is 100 g and a
  // 100 ml is 650 g, not 300 g each. The env value is only the fallback for a size nobody weighed.
  // assertPairedEnvAgrees() in tools/build.mjs fails the build if the two sides' fallback disagrees.
  const fallback = Number(import.meta.env.VITE_DEFAULT_ITEM_WEIGHT_GRAM || DEFAULT_ITEM_WEIGHT_GRAM);
  return totalItemWeightGram(items, fallback);
};

export const describeShippingRate = (rate) => {
  if (!rate) return '';

  return [
    `${rate.courierName || rate.courierCode || 'Courier'} ${rate.serviceLabel || rate.service || ''}`.trim(),
    rate.etd ? `ETA ${rate.etd}` : '',
    `Rp ${new Intl.NumberFormat('id-ID').format(Number(rate.cost || 0))}`,
    rate.promotionApplied ? rate.promotionLabel : '',
  ].filter(Boolean).join(' / ');
};
