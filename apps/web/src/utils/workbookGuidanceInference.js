import { getWorkbookAbcClassificationByFamilyName, getWorkbookAbcClassificationByLetter } from '@/utils/workbookAbcClassification.js';

const roundToNearest = (value, step = 0.5) => (
  Math.round(value / step) * step
);

const extractFirstMatchNumber = (text, expressions) => {
  for (const entry of expressions) {
    const expression = entry instanceof RegExp ? entry : entry.expression;
    const match = text.match(expression);
    if (match) {
      const operatorIndex = entry instanceof RegExp ? 1 : (entry.operatorIndex ?? null);
      const valueIndex = entry instanceof RegExp ? 1 : (entry.valueIndex ?? 1);
      const operatorCandidate = operatorIndex ? match[operatorIndex] : null;
      const operator = operatorCandidate && /^[<>]=?$/.test(operatorCandidate) ? operatorCandidate : null;
      const rawNumber = match[valueIndex];
      const value = Number(rawNumber);
      if (Number.isFinite(value)) {
        return {
          value,
          operator,
        };
      }
    }
  }

  return null;
};

const FAMILY_KEYWORDS = [
  { family: 'EARTHY MOSSY', keywords: ['mushroom', 'fungal', 'earthy', 'humus', 'moss', 'marine', 'yeast', 'soil'] },
  { family: 'FRUIT', keywords: ['fruity', 'fruit', 'melon', 'apple', 'pear', 'peach', 'berry', 'pineapple', 'plum'] },
  { family: 'EDIBLE', keywords: ['edible', 'nut', 'vegetable', 'meat', 'savory', 'gourmand', 'chocolate', 'cocoa', 'caramel'] },
  { family: 'GREEN', keywords: ['green', 'leaf', 'leafy', 'cut grass', 'grass', 'stem', 'galbanum'] },
  { family: 'HERB', keywords: ['herb', 'herbal', 'lavender', 'sage', 'rosemary', 'basil', 'thyme'] },
  { family: 'ICEBERG', keywords: ['mint', 'menthol', 'camphor', 'cooling', 'eucalyptol'] },
  { family: 'CITRUS', keywords: ['citrus', 'orange', 'lemon', 'lime', 'bergamot', 'grapefruit', 'mandarin'] },
  { family: 'ROSE', keywords: ['rose', 'geranium', 'peony'] },
  { family: 'JASMIN', keywords: ['jasmine', 'jasmin'] },
  { family: 'MUGUET', keywords: ['muguet', 'lily of the valley'] },
  { family: 'ORCHID', keywords: ['orchid'] },
  { family: 'WOOD', keywords: ['woody', 'wood', 'cedar', 'sandal', 'patchouli', 'vetiver', 'guaiac'] },
  { family: 'MUSK', keywords: ['musk', 'musky'] },
  { family: 'SPICE', keywords: ['spice', 'spicy', 'clove', 'cinnamon', 'pepper', 'nutmeg', 'cardamom'] },
  { family: 'QUEEN OF THE ORIENT', keywords: ['resin', 'resinous', 'balsam', 'amber', 'incense', 'oriental'] },
  { family: 'TAR SMOKE', keywords: ['smoke', 'smoky', 'tar', 'burnt', 'charred'] },
  { family: 'ANIMAL', keywords: ['animal', 'animalic', 'leather', 'faecal', 'urine', 'civet', 'castoreum'] },
  { family: 'VANILLA', keywords: ['vanilla', 'vanillin', 'sweet'] },
  { family: 'IRIS', keywords: ['iris', 'orris', 'violet'] },
  { family: 'PHENOL', keywords: ['phenol', 'phenolic', 'medicinal'] },
  { family: 'DAIRY', keywords: ['dairy', 'milky', 'cream', 'butter', 'cheese'] },
  { family: 'ALI-FAT-IC', keywords: ['fatty', 'waxy', 'soapy', 'aldehydic'] },
  { family: 'ZOLVENTS', keywords: ['solvent', 'dpg', 'ethanol', 'pg', 'dep', 'odourless'] },
];

const inferFamilyFromKeywords = (text) => {
  const scoredFamilies = FAMILY_KEYWORDS.map((entry) => ({
    family: entry.family,
    score: entry.keywords.reduce((score, keyword) => (
      text.includes(keyword) ? score + 1 : score
    ), 0),
  })).filter((entry) => entry.score > 0);

  if (!scoredFamilies.length) {
    return null;
  }

  scoredFamilies.sort((a, b) => b.score - a.score);
  return scoredFamilies[0].family;
};

const inferImpact = (normalizedText) => {
  const directImpact = extractFirstMatchNumber(normalizedText, [
    /(?:impact|relative[-\s]*odou?r[-\s]*impact)\s*[:=>-]?\s*([0-9.]+)/i,
    /<relative-odou?r-impact[^>]*>\s*([0-9.]+)/i,
  ]);

  if (directImpact) {
    return {
      value: Math.round(directImpact.value),
      source: 'explicit impact in reference text',
      source_kind: 'explicit',
    };
  }

  const strengthMatch = normalizedText.match(/odor\s*strength\s*:\s*([a-z\s-]+)/i)
    || normalizedText.match(/odou?r\s*strength\s*:\s*([a-z\s-]+)/i);
  const smellingMatch = normalizedText.match(/([0-9.]+)\s*%\s*solution\s*or\s*less/i);

  let impact = null;
  let source = null;
  if (strengthMatch) {
    const strength = strengthMatch[1].trim().toLowerCase();
    if (strength.includes('very high') || strength.includes('extreme')) {
      impact = 260;
    } else if (strength.includes('high')) {
      impact = 180;
    } else if (strength.includes('medium')) {
      impact = 120;
    } else if (strength.includes('low')) {
      impact = 70;
    } else if (strength.includes('trace') || strength.includes('very weak')) {
      impact = 40;
    }
    if (impact !== null) {
      source = `odor strength: ${strength}`;
    }
  }

  if (smellingMatch) {
    const recommendedPercent = Number(smellingMatch[1]);
    if (Number.isFinite(recommendedPercent)) {
      if (recommendedPercent <= 0.1) {
        impact = Math.max(impact ?? 0, 320);
      } else if (recommendedPercent <= 1) {
        impact = Math.max(impact ?? 0, 250);
      } else if (recommendedPercent <= 5) {
        impact = Math.max(impact ?? 0, 200);
      } else if (recommendedPercent <= 10) {
        impact = Math.max(impact ?? 0, 160);
      } else if (recommendedPercent <= 25) {
        impact = Math.max(impact ?? 0, 120);
      }
      source = source
        ? `${source}; smelling at ${recommendedPercent}% or less`
        : `smelling at ${recommendedPercent}% or less`;
    }
  }

  return impact === null
    ? null
    : {
        value: Math.round(impact / 5) * 5,
        source: source || 'strength heuristic',
        source_kind: 'heuristic',
      };
};

const inferLifeHours = (normalizedText) => {
  const directLife = extractFirstMatchNumber(normalizedText, [
    { expression: /(?:life|lifetime)\s*[:=>-]?\s*([0-9.]+)\s*(?:hours?|hrs?|h)?/i, valueIndex: 1 },
    { expression: /odou?r[-\s]*life[-\s]*in[-\s]*hours[^0-9<>]*([<>]=?)?\s*([0-9.]+)/i, operatorIndex: 1, valueIndex: 2 },
    { expression: /substantivity\s*:\s*([<>]=?)?\s*([0-9.]+)\s*hour/i, operatorIndex: 1, valueIndex: 2 },
  ]);

  if (directLife) {
    const adjustedValue = directLife.operator?.includes('>') ? directLife.value + 0.5 : directLife.value;
    return {
      value: roundToNearest(adjustedValue),
      source: 'explicit life/substantivity in reference text',
      source_kind: 'explicit',
    };
  }

  if (normalizedText.includes('top note')) {
    return { value: 4, source: 'top note heuristic', source_kind: 'heuristic' };
  }
  if (normalizedText.includes('middle note') || normalizedText.includes('heart note')) {
    return { value: 24, source: 'middle note heuristic', source_kind: 'heuristic' };
  }
  if (normalizedText.includes('base note')) {
    return { value: 48, source: 'base note heuristic', source_kind: 'heuristic' };
  }

  return null;
};

const inferFamily = (normalizedText) => {
  const explicitDistributionMatch = normalizedText.match(/\b([a-z])\s*[-:]\s*([0-9.]+)\b/ig) || [];
  if (explicitDistributionMatch.length) {
    const parsed = explicitDistributionMatch
      .map((entry) => {
        const match = entry.match(/\b([a-z])\s*[-:]\s*([0-9.]+)\b/i);
        if (!match) {
          return null;
        }

        const classification = getWorkbookAbcClassificationByLetter(match[1]);
        const share = Number(match[2]);
        if (!classification || !Number.isFinite(share)) {
          return null;
        }

        return { classification, share };
      })
      .filter(Boolean)
      .sort((a, b) => b.share - a.share);

    if (parsed.length) {
      return {
        value: parsed[0].classification.familyName,
        source: `class distribution ${parsed[0].classification.letter}-${parsed[0].share}`,
      };
    }
  }

  const familyByName = FAMILY_KEYWORDS.find((entry) => normalizedText.includes(entry.family.toLowerCase()));
  if (familyByName && getWorkbookAbcClassificationByFamilyName(familyByName.family)) {
    return {
      value: familyByName.family,
      source: `explicit family keyword ${familyByName.family}`,
    };
  }

  const inferredFamily = inferFamilyFromKeywords(normalizedText);
  if (inferredFamily && getWorkbookAbcClassificationByFamilyName(inferredFamily)) {
    return {
      value: inferredFamily,
      source: 'odor description keyword heuristic',
    };
  }

  return null;
};

const inferWorkbookCode = (text) => {
  const workbookCodeMatch = text.match(/(?:stock\s*ref(?:erence)?|workbook\s*code|abc\s*code)\s*[:=>-]?\s*([A-Za-z0-9-]+)/i)
    || text.match(/<stock-reference=>\s*([A-Za-z0-9-]+)/i);

  if (!workbookCodeMatch) {
    return null;
  }

  return {
    value: workbookCodeMatch[1].trim(),
    source: 'explicit workbook/stock reference code',
  };
};

const inferCasNumber = (text) => {
  const casMatch = text.match(/cas\s*number\s*:\s*([0-9]{2,7}-[0-9]{2}-[0-9])/i)
    || text.match(/fda\s*mainterm[^:]*:\s*([0-9]{2,7}-[0-9]{2}-[0-9])/i);

  if (!casMatch) {
    return null;
  }

  return {
    value: casMatch[1].trim(),
    source: 'explicit CAS number in reference text',
  };
};

const buildShortSummary = ({ family, impact, life, text }) => {
  const lowerText = String(text || '').toLowerCase();
  const descriptorPool = [
    'popcorn',
    'nutty',
    'roasted',
    'peanut',
    'hazelnut',
    'mushroom',
    'fungal',
    'earthy',
    'melon',
    'violet',
    'woody',
    'citrus',
    'green',
    'floral',
    'animalic',
    'smoky',
    'herbal',
    'fruity',
    'vanilla',
    'resinous',
    'spicy',
  ];

  const pickedDescriptors = descriptorPool.filter((keyword) => lowerText.includes(keyword)).slice(0, 4);
  const familyDescriptor = family?.value ? family.value.toLowerCase() : 'workbook-guided';
  const strengthDescriptor = impact?.value
    ? impact.value >= 300
      ? 'very powerful'
      : impact.value >= 220
        ? 'powerful'
        : impact.value >= 140
          ? 'moderate'
          : 'soft'
    : 'reference-guided';
  const lifeDescriptor = life?.value
    ? life.value >= 24
      ? 'long lasting'
      : life.value >= 8
        ? 'substantive'
        : 'lighter'
    : 'with unknown substantivity';
  const descriptorText = pickedDescriptors.length ? ` with ${pickedDescriptors.join(', ')} nuances` : '';

  return `${strengthDescriptor} ${familyDescriptor} material, ${lifeDescriptor}${descriptorText}.`;
};

export const inferWorkbookGuidanceFromText = (input) => {
  const text = String(input || '').trim();
  if (!text) {
    return {
      workbook_code: null,
      reference_abc_primary_family: null,
      reference_impact: null,
      reference_life_hours: null,
      reasoning: [],
    };
  }

  const normalizedText = text.toLowerCase();
  const workbookCode = inferWorkbookCode(text);
  const casNumber = inferCasNumber(text);
  const family = inferFamily(normalizedText);
  const impact = inferImpact(normalizedText);
  const life = inferLifeHours(normalizedText);
  const summary = buildShortSummary({
    family,
    impact,
    life,
    text,
  });

  const reasoning = [
    workbookCode ? `Workbook code: ${workbookCode.value} (${workbookCode.source})` : 'Workbook code tidak ketemu jelas di teks.',
    casNumber ? `CAS: ${casNumber.value} (${casNumber.source})` : 'CAS belum ketemu jelas di teks.',
    family ? `Family: ${family.value} (${family.source})` : 'Family belum bisa dipastikan dari teks.',
    impact ? `Impact: ${impact.value} (${impact.source})` : 'Impact belum bisa dipastikan dari teks.',
    life ? `Life: ${life.value} h (${life.source})` : 'Life belum bisa dipastikan dari teks.',
    summary ? `Summary: ${summary}` : null,
  ];

  return {
    workbook_code: workbookCode?.value || null,
    cas_number: casNumber?.value || null,
    reference_abc_primary_family: family?.value || null,
    reference_impact: impact?.value ?? null,
    reference_life_hours: life?.value ?? null,
    reference_impact_source: impact?.source_kind || null,
    reference_life_hours_source: life?.source_kind || null,
    description: summary || null,
    reasoning: reasoning.filter(Boolean),
  };
};
