const API_BASE_URL = '/api';

// The three URL importers are served by a Vite dev plugin (vite.config.js: scentreeImportDevPlugin, loaded
// only when isDev). Production has no /api/imports/* handler, and vercel.json rewrites /api/(.*) to
// not-found — so every import button returned a 404 the UI reported as a generic failure. Fail with the
// truth instead, and let the UI hide the buttons entirely (audit round 8).
export const URL_IMPORT_AVAILABLE = Boolean(import.meta.env?.DEV);

const assertUrlImportAvailable = () => {
  if (!URL_IMPORT_AVAILABLE) {
    throw new Error('Import via URL hanya tersedia saat menjalankan dev server — belum ada endpoint-nya di production.');
  }
};

const parseImportResponse = async (response, fallbackMessage) => {
	const responseText = await response.text();
	let payload = {};

	if (responseText) {
		try {
			payload = JSON.parse(responseText);
		} catch {
			payload = {};
		}
	}

	if (!response.ok) {
		throw new Error(payload?.message || `${fallbackMessage} (${response.status})`);
	}

	return payload;
};

const importPerfumersWorldByGet = async (url) => {
	const query = new URLSearchParams({ url });
	const response = await fetch(`${API_BASE_URL}/imports/perfumersworld?${query.toString()}`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
		},
	});

	return parseImportResponse(response, 'Failed to import PerfumersWorld data');
};

export const buildPerfumersWorldUrlFromWorkbookCode = (workbookCode) => {
	const normalizedCode = String(workbookCode || '').trim().toUpperCase();
	if (!normalizedCode) {
		return '';
	}

	return `https://www.perfumersworld.com/view.php?pro_id=${encodeURIComponent(normalizedCode)}`;
};

export const importScentreeByUrl = async (url) => {
	assertUrlImportAvailable();
	const response = await fetch(`${API_BASE_URL}/imports/scentree`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ url }),
	});

	return parseImportResponse(response, 'Failed to import ScenTree data');
};

export const importPerfumersWorldByUrl = async (url) => {
	assertUrlImportAvailable();
	const response = await fetch(`${API_BASE_URL}/imports/perfumersworld`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ url }),
	});

	if (response.status === 405) {
		return importPerfumersWorldByGet(url);
	}

	return parseImportResponse(response, 'Failed to import PerfumersWorld data');
};

export const importTgscByUrl = async (url) => {
	assertUrlImportAvailable();
	const response = await fetch(`${API_BASE_URL}/imports/tgsc`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ url }),
	});

	return parseImportResponse(response, 'Failed to import TGSC data');
};
