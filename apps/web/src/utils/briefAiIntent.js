import {
  buildStageTargetProfile,
  formatImpactBandLabel,
  formatLifeRangeLabel,
  getStageLabel,
  getWizardQuestionsForStage,
} from '@/utils/briefProjectWizard.js';

const STAGES = ['top', 'middle', 'base'];
const MIN_AI_CONFIDENCE = 0.45;

const normalizeText = (value) => String(value || '').trim();
const normalizeKey = (value) => normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const unique = (values = []) => [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
const uniqueLower = (values = []) => unique(values).map((value) => value.toLowerCase());

const clampConfidence = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(1, numeric));
};

const normalizeImpactBand = (value, fallback = 'medium') => {
  const normalized = normalizeText(value).toLowerCase();
  return ['low', 'medium', 'high'].includes(normalized) ? normalized : fallback;
};

const normalizeLifeRange = (value, fallback) => {
  const [fallbackMin, fallbackMax] = Array.isArray(fallback) ? fallback : [4, 96];
  const [inputMin, inputMax] = Array.isArray(value) ? value : [fallbackMin, fallbackMax];
  const min = Number(inputMin);
  const max = Number(inputMax);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [fallbackMin, fallbackMax];
  }
  return [Math.max(0, min), Math.max(Math.max(0, min), max)];
};

const optionFromIntent = (option, stage, index) => {
  const label = normalizeText(option?.label) || `Direction ${index + 1}`;
  const tags = uniqueLower(option?.tags || option?.aroma_keywords || []);
  return {
    value: normalizeKey(option?.value || `${stage}_${label}`) || `ai_${stage}_${index}`,
    label,
    tags,
    hint: normalizeText(option?.hint || option?.rationale || ''),
    signal: option?.signal && typeof option.signal === 'object' ? option.signal : null,
  };
};

const buildGeneratedQuestion = ({ stage, id, title, description, options }) => ({
  id,
  title,
  description,
  optionsByBranch: { default: options },
  defaultBranch: 'default',
  options,
});

const GAS_INTENT = {
  source: 'fallback',
  model: 'deterministic-local',
  scent_story: 'Arah brief dibaca sebagai efek uap gas/fuel yang realistis: volatile, cold-air, ozonic, mineral, metallic, transparent, diffusive, sedikit solventy, tetapi tetap wearable dan tidak harsh.',
  interpreted_terms: [
    { term: 'gas', meaning: 'volatile fuel-vapor impression, cold metallic air, ozonic mineral lift' },
    { term: 'realistic', meaning: 'lebih tekstural dan believable, bukan citrus/floral default' },
  ],
  stage_blueprints: {
    top: {
      goal: 'Bangun ledakan volatile yang dingin, ozonic, metallic, dan diffusive tanpa terasa kasar.',
      aroma_keywords: ['ozonic', 'cold_air', 'metallic', 'aldehydic', 'mineral', 'solventy', 'transparent', 'diffusive'],
      effect_tags: ['mineral', 'sparkle', 'cool'],
      preferred_letters: ['B', 'C', 'G', 'L', 'M'],
      preferred_functions: ['diffuser', 'modifier', 'bridge'],
      impact_band: 'high',
      life_range_hours: [2, 18],
      avoid_tags: ['burnt_rubber', 'sulfur', 'overly_sweet', 'heavy_gourmand'],
    },
    middle: {
      goal: 'Jaga heart tetap clean-industrial dan airy agar efek gas tidak berubah menjadi floral/fruity biasa.',
      aroma_keywords: ['transparent', 'mineral', 'metallic', 'clean_aromatic', 'dry_tea', 'cold_spice'],
      effect_tags: ['mineral', 'cool', 'spicy_ping'],
      preferred_letters: ['G', 'H', 'L', 'M', 'S'],
      preferred_functions: ['bridge', 'support', 'modifier'],
      impact_band: 'medium',
      life_range_hours: [10, 72],
      avoid_tags: ['jammy_fruit', 'dense_white_floral', 'creamy_gourmand'],
    },
    base: {
      goal: 'Kunci drydown dengan mineral musk/wood yang bersih agar realism tetap aman, bukan smoky atau tarry.',
      aroma_keywords: ['mineral_musk', 'clean_wood', 'transparent_amber', 'dry_woods', 'skin_musk'],
      effect_tags: ['mineral', 'creamy_body'],
      preferred_letters: ['W', 'X', 'L', 'Q'],
      preferred_functions: ['support', 'fixative', 'blender', 'bridge'],
      impact_band: 'low',
      life_range_hours: [36, 180],
      avoid_tags: ['tar', 'burnt', 'animalic_dirty', 'heavy_resin'],
    },
  },
  question_plan: {
    top: [
      {
        id: 'family',
        title: 'Fuel-vapor opening',
        description: 'Pilih cara top note menerjemahkan realisme gas/fuel.',
        options: [
          { value: 'cold_ozonic_vapor', label: 'Cold ozonic vapor', tags: ['ozonic', 'cold_air', 'mineral', 'transparent'], hint: 'Uap dingin, airy, dan sangat diffusive.' },
          { value: 'metallic_aldehydic_flash', label: 'Metallic aldehydic flash', tags: ['metallic', 'aldehydic', 'sparkling', 'bright'], hint: 'Kilat metalik dan sparkling untuk kesan volatil.' },
          { value: 'solventy_mineral_lift', label: 'Solventy mineral lift', tags: ['solventy', 'mineral', 'diffusive', 'dry'], hint: 'Sedikit laboratory/fuel nuance, tetap dikontrol.' },
          { value: 'transparent_cold_spice', label: 'Transparent cold spice', tags: ['cold', 'spice', 'transparent', 'lift'], hint: 'Spice dingin untuk efek vapor tanpa fruity.' },
        ],
      },
      {
        id: 'nuance',
        title: 'Gas realism texture',
        description: 'Detailkan tekstur realistisnya agar rekomendasi tidak masuk pola citrus/floral default.',
        options: [
          { value: 'garage_air', label: 'Garage air', tags: ['mineral', 'metallic', 'dry'], hint: 'Udara dingin di ruang mesin, bukan asap berat.' },
          { value: 'cold_spark_vapor', label: 'Cold spark vapor', tags: ['cool', 'sparkle', 'ozonic'], hint: 'Efek nyala dingin dan cepat menguap.' },
          { value: 'transparent_solvent', label: 'Transparent solvent', tags: ['solventy', 'transparent', 'diffusive'], hint: 'Solventy tipis sebagai aksen, bukan dominan.' },
          { value: 'mineral_mist', label: 'Mineral mist', tags: ['mineral', 'watery', 'clean'], hint: 'Lebih aman dan wearable.' },
        ],
      },
    ],
    middle: [
      {
        id: 'family',
        title: 'Industrial heart bridge',
        description: 'Pilih bridge yang menjaga karakter gas tetap hidup di middle.',
        options: [
          { value: 'clean_mineral_aromatic', label: 'Clean mineral aromatic', tags: ['clean', 'mineral', 'aromatic'], hint: 'Aromatik dingin untuk kontrol dan wearable.' },
          { value: 'dry_tea_metallic', label: 'Dry tea metallic', tags: ['tea', 'metallic', 'dry'], hint: 'Heart tipis, kering, dan modern.' },
          { value: 'cold_spice_bridge', label: 'Cold spice bridge', tags: ['spice', 'cool', 'bridge'], hint: 'Cardamom/pepper style untuk efek udara dingin.' },
          { value: 'transparent_floral_trace', label: 'Transparent floral trace', tags: ['transparent', 'floral', 'clean'], hint: 'Floral hanya sebagai lift bersih, bukan tema utama.' },
        ],
      },
    ],
    base: [
      {
        id: 'family',
        title: 'Clean mineral drydown',
        description: 'Pilih fondasi agar gas realism tetap elegan dan aman dipakai.',
        options: [
          { value: 'mineral_musk_wood', label: 'Mineral musk wood', tags: ['mineral', 'musk', 'woody'], hint: 'Fondasi paling aman untuk cold-air realism.' },
          { value: 'clean_driftwood_skin', label: 'Clean driftwood skin', tags: ['clean', 'woody', 'skin'], hint: 'Drydown bersih, kering, dan tidak manis.' },
          { value: 'transparent_amber_frame', label: 'Transparent amber frame', tags: ['amber', 'transparent', 'balanced'], hint: 'Sedikit body tanpa membuat berat.' },
          { value: 'dry_papyrus_musk', label: 'Dry papyrus musk', tags: ['dry', 'structured', 'musk'], hint: 'Struktur modern, papery, mineral.' },
        ],
      },
    ],
  },
  material_biases: [
    { keyword: 'ozonic', weight: 1.2 },
    { keyword: 'mineral', weight: 1.1 },
    { keyword: 'metallic', weight: 1 },
    { keyword: 'aldehydic', weight: 0.9 },
    { keyword: 'solventy', weight: 0.8 },
  ],
  avoidances: ['burnt rubber', 'sulfur overload', 'tar smoke', 'too sweet fruity floral default'],
  confidence: 0.72,
  fallback_reason: 'Local gas/fuel concept interpreter',
};

const DEFAULT_INTENT = {
  source: 'fallback',
  model: 'deterministic-local',
  scent_story: 'Arah brief dibaca dengan fallback lokal. Wizard tetap memakai question bank utama dan engine ranking deterministic.',
  interpreted_terms: [],
  stage_blueprints: {},
  question_plan: {},
  material_biases: [],
  avoidances: [],
  confidence: 0.35,
  fallback_reason: 'No strong local concept match',
};

export const collectBriefText = (brief = null) => [
  brief?.title,
  brief?.project_name,
  brief?.mood_story,
  brief?.audience_usage,
  brief?.performance_target,
  brief?.budget_direction,
  brief?.notes,
].filter(Boolean).join(' ');

export const normalizeBriefAiIntent = (payload = null, source = 'ai') => {
  const intent = payload && typeof payload === 'object' ? payload : {};
  const normalizedStageBlueprints = {};
  STAGES.forEach((stage) => {
    const blueprint = intent.stage_blueprints?.[stage] || {};
    normalizedStageBlueprints[stage] = {
      goal: normalizeText(blueprint.goal),
      aroma_keywords: uniqueLower(blueprint.aroma_keywords || blueprint.tags || []),
      effect_tags: uniqueLower(blueprint.effect_tags || []),
      preferred_letters: unique(blueprint.preferred_letters || []).map((value) => value.toUpperCase()),
      preferred_functions: uniqueLower(blueprint.preferred_functions || []),
      impact_band: normalizeImpactBand(blueprint.impact_band, ''),
      life_range_hours: Array.isArray(blueprint.life_range_hours) ? normalizeLifeRange(blueprint.life_range_hours) : null,
      avoid_tags: uniqueLower(blueprint.avoid_tags || []),
    };
  });

  return {
    source: normalizeText(intent.source || source || 'ai'),
    model: normalizeText(intent.model || ''),
    scent_story: normalizeText(intent.scent_story),
    interpreted_terms: Array.isArray(intent.interpreted_terms) ? intent.interpreted_terms.slice(0, 12) : [],
    stage_blueprints: normalizedStageBlueprints,
    question_plan: intent.question_plan && typeof intent.question_plan === 'object' ? intent.question_plan : {},
    material_biases: Array.isArray(intent.material_biases) ? intent.material_biases.slice(0, 20) : [],
    avoidances: unique(intent.avoidances || []),
    confidence: clampConfidence(intent.confidence),
    fallback_reason: normalizeText(intent.fallback_reason),
  };
};

export const createFallbackBriefAiIntent = ({ freeText = '', brief = null } = {}) => {
  const text = `${freeText} ${collectBriefText(brief)}`.toLowerCase();
  if (/\b(gas|gasoline|bensin|fuel|petrol|vapor|uap)\b/i.test(text)) {
    return normalizeBriefAiIntent(GAS_INTENT, 'fallback');
  }
  return normalizeBriefAiIntent(DEFAULT_INTENT, 'fallback');
};

export const shouldUseAiIntent = (intent = null) => Boolean(intent && Number(intent.confidence || 0) >= MIN_AI_CONFIDENCE);

export const buildBriefAiIntentRequestPayload = ({
  brief = null,
  existingAnswers = {},
  feedbackSummary = {},
  locale = 'id-ID',
} = {}) => ({
  briefId: brief?.id || null,
  freeText: collectBriefText(brief),
  existingAnswers,
  feedbackSummary,
  locale,
});

export const summarizeWizardFeedback = ({
  wizardStageItemsMap = new Map(),
  rawMaterialsById = new Map(),
  activeStage = 'top',
} = {}) => {
  const items = STAGES.flatMap((stage) => wizardStageItemsMap.get(stage) || []);
  const summarizeByState = (state) => items
    .filter((item) => item.selection_state === state)
    .slice(0, 16)
    .map((item) => rawMaterialsById.get(item.raw_material_id)?.name || item.expand?.raw_material_id?.name || item.raw_material_id);

  return {
    activeStage,
    selected: summarizeByState('selected'),
    rejected: summarizeByState('rejected'),
    manual: summarizeByState('manual'),
  };
};

export const getAdaptiveWizardQuestionsForStage = (stage, answers = {}, aiIntent = null) => {
  const baseQuestions = getWizardQuestionsForStage(stage, answers);
  if (!shouldUseAiIntent(aiIntent)) {
    return baseQuestions;
  }

  const plannedQuestions = Array.isArray(aiIntent.question_plan?.[stage]) ? aiIntent.question_plan[stage] : [];
  const questionOverrides = new Map(plannedQuestions
    .filter((question) => question?.id && Array.isArray(question.options) && question.options.length)
    .map((question) => [
      question.id,
      buildGeneratedQuestion({
        stage,
        id: question.id,
        title: normalizeText(question.title) || question.id,
        description: normalizeText(question.description),
        options: question.options.slice(0, 6).map((option, index) => optionFromIntent(option, stage, index)),
      }),
    ]));

  const nextQuestions = baseQuestions.map((question) => {
    const override = questionOverrides.get(question.id);
    if (!override) {
      return question;
    }
    return {
      ...question,
      title: override.title,
      description: override.description || question.description,
      optionsByBranch: override.optionsByBranch,
      options: override.options,
    };
  });

  questionOverrides.forEach((question, id) => {
    if (!nextQuestions.some((entry) => entry.id === id)) {
      nextQuestions.push(question);
    }
  });

  return nextQuestions;
};

export const buildAdaptiveStageTargetProfile = (stage, answers = {}, brief = null, aiIntent = null) => {
  const baseProfile = buildStageTargetProfile(stage, answers, brief);
  if (!shouldUseAiIntent(aiIntent)) {
    return baseProfile;
  }

  const blueprint = aiIntent.stage_blueprints?.[stage] || {};
  const tags = uniqueLower([
    ...(baseProfile.tags || []),
    ...(blueprint.aroma_keywords || []),
    ...(blueprint.effect_tags || []),
    ...((aiIntent.material_biases || []).map((bias) => bias?.keyword || bias?.tag || bias).filter(Boolean)),
  ]);
  const preferredLetters = unique([
    ...(baseProfile.preferred_letters || []),
    ...(blueprint.preferred_letters || []),
  ]).map((value) => value.toUpperCase());
  const preferredFunctions = uniqueLower([
    ...(baseProfile.preferred_functions || []),
    ...(blueprint.preferred_functions || []),
  ]);
  const selectedLabels = unique([
    ...(baseProfile.selected_labels || []),
    ...(blueprint.aroma_keywords || []).slice(0, 4).map((tag) => tag.replace(/_/g, ' ')),
  ]);
  const impactBand = normalizeImpactBand(blueprint.impact_band, baseProfile.impact_band);
  const lifeRange = blueprint.life_range_hours
    ? normalizeLifeRange(blueprint.life_range_hours, baseProfile.life_range_hours)
    : baseProfile.life_range_hours;
  const stageStory = normalizeText(blueprint.goal) || baseProfile.stage_goal;
  const aiSummary = normalizeText(blueprint.goal)
    || (blueprint.aroma_keywords?.length ? `${getStageLabel(stage)}: ${blueprint.aroma_keywords.slice(0, 4).join(', ')}` : '');

  return {
    ...baseProfile,
    summary: aiSummary || baseProfile.summary,
    tags,
    stage_goal: stageStory,
    selected_labels: selectedLabels,
    preferred_letters: preferredLetters,
    preferred_functions: preferredFunctions,
    impact_band: impactBand,
    impact_summary: formatImpactBandLabel(impactBand),
    life_range_hours: lifeRange,
    life_summary: formatLifeRangeLabel(lifeRange),
    avoid_tags: uniqueLower([...(blueprint.avoid_tags || []), ...(aiIntent.avoidances || [])]),
    material_biases: aiIntent.material_biases || [],
    interpreted_terms: aiIntent.interpreted_terms || [],
    ai_intent_source: aiIntent.source,
    ai_confidence: aiIntent.confidence,
    scent_story: aiIntent.scent_story,
  };
};
