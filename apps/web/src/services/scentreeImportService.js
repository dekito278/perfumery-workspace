import supabase from '@/lib/supabaseClient.js';

const API_BASE_URL = '/api';

// These now run as real serverless functions in apps/web/api/imports/, sharing the scrapers with the Vite
// dev plugin. They were dev-only middleware before, so every import button 404'd in production
// (audit round 8). The endpoints are admin-only, so the studio session's token rides along.
export const URL_IMPORT_AVAILABLE = true;

const authHeaders = async () => {
  const { data: { session } = {} } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error('Sesi studio berakhir. Masuk lagi untuk mengimpor dari URL.');
  }
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` };
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
		headers: { ...(await authHeaders()), Accept: 'application/json' },
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
	const response = await fetch(`${API_BASE_URL}/imports/scentree`, {
		method: 'POST',
		headers: await authHeaders(),
		body: JSON.stringify({ url }),
	});

	return parseImportResponse(response, 'Failed to import ScenTree data');
};

export const importPerfumersWorldByUrl = async (url) => {
	const response = await fetch(`${API_BASE_URL}/imports/perfumersworld`, {
		method: 'POST',
		headers: await authHeaders(),
		body: JSON.stringify({ url }),
	});

	if (response.status === 405) {
		return importPerfumersWorldByGet(url);
	}

	return parseImportResponse(response, 'Failed to import PerfumersWorld data');
};

export const importTgscByUrl = async (url) => {
	const response = await fetch(`${API_BASE_URL}/imports/tgsc`, {
		method: 'POST',
		headers: await authHeaders(),
		body: JSON.stringify({ url }),
	});

	return parseImportResponse(response, 'Failed to import TGSC data');
};
