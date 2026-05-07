import process from 'node:process';

const jsonResponse = (response, status, body) => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
};

const getRajaOngkirBaseUrl = () => String(process.env.RAJAONGKIR_BASE_URL || 'https://rajaongkir.komerce.id/api/v1').replace(/\/$/, '');

const normalizeDestination = (item) => ({
  id: String(item.id || item.destination_id || ''),
  label: item.label || [
    item.subdistrict_name,
    item.district_name,
    item.city_name,
    item.province_name,
    item.zip_code,
  ].filter(Boolean).join(', '),
  provinceName: item.province_name || item.province || '',
  cityName: item.city_name || item.city || '',
  districtName: item.district_name || item.district || '',
  subdistrictName: item.subdistrict_name || item.subdistrict || '',
  zipCode: item.zip_code || item.postal_code || '',
});

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return jsonResponse(response, 405, { message: 'Method not allowed' });
  }

  const apiKey = String(process.env.RAJAONGKIR_API_KEY || '').trim();
  if (!apiKey) {
    return jsonResponse(response, 500, {
      message: 'Shipping API is not configured. Set RAJAONGKIR_API_KEY.',
    });
  }

  const requestUrl = new URL(request.url, 'http://localhost');
  const search = String(requestUrl.searchParams.get('search') || '').trim();
  if (search.length < 3) {
    return jsonResponse(response, 400, { message: 'Search must be at least 3 characters' });
  }

  try {
    const rajaUrl = new URL(`${getRajaOngkirBaseUrl()}/destination/domestic-destination`);
    rajaUrl.searchParams.set('search', search);
    rajaUrl.searchParams.set('limit', String(process.env.RAJAONGKIR_DESTINATION_LIMIT || 8));
    rajaUrl.searchParams.set('offset', '0');

    const rajaResponse = await fetch(rajaUrl, {
      method: 'GET',
      headers: {
        key: apiKey,
      },
    });
    const data = await rajaResponse.json().catch(() => ({}));

    if (!rajaResponse.ok) {
      return jsonResponse(response, rajaResponse.status, {
        message: data?.meta?.message || data?.message || 'Failed to search shipping destination',
      });
    }

    const destinations = (Array.isArray(data.data) ? data.data : [])
      .map(normalizeDestination)
      .filter((destination) => destination.id && destination.label);

    return jsonResponse(response, 200, { destinations });
  } catch (error) {
    return jsonResponse(response, 500, {
      message: error.message || 'Unexpected shipping destination error',
    });
  }
}
