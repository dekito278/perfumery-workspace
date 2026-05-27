import { Buffer } from 'node:buffer';

const SCENTREE_HOSTS = new Set(['www.scentree.co', 'scentree.co']);
const PERFUMERSWORLD_HOSTS = new Set(['www.perfumersworld.com', 'perfumersworld.com']);

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

const extractBetween = (html, startPattern, endPattern) => {
	const startMatch = html.match(startPattern);
	if (!startMatch || startMatch.index === undefined) {
		return '';
	}

	const startIndex = startMatch.index + startMatch[0].length;
	const sliced = html.slice(startIndex);
	const endMatch = sliced.match(endPattern);
	if (!endMatch || endMatch.index === undefined) {
		return sliced;
	}

	return sliced.slice(0, endMatch.index);
};

const extractLabelValue = (html, label) => {
	const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const labelValuePatterns = [
		new RegExp(
			`<span[^>]*class="[^"]*label[^"]*"[^>]*>\\s*${escapedLabel}\\s*:?\\s*<\\/span>[\\s\\S]{0,400}?<span[^>]*class="[^"]*label-info[^"]*"[^>]*>([\\s\\S]*?)<\\/span>`,
			'i',
		),
		new RegExp(
			`<span[^>]*class="[^"]*label[^"]*"[^>]*>\\s*${escapedLabel}\\s*:?\\s*<\\/span>[\\s\\S]{0,500}?<p[^>]*class="[^"]*label-info[^"]*"[^>]*>([\\s\\S]*?)<\\/p>`,
			'i',
		),
		new RegExp(
			`<h3[^>]*>[\\s\\S]*?<span[^>]*class="[^"]*label[^"]*"[^>]*>\\s*${escapedLabel}\\s*:?\\s*<\\/span>[\\s\\S]*?<\\/h3>[\\s\\S]{0,500}?<(?:span|p)[^>]*class="[^"]*label-info[^"]*"[^>]*>([\\s\\S]*?)<\\/(?:span|p)>`,
			'i',
		),
	];

	for (const pattern of labelValuePatterns) {
		const match = html.match(pattern);
		const value = decodeHtmlEntities(match?.[1] || '');
		if (value) {
			return value;
		}
	}

	const block = extractBetween(
		html,
		new RegExp(`<h3[^>]*>[\\s\\S]*?${escapedLabel}[\\s\\S]*?<\\/h3>`, 'i'),
		/<h3[^>]*>|<\/section>|<section[^>]*>|<h2[^>]*>/i,
	);
	return decodeHtmlEntities(block);
};

const extractTitle = (html) => {
	const match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
	return decodeHtmlEntities(match?.[1] || '');
};

const extractClassificationPath = (html) => {
	const headerMatch = html.match(/<h1[^>]*>.*?<\/h1>\s*<p[^>]*class="[^"]*textorange-dark[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
	if (headerMatch?.[1]) {
		return decodeHtmlEntities(headerMatch[1])
			.split('>')
			.map((entry) => entry.trim())
			.filter(Boolean)
			.slice(0, 4);
	}

	return [];
};

const extractIfra = (html) => {
	const block = extractBetween(
		html,
		/<h2[^>]*>\s*IFRA\s*<\/h2>/i,
		/<h2[^>]*>|<\/main>|<\/article>/i,
	);
	const text = decodeHtmlEntities(block);

	if (!text) {
		return { ifra_limit: null, ifra_text: '' };
	}

	if (/not restricted/i.test(text)) {
		return { ifra_limit: 100, ifra_text: text };
	}

	const percentMatch = text.match(/([0-9]+(?:[.,][0-9]+)?)\s*%/i);
	if (percentMatch) {
		return {
			ifra_limit: Number(percentMatch[1].replace(',', '.')),
			ifra_text: text,
		};
	}

	return { ifra_limit: null, ifra_text: text };
};

const extractCasNumber = (html) => {
	const directMatch = html.match(/CAS\s*(?:N\u00B0|N&deg;|No\.?)\s*:?\s*<\/span>[\s\S]{0,200}?<span[^>]*class="[^"]*label-info[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
	const directValue = decodeHtmlEntities(directMatch?.[1] || '');
	if (directValue && !/data not available/i.test(directValue)) {
		return directValue;
	}

	const titleMatch = html.match(/<title[^>]*>[\s\S]*?CAS\s*(?:N\u00B0|N&deg;|No\.?)\s*([0-9-]+)[\s\S]*?<\/title>/i);
	return decodeHtmlEntities(titleMatch?.[1] || '');
};

const inferLifeFromVolatility = (volatilityText) => {
	const normalized = String(volatilityText || '').toLowerCase();
	if (!normalized) {
		return null;
	}
	if (normalized.includes('head/heart')) return 12;
	if (normalized.includes('heart/base')) return 36;
	if (normalized.includes('head')) return 4;
	if (normalized.includes('heart')) return 24;
	if (normalized.includes('base')) return 48;
	return null;
};

const inferImpactFromDetectionThreshold = (thresholdText) => {
	const normalized = String(thresholdText || '').toLowerCase();
	const numberMatch = normalized.match(/([0-9]+(?:[.,][0-9]+)?)/);
	if (!numberMatch) {
		return null;
	}

	const value = Number(numberMatch[1].replace(',', '.'));
	if (!Number.isFinite(value)) {
		return null;
	}

	if (normalized.includes('ng/l') || normalized.includes('ng')) {
		if (value <= 10) return 320;
		if (value <= 100) return 280;
		return 240;
	}
	if (normalized.includes('ppb')) {
		if (value <= 10) return 280;
		if (value <= 100) return 220;
		return 170;
	}
	if (normalized.includes('ppm')) {
		if (value <= 1) return 220;
		if (value <= 10) return 160;
		return 110;
	}

	return null;
};

const mapScentreeFamilyToWorkbookFamily = (classificationPath) => {
	const joined = classificationPath.map((entry) => entry.toLowerCase()).join(' ');

	if (joined.includes('aldehyde') || joined.includes('marine') || joined.includes('oceanic')) return 'ICEBERG';
	if (joined.includes('burnt') || joined.includes('pyrogen')) return 'EDIBLE';
	if (joined.includes('nutty') || joined.includes('gourmand') || joined.includes('coffee') || joined.includes('cocoa')) return 'EDIBLE';
	if (joined.includes('fruity')) return 'FRUIT';
	if (joined.includes('citrus')) return 'CITRUS';
	if (joined.includes('green')) return 'GREEN';
	if (joined.includes('floral')) return 'LIGHT CHEMICAL FLORAL';
	if (joined.includes('rose')) return 'ROSE';
	if (joined.includes('wood')) return 'WOOD';
	if (joined.includes('musk')) return 'MUSK';
	if (joined.includes('herbal') || joined.includes('aromatic')) return 'HERB';
	if (joined.includes('animal')) return 'ANIMAL';
	if (joined.includes('amber') || joined.includes('resin')) return 'QUEEN OF THE ORIENT';

	return null;
};

const extractFirstNumber = (html, expressions) => {
	for (const expression of expressions) {
		const match = html.match(expression);
		const value = Number(String(match?.[1] || '').replace(',', '.'));
		if (Number.isFinite(value)) {
			return value;
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

const buildPerfumersWorldDescription = ({ title, odourText, perfumeUsesText }) => {
	const parts = [
		title ? `${title} from PerfumersWorld.` : '',
		odourText ? `Odour: ${odourText}` : '',
		perfumeUsesText ? `Perfume uses: ${perfumeUsesText}` : '',
	].filter(Boolean);

	return parts.join(' ').trim() || null;
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

const buildTgscDescription = ({ title, odorType, odorDescription }) => {
	const parts = [
		title ? `${title} from The Good Scents Company.` : '',
		odorType ? `Odor type: ${odorType}.` : '',
		odorDescription ? `Odor description: ${odorDescription}.` : '',
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
	const value = Number(String(matches.at(-1)?.[1] || '').replace(',', '.'));
	return Number.isFinite(value) ? value : null;
};

const buildShortDescription = ({ title, classificationPath, uses, comments }) => {
	const parts = [
		title ? `${title} is classified as ${classificationPath.join(' > ') || 'a ScenTree ingredient'}.` : '',
		uses ? `Uses in perfumery: ${uses}` : '',
		comments ? `Notes: ${comments}` : '',
	].filter(Boolean);

	return parts.join(' ').trim();
};

const importScentreeByUrl = async (url) => {
	const parsedUrl = new URL(String(url || '').trim());
	if (!SCENTREE_HOSTS.has(parsedUrl.hostname)) {
		const error = new Error('Only ScenTree URLs are supported');
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
		const error = new Error(`Failed to load ScenTree page (${response.status})`);
		error.statusCode = 502;
		throw error;
	}

	const html = await response.text();
	const title = extractTitle(html);
	const classificationPath = extractClassificationPath(html);
	const casNumber = extractCasNumber(html)
		|| extractLabelValue(html, 'CAS N\u00B0')
		|| extractLabelValue(html, 'N\u00B0 CAS')
		|| extractLabelValue(html, 'CAS');
	const volatility = extractLabelValue(html, 'Volatility') || extractLabelValue(html, 'Tenue');
	const detectionThreshold = extractLabelValue(html, 'Detection Threshold');
	const usesInPerfumery = extractLabelValue(html, 'Uses in perfumery') || extractLabelValue(html, 'Utilisation en parfumerie');
	const otherComments = extractLabelValue(html, 'Other comments') || extractLabelValue(html, 'Autres commentaires');
	const ifra = extractIfra(html);

	return {
		source: 'scentree',
		url: parsedUrl.toString(),
		name: title || null,
		classification_path: classificationPath,
		workbook_code: null,
		cas_number: casNumber || null,
		ifra_limit: ifra.ifra_limit,
		ifra_notes: ifra.ifra_text || null,
		reference_abc_primary_family: mapScentreeFamilyToWorkbookFamily(classificationPath),
		reference_impact: inferImpactFromDetectionThreshold(detectionThreshold),
		reference_life_hours: inferLifeFromVolatility(volatility),
		description: buildShortDescription({
			title,
			classificationPath,
			uses: usesInPerfumery,
			comments: /data not available/i.test(otherComments) ? '' : otherComments,
		}) || null,
		volatility: volatility || null,
		detection_threshold: detectionThreshold || null,
		uses_in_perfumery: usesInPerfumery || null,
	};
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

	if (!title && !sku && !casNumber) {
		const error = new Error('PerfumersWorld page loaded, but product data could not be read. Check that the URL is a public product page.');
		error.statusCode = 422;
		throw error;
	}

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
		description: buildPerfumersWorldDescription({ title, odourText, perfumeUsesText }),
		odour: odourText || null,
		perfume_uses: perfumeUsesText || null,
	};
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
	const substantivityHours = extractFirstNumber(html, [/Substantivity:\s*<span[^>]*>\s*([0-9]+(?:[.,][0-9]+)?)\s*hour/i]);
	const odorStrengthImpact = inferImpactFromOdorStrength(odorStrength);
	const recommendationImpact = inferImpactFromSmellingRecommendation(html);
	const referenceImpact = Math.max(odorStrengthImpact || 0, recommendationImpact || 0) || null;

	return {
		source: 'tgsc',
		url: parsedUrl.toString(),
		name: title || null,
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
		description: buildTgscDescription({ title, odorType, odorDescription }),
		odor_type: odorType || null,
		odor_strength: odorStrength || null,
		odor_description: odorDescription || null,
		substantivity_hours: substantivityHours,
	};
};

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
