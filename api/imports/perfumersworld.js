const PERFUMERSWORLD_HOSTS = new Set(['www.perfumersworld.com', 'perfumersworld.com']);

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

const extractFirstNumber = (html, expressions) => {
	for (const expression of expressions) {
		const match = html.match(expression);
		const numericValue = normalizeNumber(match?.[1]);
		if (numericValue !== null) {
			return numericValue;
		}
	}

	return null;
};

const mapPerfumersWorldFamily = (text) => {
	const normalized = String(text || '').toLowerCase();

	if (normalized.includes('muguet') || normalized.includes('lily of the valley')) return 'MUGUET';
	if (normalized.includes('jasmin') || normalized.includes('jasmine')) return 'JASMIN';
	if (normalized.includes('rose')) return 'ROSE';
	if (normalized.includes('fruity') || normalized.includes('melon') || normalized.includes('peach') || normalized.includes('strawberry')) return 'FRUIT';
	if (normalized.includes('green')) return 'GREEN';
	if (normalized.includes('citrus')) return 'CITRUS';
	if (normalized.includes('woody') || normalized.includes('wood')) return 'WOOD';
	if (normalized.includes('musk')) return 'MUSK';
	if (normalized.includes('herbal')) return 'HERB';
	if (normalized.includes('floral') || normalized.includes('flower') || normalized.includes('magnolia') || normalized.includes('tuberose')) return 'LIGHT CHEMICAL FLORAL';

	return null;
};

const buildDescription = ({ title, odourText, perfumeUsesText }) => {
	const parts = [
		title ? `${title} from PerfumersWorld.` : '',
		odourText ? `Odour: ${odourText}` : '',
		perfumeUsesText ? `Perfume uses: ${perfumeUsesText}` : '',
	].filter(Boolean);

	return parts.join(' ').trim() || null;
};

const extractUsageBlockPercent = (html, label) => {
	const labelIndex = html.search(new RegExp(`description-text[^>]*>\\s*${label}\\s*<`, 'i'));
	if (labelIndex < 0) {
		return null;
	}

	const windowStart = Math.max(0, labelIndex - 300);
	const snippet = html.slice(windowStart, labelIndex);
	const matches = [...snippet.matchAll(/([0-9]+(?:[.,][0-9]+)?)\s*%/gi)];
	const lastMatch = matches.at(-1);
	return normalizeNumber(lastMatch?.[1]);
};

const importPerfumersWorldByUrl = async (url) => {
	const parsedUrl = new URL(String(url || '').trim());
	if (!PERFUMERSWORLD_HOSTS.has(parsedUrl.hostname)) {
		const error = new Error('Only PerfumersWorld URLs are supported');
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
		const error = new Error(`Failed to load PerfumersWorld page (${response.status})`);
		error.statusCode = 502;
		throw error;
	}

	const html = await response.text();
	const title = decodeHtmlEntities(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
	const sku = decodeHtmlEntities(html.match(/<h5><small>\s*SKU\s*<\/small>\s*([A-Z0-9-]+)<\/h5>/i)?.[1] || '');
	const casNumber = decodeHtmlEntities(html.match(/<td>\s*CAS No\.\s*<\/td>\s*<td>\s*([0-9]{2,7}-[0-9]{2}-[0-9])\s*<\/td>/i)?.[1] || '');
	const odourText = decodeHtmlEntities(html.match(/Odou?r=>\s*([\s\S]*?)Perfume-Uses=>/i)?.[1] || '');
	const perfumeUsesText = decodeHtmlEntities(html.match(/Perfume-Uses=>\s*([\s\S]*?)Blends-well-with=>/i)?.[1] || '');
	const impact = extractFirstNumber(html, [/Relative\s+Odou?r\s+Impact[\s\S]{0,200}?<span[^>]*pull-right[^>]*>\s*([0-9]+(?:[.,][0-9]+)?)\s*<\/span>/i]);
	const lifeHours = extractFirstNumber(html, [/Odou?r\s+Life\s+on\s+a\s+smelling\s+strip[\s\S]{0,200}?<span[^>]*pull-right[^>]*>\s*([0-9]+(?:[.,][0-9]+)?)\s*hrs?/i]);
	const useLevelTypical = extractUsageBlockPercent(html, 'Average');
	const useLevelMax = extractUsageBlockPercent(html, 'Maximum');
	const ifraText = decodeHtmlEntities(html.match(/DOCUMENTATION\s+IFRA\s+Status[\s\S]{0,120}/i)?.[0] || '');

	return {
		source: 'perfumersworld',
		url: parsedUrl.toString(),
		name: title || null,
		workbook_code: sku || null,
		cas_number: casNumber || null,
		ifra_limit: null,
		ifra_notes: ifraText || 'IFRA status tersedia via dokumentasi PerfumersWorld, bukan angka langsung di halaman produk.',
		reference_abc_primary_family: mapPerfumersWorldFamily(`${title} ${odourText} ${perfumeUsesText}`),
		reference_impact: impact,
		reference_life_hours: lifeHours,
		reference_impact_source: impact !== null ? 'explicit' : null,
		reference_life_hours_source: lifeHours !== null ? 'explicit' : null,
		reference_use_level_typical_percent: useLevelTypical,
		reference_use_level_max_percent: useLevelMax,
		description: buildDescription({ title, odourText, perfumeUsesText }),
		odour: odourText || null,
		perfume_uses: perfumeUsesText || null,
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
		const url = String(req.body?.url || '').trim();
		if (!url) {
			res.statusCode = 400;
			res.end(JSON.stringify({ message: 'URL is required' }));
			return;
		}

		const payload = await importPerfumersWorldByUrl(url);
		res.statusCode = 200;
		res.end(JSON.stringify(payload));
	} catch (error) {
		res.statusCode = error.statusCode || 500;
		res.end(JSON.stringify({ message: error.message || 'Something went wrong!' }));
	}
};
