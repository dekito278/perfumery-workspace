import {
  applyShippingPromotionToRates,
  getShippingPromotionSettings,
} from '@/services/shippingPromotionService.js';

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
    getShippingPromotionSettings(),
    { subtotal },
  );
};

export const getCheckoutShippingWeight = (items) => {
  const defaultItemWeight = Number(import.meta.env.VITE_DEFAULT_ITEM_WEIGHT_GRAM || 300);
  const quantity = Array.isArray(items)
    ? items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    : 0;

  return Math.max(quantity * defaultItemWeight, defaultItemWeight);
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
