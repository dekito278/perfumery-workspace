import supabase from '@/lib/supabaseClient.js';

const API_BASE_URL = '/api';

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

// All three sources share one endpoint (api/imports/index.js) — three route files would have put the
// deployment one over the Vercel Hobby serverless-function ceiling.
const importBySource = async (source, url, fallbackMessage) => {
	const response = await fetch(`${API_BASE_URL}/imports`, {
		method: 'POST',
		headers: await authHeaders(),
		body: JSON.stringify({ source, url }),
	});

	return parseImportResponse(response, fallbackMessage);
};

export const importScentreeByUrl = (url) => importBySource('scentree', url, 'Failed to import ScenTree data');

export const importPerfumersWorldByUrl = (url) => importBySource('perfumersworld', url, 'Failed to import PerfumersWorld data');

export const importTgscByUrl = (url) => importBySource('tgsc', url, 'Failed to import TGSC data');
