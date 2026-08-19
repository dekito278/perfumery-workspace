// Shared plumbing for the three material-import endpoints. Underscore-prefixed so Vercel does not turn it
// into a route of its own.
import { Buffer } from 'node:buffer';
import { assertAdmin } from '../../src/utils/apiAdminAuth.js';

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
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
};

// The scrapers already reject any host outside their own allowlist, so the URL is never attacker-chosen
// beyond those three domains — but the endpoint is still admin-only: it makes outbound requests on the
// deployment's behalf, and it exists purely to serve the studio.
export const createImportHandler = ({ allowGet = false, scrape }) => async (request, response) => {
  const allowed = allowGet ? ['GET', 'POST'] : ['POST'];
  if (!allowed.includes(request.method)) {
    response.setHeader('Allow', allowed.join(', '));
    return jsonResponse(response, 405, { message: 'Method not allowed' });
  }

  try {
    await assertAdmin(request);

    const body = request.method === 'POST' ? await readBody(request) : {};
    const queryUrl = allowGet
      ? new URL(request.url || '/', 'http://localhost').searchParams.get('url')
      : '';
    const url = String(body?.url || queryUrl || '').trim();
    if (!url) {
      return jsonResponse(response, 400, { message: 'URL is required' });
    }

    return jsonResponse(response, 200, await scrape(url));
  } catch (error) {
    const status = error.statusCode || 502;
    if (status >= 500) {
      console.error('Material import failed:', error.message || error);
      return jsonResponse(response, status, { message: 'Import gagal. Cek URL-nya, lalu coba lagi.' });
    }
    return jsonResponse(response, status, { message: error.message || 'Import gagal' });
  }
};
