const TGSC_HOSTS = new Set(['www.thegoodscentscompany.com', 'thegoodscentscompany.com']);

const decodeHtmlEntities = (value) => String(value || '')
	.replace(/&nbsp;/g, ' ')
	.replace(/&amp;/g, '&')
	.replace(/&quot;/g, '"')
	.replace(/&#39;/g, "'")
	.replace(/&#176;/g, '\u00B0')
	.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
	.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
	.replace(/&lt;/g, '<')
	.replace(/&gt;/g, '>')
	.replace(/<[^>]+>/g, ' ')
	.replace(/\s+/g, ' ')
	.trim();

const normalizeNumber = (value) => {
	if (value === null || value === undefined || value === '') {
		return null;
	}

	const numericValue = Number(String(value).replace(',', '.'));
	return Number.isFinite(numericValue) ? numericValue : null;
};

const extractLineValue = (html, label) => {
	const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const directMatch = html.match(new RegExp(`${escapedLabel}:\\s*([^\\n<]+)`, 'i'));
	const directValue = decodeHtmlEntities(directMatch?.[1] || '');
	if (directValue) {
		return directValue;
	}

	const cellMatch = html.match(new RegExp(`${escapedLabel}:?\\s*<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, 'i'));
	const cellValue = decodeHtmlEntities(cellMatch?.[1] || '');
	if (cellValue) {
		return cellValue;
	}

	const spanMatch = html.match(new RegExp(`${escapedLabel}:\\s*<span[^>]*>([\\s\\S]*?)<\\/span>`, 'i'));
	return decodeHtmlEntities(spanMatch?.[1] || '');
};

const mapTgscFamily = (text) => {
	const normalized = String(text || '').toLowerCase();

	if (normalized.includes('jasmin') || normalized.includes('jasmine')) return 'JASMIN';
	if (normalized.includes('rose')) return 'ROSE';
	if (normalized.includes('muguet') || normalized.includes('lily')) return 'MUGUET';
	if (normalized.includes('floral')) return 'LIGHT CHEMICAL FLORAL';
	if (normalized.includes('woody') || normalized.includes('cedar') || normalized.includes('sandal')) return 'WOOD';
	if (normalized.includes('citrus')) return 'CITRUS';
	if (normalized.includes('fruit') || normalized.includes('melon') || normalized.includes('apple') || normalized.includes('peach') || normalized.includes('berry')) return 'FRUIT';
	if (normalized.includes('green') || normalized.includes('leafy')) return 'GREEN';
	if (normalized.includes('musk')) return 'MUSK';
	if (normalized.includes('herbal') || normalized.includes('aromatic')) return 'HERB';
	if (normalized.includes('animal')) return 'ANIMAL';
	if (normalized.includes('amber') || normalized.includes('resin') || normalized.includes('balsam')) return 'QUEEN OF THE ORIENT';

	return null;
};

const inferImpactFromOdorStrength = (odorStrength) => {
	const normalized = String(odorStrength || '').toLowerCase();
	if (!normalized) {
		return null;
	}

	if (normalized.includes('extreme') || normalized.includes('very high')) return 260;
	if (normalized.includes('high')) return 180;
	if (normalized.includes('very strong')) return 280;
	if (normalized.includes('strong')) return 220;
	if (normalized.includes('medium strong')) return 180;
	if (normalized.includes('medium')) return 140;
	if (normalized.includes('low')) return 70;
	if (normalized.includes('mild')) return 100;
	if (normalized.includes('weak')) return 70;

	return null;
};

const inferImpactFromSmellingRecommendation = (html) => {
	const match = String(html || '').match(/([0-9]+(?:[.,][0-9]+)?)\s*%\s*solution\s*or\s*less/i);
	const percent = normalizeNumber(match?.[1]);
	if (percent === null) {
		return null;
	}

	if (percent <= 0.1) return 320;
	if (percent <= 1) return 250;
	if (percent <= 5) return 200;
	if (percent <= 10) return 160;
	if (percent <= 25) return 120;
	return null;
};

const buildDescription = ({ title, odorType, odorDescription }) => {
	const parts = [
		title ? `${title} from The Good Scents Company.` : '',
		odorType ? `Odor type: ${odorType}.` : '',
		odorDescription ? `Odor description: ${odorDescription}.` : '',
	].filter(Boolean);

	return parts.join(' ').trim() || null;
};

const readRequestBody = async (req) => {
	if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
		return req.body;
	}

	if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
		return JSON.parse(req.body.toString('utf8') || '{}');
	}

	const chunks = [];
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
	}

	const rawBody = Buffer.concat(chunks).toString('utf8');
	return rawBody ? JSON.parse(rawBody) : {};
};

const importTgscByUrl = async (url) => {
	const parsedUrl = new URL(String(url || '').trim());
	if (!TGSC_HOSTS.has(parsedUrl.hostname)) {
		const error = new Error('Only The Good Scents Company URLs are supported');
		error.statusCode = 400;
		throw error;
	}

	const response = await fetch(parsedUrl.toString(), {
		headers: {
			'User-Agent': 'PerfumerStudio/1.0 (+internal reference importer)',
			'Accept-Language': 'en-US,en;q=0.9',
		},
	});

	if (!response.ok) {
		const error = new Error(`Failed to load TGSC page (${response.status})`);
		error.statusCode = 502;
		throw error;
	}

	const html = await response.text();
	const title = decodeHtmlEntities(
		html.match(/<h1[^>]*>[\s\S]*?<span[^>]*itemprop="name"[^>]*>([\s\S]*?)<\/span>/i)?.[1]
		|| html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
		|| '',
	).replace(/\s*,\s*[0-9]{2,7}-[0-9]{2}-[0-9]\s*$/, '');
	const casNumber = extractLineValue(html, 'CAS Number');
	const odorType = extractLineValue(html, 'Odor Type');
	const odorStrength = extractLineValue(html, 'Odor Strength');
	const odorDescription = decodeHtmlEntities(
		html.match(/Odor Description:\s*<span[^>]*>[\s\S]*?<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/i)?.[1]
		|| html.match(/Odor Description:\s*<span[^>]*>([\s\S]*?)<\/span>/i)?.[1]
		|| '',
	);
	const substantivityHours = normalizeNumber(html.match(/Substantivity:\s*<span[^>]*>\s*([0-9]+(?:[.,][0-9]+)?)\s*hour/i)?.[1]);
	const odorStrengthImpact = inferImpactFromOdorStrength(odorStrength);
	const recommendationImpact = inferImpactFromSmellingRecommendation(html);
	const referenceImpact = Math.max(odorStrengthImpact || 0, recommendationImpact || 0) || null;

	return {
		source: 'tgsc',
		source_kind: 'tgsc',
		source_url: parsedUrl.toString(),
		url: parsedUrl.toString(),
		extracted_at: new Date().toISOString(),
		review_status: 'provisional_external',
		name: title || null,
		reference_code: `EXT-TGSC-${(casNumber || title || 'UNMAPPED').replace(/[^A-Za-z0-9]+/g, '').slice(0, 12).toUpperCase()}`,
		workbook_code: null,
		cas_number: casNumber || null,
		ifra_limit: null,
		ifra_notes: 'TGSC page tidak menampilkan numeric IFRA limit secara langsung pada field yang diimport.',
		reference_abc_primary_family: mapTgscFamily(`${odorType} ${odorDescription} ${title}`),
		reference_impact: referenceImpact,
		reference_life_hours: substantivityHours,
		reference_impact_source: referenceImpact !== null ? 'heuristic' : null,
		reference_life_hours_source: substantivityHours !== null ? 'explicit' : null,
		reference_use_level_typical_percent: null,
		reference_use_level_max_percent: null,
		description: buildDescription({ title, odorType, odorDescription }),
		odor_type: odorType || null,
		odor_strength: odorStrength || null,
		odor_description: odorDescription || null,
		substantivity_hours: substantivityHours,
	};
};

module.exports = async (req, res) => {
	res.setHeader('Content-Type', 'application/json');

	if (req.method !== 'POST') {
		res.statusCode = 405;
		res.end(JSON.stringify({ message: 'Method not allowed' }));
		return;
	}

	try {
		const body = await readRequestBody(req);
		const url = String(body?.url || '').trim();
		if (!url) {
			res.statusCode = 400;
			res.end(JSON.stringify({ message: 'URL is required' }));
			return;
		}

		const payload = await importTgscByUrl(url);
		res.statusCode = 200;
		res.end(JSON.stringify(payload));
	} catch (error) {
		res.statusCode = error.statusCode || 500;
		res.end(JSON.stringify({ message: error.message || 'Something went wrong!' }));
	}
};
