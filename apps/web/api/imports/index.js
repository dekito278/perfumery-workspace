// One endpoint for all three material reference sources, selected by `source`.
//
// It started as three route files, which pushed the deployment to 13 serverless functions — one over the
// Vercel Hobby ceiling of 12, and the deploy failed. Three files that differed only in which scraper they
// called did not earn three functions anyway (audit round 8).
//
// Admin-only: it makes outbound requests on the deployment's behalf and exists purely to serve the studio.
// The scrapers each reject any host outside their own allowlist, so the URL is never attacker-chosen
// beyond those three domains.
import { Buffer } from 'node:buffer';
import { assertAdmin } from '../../src/utils/apiAdminAuth.js';
import {
  importPerfumersWorldByUrl,
  importScentreeByUrl,
  importTgscByUrl,
} from '../../src/utils/materialImportScrapers.js';

const SCRAPERS = {
  scentree: importScentreeByUrl,
  perfumersworld: importPerfumersWorldByUrl,
  tgsc: importTgscByUrl,
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
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
};

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return jsonResponse(response, 405, { message: 'Method not allowed' });
  }

  try {
    await assertAdmin(request);

    const query = new URL(request.url || '/', 'http://localhost').searchParams;
    const body = request.method === 'POST' ? await readBody(request) : {};
    const source = String(body?.source || query.get('source') || '').trim().toLowerCase();
    const url = String(body?.url || query.get('url') || '').trim();

    const scrape = SCRAPERS[source];
    if (!scrape) {
      return jsonResponse(response, 400, { message: `Unknown import source: ${source || '(none)'}` });
    }
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
}
