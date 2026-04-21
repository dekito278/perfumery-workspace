const API_BASE_URL = '/api';

export const importScentreeByUrl = async (url) => {
	const response = await fetch(`${API_BASE_URL}/imports/scentree`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ url }),
	});

	const payload = await response.json().catch(() => ({}));

	if (!response.ok) {
		throw new Error(payload?.message || 'Failed to import ScenTree data');
	}

	return payload;
};

export const importPerfumersWorldByUrl = async (url) => {
	const response = await fetch(`${API_BASE_URL}/imports/perfumersworld`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ url }),
	});

	const payload = await response.json().catch(() => ({}));

	if (!response.ok) {
		throw new Error(payload?.message || 'Failed to import PerfumersWorld data');
	}

	return payload;
};
