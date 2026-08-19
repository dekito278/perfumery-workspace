import { Buffer } from 'node:buffer';
import {
	importPerfumersWorldByUrl,
	importScentreeByUrl,
	importTgscByUrl,
} from '../src/utils/materialImportScrapers.js';

const sendJson = (res, statusCode, payload) => {
	res.statusCode = statusCode;
	res.setHeader('Content-Type', 'application/json');
	res.end(JSON.stringify(payload));
};

const readJsonBody = async (req) => {
	const chunks = [];
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
	}

	const rawBody = Buffer.concat(chunks).toString('utf8');
	return rawBody ? JSON.parse(rawBody) : {};
};

const SCRAPERS = {
	scentree: importScentreeByUrl,
	perfumersworld: importPerfumersWorldByUrl,
	tgsc: importTgscByUrl,
};

export default function scentreeImportDevPlugin() {
	return {
		name: 'scentree-import-dev-plugin',
		configureServer(server) {
			// Mirrors api/imports/index.js: one path, source chosen by the payload.
			server.middlewares.use('/api/imports', async (req, res, next) => {
				if (!['GET', 'POST'].includes(req.method)) {
					return next();
				}

				try {
					const query = new URL(req.url || '/', 'http://localhost').searchParams;
					const body = req.method === 'POST' ? await readJsonBody(req) : {};
					const source = String(body?.source || query.get('source') || '').trim().toLowerCase();
					const url = String(body?.url || query.get('url') || '').trim();

					const scrape = SCRAPERS[source];
					if (!scrape) {
						return sendJson(res, 400, { message: `Unknown import source: ${source || '(none)'}` });
					}
					if (!url) {
						return sendJson(res, 400, { message: 'URL is required' });
					}

					return sendJson(res, 200, await scrape(url));
				} catch (error) {
					return sendJson(res, error.statusCode || 500, {
						message: error.message || 'Something went wrong!',
					});
				}
			});
		},
	};
}
