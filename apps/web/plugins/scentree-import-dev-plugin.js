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

export default function scentreeImportDevPlugin() {
	return {
		name: 'scentree-import-dev-plugin',
		configureServer(server) {
			server.middlewares.use('/api/imports/scentree', async (req, res, next) => {
				if (req.method !== 'POST') {
					return next();
				}

				try {
					const body = await readJsonBody(req);
					const url = String(body?.url || '').trim();
					if (!url) {
						return sendJson(res, 400, { message: 'URL is required' });
					}

					const payload = await importScentreeByUrl(url);
					return sendJson(res, 200, payload);
				} catch (error) {
					return sendJson(res, error.statusCode || 500, {
						message: error.message || 'Something went wrong!',
					});
				}
			});

			server.middlewares.use('/api/imports/perfumersworld', async (req, res, next) => {
				if (!['GET', 'POST'].includes(req.method)) {
					return next();
				}

				try {
					const requestUrl = new URL(req.url || '/', 'http://localhost');
					const body = req.method === 'POST' ? await readJsonBody(req) : {};
					const url = String(body?.url || requestUrl.searchParams.get('url') || '').trim();
					if (!url) {
						return sendJson(res, 400, { message: 'URL is required' });
					}

					const payload = await importPerfumersWorldByUrl(url);
					return sendJson(res, 200, payload);
				} catch (error) {
					return sendJson(res, error.statusCode || 500, {
						message: error.message || 'Something went wrong!',
					});
				}
			});

			server.middlewares.use('/api/imports/tgsc', async (req, res, next) => {
				if (req.method !== 'POST') {
					return next();
				}

				try {
					const body = await readJsonBody(req);
					const url = String(body?.url || '').trim();
					if (!url) {
						return sendJson(res, 400, { message: 'URL is required' });
					}

					const payload = await importTgscByUrl(url);
					return sendJson(res, 200, payload);
				} catch (error) {
					return sendJson(res, error.statusCode || 500, {
						message: error.message || 'Something went wrong!',
					});
				}
			});
		},
	};
}
