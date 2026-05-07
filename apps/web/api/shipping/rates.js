import { Buffer } from 'node:buffer';
import process from 'node:process';

const DEFAULT_COURIERS = ['jnt', 'jne', 'pos', 'anteraja', 'ide'];

const courierNames = {
  jne: 'JNE',
  jnt: 'JnT',
  anteraja: 'ANTERAJA',
  ide: 'IDEXPRES',
  pos: 'POS',
};

const blockedLightParcelServices = [
  /\bjtr\b/i,
  /truck/i,
  /dangerous/i,
  /valuable/i,
  /\bpdg\b/i,
  /\bpvg\b/i,
];

const serviceNames = {
  ctc: 'Reguler',
  ctcyes: 'YES',
  ctcsps: 'Super Speed',
  ez: 'Reguler',
  nd: 'Next Day',
  reg: 'Reguler',
  sd: 'Same Day',
  std: 'Reguler',
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

const getServiceLabel = ({ service, description }) => {
  const rawService = String(service || '').trim();
  const normalizedService = rawService.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (serviceNames[normalizedService]) {
    return serviceNames[normalizedService];
  }

  const rawDescription = String(description || '').trim();
  if (rawDescription && !/^\d+$/.test(rawDescription) && rawDescription.toLowerCase() !== normalizedService) {
    return rawDescription
      .replace(/\b(reg|std|ez)\b/gi, 'Reguler')
      .replace(/\b(nd)\b/gi, 'Next Day')
      .replace(/\b(sd)\b/gi, 'Same Day');
  }

  if (/^[A-Z0-9-]{2,8}$/.test(rawService)) {
    return 'Reguler';
  }

  return rawService || 'Reguler';
};

const normalizeRate = (item) => {
  const courierCode = String(item.code || item.courier || item.shipping_code || '').toLowerCase();
  const service = item.service || item.service_name || '';
  const description = item.description || item.service_description || '';
  return {
    courierCode,
    courierName: courierNames[courierCode] || item.name || item.courier_name || courierCode.toUpperCase(),
    service,
    serviceLabel: getServiceLabel({ service, description }),
    description,
    etd: item.etd || item.duration || '',
    cost: Number(item.cost || item.price || item.value || 0),
  };
};

const isLightParcelRate = (rate) => {
  const searchableText = [
    rate.service,
    rate.description,
    rate.courierName,
  ].filter(Boolean).join(' ');

  return !blockedLightParcelServices.some((pattern) => pattern.test(searchableText));
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return jsonResponse(response, 405, { message: 'Method not allowed' });
  }

  const apiKey = String(process.env.RAJAONGKIR_API_KEY || '').trim();
  const origin = String(process.env.RAJAONGKIR_ORIGIN_ID || process.env.RAJAONGKIR_ORIGIN_DISTRICT_ID || '').trim();
  if (!apiKey || !origin) {
    const missing = [
      !apiKey ? 'RAJAONGKIR_API_KEY' : '',
      !origin ? 'RAJAONGKIR_ORIGIN_ID' : '',
    ].filter(Boolean).join(' and ');
    return jsonResponse(response, 500, {
      message: `Shipping API is not configured. Set ${missing}.`,
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
      .filter(isLightParcelRate)
      .sort((first, second) => first.cost - second.cost);

    return jsonResponse(response, 200, { rates });
  } catch (error) {
    return jsonResponse(response, 500, {
      message: error.message || 'Unexpected shipping rate error',
    });
  }
}
