import {
  findPerfumersWorldCategoryByCode,
  findPerfumersWorldCategoryByValue,
  PERFUMERS_WORLD_CATEGORY_VALUES,
} from '@/utils/perfumersWorldCategories.js';

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const LEGACY_CATEGORY_MAP = {
  citrus: 'C',
  fruity: 'F',
  green: 'G',
  spicy: 'S',
  woody: 'W',
  musk: 'X',
  gourmand: 'V',
  amber: 'Q',
  resinous: 'Q',
  floral: 'L',
  solvent: 'Z',
};

const KEYWORD_RULES = [
  { code: 'Z', confidence: 'high', reason: 'solvent keyword', patterns: [/dpg\b/, /\bdep\b/, /\bethanol\b/, /\bipp\b/, /\bipm\b/, /\bsolvent\b/, /\bcarrier\b/] },
  { code: 'X', confidence: 'high', reason: 'musk keyword', patterns: [/\bmusk\b/, /ambrettolide/, /ethylene brassylate/, /habanolide/, /helvetolide/, /exaltolide/] },
  { code: 'R', confidence: 'high', reason: 'rose keyword', patterns: [/\brose\b/, /geraniol/, /geranyl/, /phenyl ethyl alcohol/, /\bpea\b/, /citronellol/, /rhodinol/] },
  { code: 'J', confidence: 'high', reason: 'jasmin keyword', patterns: [/\bjasm/, /\bhedione\b/, /\bhca\b/, /benzyl acetate/, /\baca\b/] },
  { code: 'M', confidence: 'high', reason: 'muguet keyword', patterns: [/\bmuguet\b/, /\blilial\b/, /\blyral\b/, /hydroxycitronellal/, /bourgeonal/] },
  { code: 'W', confidence: 'high', reason: 'wood keyword', patterns: [/\bcedar/, /\bcedramber\b/, /\bcedroxyde\b/, /sandal/, /patchouli/, /vetiver|vetivert/, /\bwood\b/, /cashmeran/, /vertofix/] },
  { code: 'C', confidence: 'high', reason: 'citrus keyword', patterns: [/\blemon\b/, /\blime\b/, /\borange\b/, /\bbergamot\b/, /\bgrapefruit\b/, /\bcitral\b/, /\bcitrus\b/] },
  { code: 'S', confidence: 'high', reason: 'spice keyword', patterns: [/\bpepper\b/, /\bcardamom\b/, /\bclove\b/, /\bcinnamon\b/, /\bthyme\b/, /\bspice\b/, /\bnutmeg\b/] },
  { code: 'G', confidence: 'high', reason: 'green keyword', patterns: [/\bgreen\b/, /\bleaf\b/, /\bgrass\b/, /cis-?3-hexenol/, /triplal/] },
  { code: 'K', confidence: 'medium', reason: 'conifer keyword', patterns: [/\bpine\b/, /\bkonifer\b/, /\bneedle\b/, /bornyl acetate/, /terpineol/] },
  { code: 'I', confidence: 'medium', reason: 'iris keyword', patterns: [/\biris\b/, /\borris\b/, /\bviolet\b/, /\bionone\b/, /methyl ionone/] },
  { code: 'O', confidence: 'medium', reason: 'orchid keyword', patterns: [/salicylate/, /benzoate/, /\borchid\b/] },
  { code: 'P', confidence: 'medium', reason: 'phenolic keyword', patterns: [/\bphenol\b/, /medicinal/, /\bhoney\b/, /ethyl phenyl acetate/, /p-cresol/] },
  { code: 'Q', confidence: 'medium', reason: 'oriental resin keyword', patterns: [/\bbenzoin\b/, /\bresin/, /\bbalsam\b/, /\btolu\b/, /\bamber\b/] },
  { code: 'V', confidence: 'medium', reason: 'vanilla keyword', patterns: [/\bvanilla\b/, /\bvanillin\b/, /\bcoumarin\b/, /\bheliotropin\b/, /ethyl maltol/] },
  { code: 'Y', confidence: 'medium', reason: 'earthy or mossy keyword', patterns: [/\boakmoss\b/, /\bmoss\b/, /\bmarine\b/, /\bcalone\b/, /\bearth/] },
  { code: 'T', confidence: 'medium', reason: 'tar or smoke keyword', patterns: [/\bsmoke\b/, /\btar\b/, /\bburnt\b/, /\bcade\b/, /birch tar/] },
  { code: 'U', confidence: 'medium', reason: 'animalic keyword', patterns: [/\banimal\b/, /\bleather\b/, /\bcivet\b/, /\bcastoreum\b/, /\bambergris\b/, /\bindol/] },
  { code: 'D', confidence: 'medium', reason: 'dairy keyword', patterns: [/\bmilk\b/, /\bcream\b/, /\bbutter\b/, /\bcheese\b/, /\blactone\b/, /\bbutyrate\b/, /diacetyl/] },
  { code: 'E', confidence: 'medium', reason: 'edible savoury keyword', patterns: [/\bnut\b/, /\bmeat\b/, /\bvegetable\b/, /\bfish\b/, /pyrazine/, /thiazole/] },
  { code: 'B', confidence: 'medium', reason: 'cooling keyword', patterns: [/\bmenthol\b/, /\bcamphor\b/, /\beucalyptol\b/, /\bmint\b/] },
  { code: 'N', confidence: 'medium', reason: 'narcotic floral keyword', patterns: [/\bylang\b/, /\btuberose\b/, /\bnarcissus\b/, /\bnarcotic\b/] },
  { code: 'L', confidence: 'medium', reason: 'light floral keyword', patterns: [/\blinalool\b/, /vertenex/, /\bdmbc\b/, /\blight floral\b/] },
  { code: 'A', confidence: 'medium', reason: 'aliphatic keyword', patterns: [/\baldehyde\b/, /\bfatty\b/, /\bwaxy\b/, /\bsoapy\b/, /\bclean\b/, /\bdecanal\b/, /\bundecanal\b/] },
];

export const suggestPerfumersWorldCategory = ({ workbookCode, name, legacyCategory }) => {
  const normalizedWorkbookCode = normalizeText(workbookCode);
  const normalizedName = normalizeText(name);
  const normalizedLegacyCategory = normalizeText(legacyCategory);

  if (normalizedLegacyCategory && PERFUMERS_WORLD_CATEGORY_VALUES.has(normalizedLegacyCategory)) {
    const exactCategory = findPerfumersWorldCategoryByValue(normalizedLegacyCategory);
    return {
      category: exactCategory,
      confidence: 'exact',
      reason: 'already uses Perfumer’s Workbook category',
    };
  }

  if (normalizedWorkbookCode) {
    const workbookCategory = findPerfumersWorldCategoryByCode(normalizedWorkbookCode.charAt(0));
    if (workbookCategory) {
      return {
        category: workbookCategory,
        confidence: 'high',
        reason: `matched workbook code prefix ${normalizedWorkbookCode.charAt(0).toUpperCase()}`,
      };
    }
  }

  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalizedName))) {
      return {
        category: findPerfumersWorldCategoryByCode(rule.code),
        confidence: rule.confidence,
        reason: rule.reason,
      };
    }
  }

  if (normalizedLegacyCategory && LEGACY_CATEGORY_MAP[normalizedLegacyCategory]) {
    return {
      category: findPerfumersWorldCategoryByCode(LEGACY_CATEGORY_MAP[normalizedLegacyCategory]),
      confidence: 'low',
      reason: `fallback from legacy category "${legacyCategory}"`,
    };
  }

  return {
    category: null,
    confidence: 'none',
    reason: 'no safe category suggestion found',
  };
};
