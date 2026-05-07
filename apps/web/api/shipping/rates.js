import { Buffer } from 'node:buffer';
import process from 'node:process';

const DEFAULT_COURIERS = ['jne', 'jnt', 'sicepat', 'anteraja', 'ninja', 'tiki', 'pos'];

const courierNames = {
  jne: 'JNE',
  jnt: 'J&T',
  sicepat: 'SiCepat',
  anteraja: 'Anteraja',
  ninja: 'Ninja',
  tiki: 'TIKI',
  pos: 'POS Indonesia',
};

const jsonResponse = (response, status, body) => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
};

const readBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
};

const getRajaOngkirBaseUrl = () => String(process.env.RAJAONGKIR_BASE_URL || 'https://rajaongkir.komerce.id/api/v1').replace(/\/$/, '');

const getAllowedCouriers = () => String(process.env.RAJAONGKIR_COURIERS || DEFAULT_COURIERS.join(':'))
  .split(':')
  .map((courier) => courier.trim().toLowerCase())
  .filter(Boolean);

const normalizeRate = (item) => {
  const courierCode = String(item.code || item.courier || item.shipping_code || '').toLowerCase();
  return {
    courierCode,
    courierName: item.name || item.courier_name || courierNames[courierCode] || courierCode.toUpperCase(),
    service: item.service || item.service_name || '',
    description: item.description || item.service_description || '',
    etd: item.etd || item.duration || '',
    cost: Number(item.cost || item.price || item.value || 0),
  };
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return jsonResponse(response, 405, { message: 'Method not allowed' });
  }

  const apiKey = process.env.RAJAONGKIR_API_KEY;
  const origin = process.env.RAJAONGKIR_ORIGIN_ID || process.env.RAJAONGKIR_ORIGIN_DISTRICT_ID;
  if (!apiKey || !origin) {
    return jsonResponse(response, 500, {
      message: 'Shipping API is not configured. Set RAJAONGKIR_API_KEY and RAJAONGKIR_ORIGIN_ID.',
    });
  }

  try {
    const rawBody = await readBody(request);
    const input = rawBody ? JSON.parse(rawBody) : {};
    const destinationId = String(input.destinationId || '').trim();
    const weight = Math.max(Number(input.weight || process.env.RAJAONGKIR_DEFAULT_WEIGHT_GRAM || 300), 1);
    const allowedCouriers = getAllowedCouriers();
    const requestedCouriers = Array.isArray(input.couriers)
      ? input.couriers.map((courier) => String(courier).trim().toLowerCase()).filter(Boolean)
      : allowedCouriers;
    const couriers = requestedCouriers.filter((courier) => allowedCouriers.includes(courier));

    if (!destinationId || !couriers.length) {
      return jsonResponse(response, 400, { message: 'Destination and courier are required' });
    }

    const form = new URLSearchParams({
      origin: String(origin),
      destination: destinationId,
      weight: String(Math.round(weight)),
      courier: couriers.join(':'),
      price: 'lowest',
    });

    const rajaResponse = await fetch(`${getRajaOngkirBaseUrl()}${process.env.RAJAONGKIR_COST_PATH || '/calculate/domestic-cost'}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        key: apiKey,
      },
      body: form.toString(),
    });
    const data = await rajaResponse.json().catch(() => ({}));

    if (!rajaResponse.ok) {
      return jsonResponse(response, rajaResponse.status, {
        message: data?.meta?.message || data?.message || 'Failed to calculate shipping rates',
      });
    }

    const rates = (Array.isArray(data.data) ? data.data : [])
      .map(normalizeRate)
      .filter((rate) => rate.courierCode && rate.service && rate.cost > 0)
      .sort((first, second) => first.cost - second.cost);

    return jsonResponse(response, 200, { rates });
  } catch (error) {
    return jsonResponse(response, 500, {
      message: error.message || 'Unexpected shipping rate error',
    });
  }
}
