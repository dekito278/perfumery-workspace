const SCENTREE_HOSTS = new Set(['www.scentree.co', 'scentree.co']);

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

	const h1Match = html.match(/<h1[^>]*>.*?<\/h1>\s*([\s\S]{0,400}?)<h2/i);
	if (!h1Match) {
		return [];
	}

	const text = decodeHtmlEntities(h1Match[1]);
	return text
		.split('>')
		.map((entry) => entry.trim())
		.filter(Boolean)
		.slice(0, 4);
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
	const titleValue = decodeHtmlEntities(titleMatch?.[1] || '');
	return titleValue || '';
};

const inferLifeFromVolatility = (volatilityText) => {
	const normalized = String(volatilityText || '').toLowerCase();
	if (!normalized) {
		return null;
	}
	if (normalized.includes('head/heart')) {
		return 12;
	}
	if (normalized.includes('heart/base')) {
		return 36;
	}
	if (normalized.includes('head')) {
		return 4;
	}
	if (normalized.includes('heart')) {
		return 24;
	}
	if (normalized.includes('base')) {
		return 48;
	}
	return null;
};

const inferImpactFromDetectionThreshold = (thresholdText) => {
	const normalized = String(thresholdText || '').toLowerCase();
	if (!normalized) {
		return null;
	}

	const numberMatch = normalized.match(/([0-9]+(?:[.,][0-9]+)?)/);
	if (!numberMatch) {
		return null;
	}

	const value = Number(numberMatch[1].replace(',', '.'));
	if (!Number.isFinite(value)) {
		return null;
	}

	if (normalized.includes('ng/l') || normalized.includes('ng')) {
		if (value <= 10) {
			return 320;
		}
		if (value <= 100) {
			return 280;
		}
		return 240;
	}

	if (normalized.includes('ppb')) {
		if (value <= 10) {
			return 280;
		}
		if (value <= 100) {
			return 220;
		}
		return 170;
	}

	if (normalized.includes('ppm')) {
		if (value <= 1) {
			return 220;
		}
		if (value <= 10) {
			return 160;
		}
		return 110;
	}

	return null;
};

const mapScentreeFamilyToWorkbookFamily = (classificationPath) => {
	const normalizedPath = classificationPath.map((entry) => entry.toLowerCase());
	const joined = normalizedPath.join(' ');

	if (joined.includes('aldehyde') || joined.includes('marine') || joined.includes('oceanic')) {
		return 'ICEBERG';
	}
	if (joined.includes('burnt') || joined.includes('pyrogen')) {
		return 'EDIBLE';
	}
	if (joined.includes('nutty') || joined.includes('gourmand') || joined.includes('coffee') || joined.includes('cocoa')) {
		return 'EDIBLE';
	}
	if (joined.includes('fruity')) {
		return 'FRUIT';
	}
	if (joined.includes('citrus')) {
		return 'CITRUS';
	}
	if (joined.includes('green')) {
		return 'GREEN';
	}
	if (joined.includes('floral')) {
		return 'LIGHT CHEMICAL FLORAL';
	}
	if (joined.includes('rose')) {
		return 'ROSE';
	}
	if (joined.includes('wood')) {
		return 'WOOD';
	}
	if (joined.includes('musk')) {
		return 'MUSK';
	}
	if (joined.includes('herbal') || joined.includes('aromatic')) {
		return 'HERB';
	}
	if (joined.includes('animal')) {
		return 'ANIMAL';
	}
	if (joined.includes('amber') || joined.includes('resin')) {
		return 'QUEEN OF THE ORIENT';
	}

	return null;
};

const buildShortDescription = ({ title, classificationPath, uses, comments }) => {
	const parts = [
		title ? `${title} is classified as ${classificationPath.join(' > ') || 'a ScenTree ingredient'}.` : '',
		uses ? `Uses in perfumery: ${uses}` : '',
		comments ? `Notes: ${comments}` : '',
	].filter(Boolean);

	return parts.join(' ').trim();
};

export default async (req, res, next) => {
	try {
		const url = String(req.body?.url || '').trim();
		if (!url) {
			return res.status(400).json({ message: 'URL is required' });
		}

		const parsedUrl = new URL(url);
		if (!SCENTREE_HOSTS.has(parsedUrl.hostname)) {
			return res.status(400).json({ message: 'Only ScenTree URLs are supported' });
		}

		const response = await fetch(parsedUrl.toString(), {
			headers: {
				'User-Agent': 'PerfumerStudio/1.0 (+internal reference importer)',
				'Accept-Language': 'en-US,en;q=0.9',
			},
		});

		if (!response.ok) {
			return res.status(502).json({ message: `Failed to load ScenTree page (${response.status})` });
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
		const workbookFamily = mapScentreeFamilyToWorkbookFamily(classificationPath);
		const referenceImpact = inferImpactFromDetectionThreshold(detectionThreshold);
		const referenceLifeHours = inferLifeFromVolatility(volatility);
		const description = buildShortDescription({
			title,
			classificationPath,
			uses: usesInPerfumery,
			comments: /data not available/i.test(otherComments) ? '' : otherComments,
		});

		return res.json({
			source: 'scentree',
			url: parsedUrl.toString(),
			name: title || null,
			classification_path: classificationPath,
			workbook_code: null,
			cas_number: casNumber || null,
			ifra_limit: ifra.ifra_limit,
			ifra_notes: ifra.ifra_text || null,
			reference_abc_primary_family: workbookFamily,
			reference_impact: referenceImpact,
			reference_life_hours: referenceLifeHours,
			description: description || null,
			volatility: volatility || null,
			detection_threshold: detectionThreshold || null,
			uses_in_perfumery: usesInPerfumery || null,
		});
	} catch (error) {
		next(error);
	}
};
