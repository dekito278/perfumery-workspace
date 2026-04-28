const STAGE_LABELS = {
  top: 'Top',
  middle: 'Middle',
  base: 'Base',
};

const DEFAULT_STAGE_TARGETS = {
  top: {
    preferred_letters: ['C', 'G', 'H', 'F', 'B', 'L', 'M'],
    preferred_functions: ['diffuser', 'modifier', 'support', 'hero'],
    impact_band: 'medium',
    life_range_hours: [2, 24],
  },
  middle: {
    preferred_letters: ['R', 'J', 'M', 'L', 'S', 'F', 'O', 'N'],
    preferred_functions: ['hero', 'bridge', 'support', 'blender', 'modifier'],
    impact_band: 'medium',
    life_range_hours: [10, 96],
  },
  base: {
    preferred_letters: ['W', 'Q', 'X', 'Y', 'V', 'T', 'U'],
    preferred_functions: ['fixative', 'support', 'blender', 'bridge', 'hero'],
    impact_band: 'medium',
    life_range_hours: [36, 240],
  },
};

const TAG_SIGNAL_MAP = {
  citrus: { letters: ['C'], functions: ['diffuser', 'modifier'], impact_band: 'medium', life_hint: [2, 16] },
  sparkling: { letters: ['B', 'C'], functions: ['diffuser'], impact_band: 'high', life_hint: [2, 12] },
  bright: { letters: ['B', 'C', 'L'], functions: ['diffuser', 'modifier'], impact_band: 'high', life_hint: [2, 18] },
  aromatic: { letters: ['H', 'G'], functions: ['diffuser', 'support'], impact_band: 'medium', life_hint: [4, 30] },
  clean: { letters: ['A', 'L', 'M', 'X'], functions: ['blender', 'support'], impact_band: 'low', life_hint: [4, 72] },
  fresh: { letters: ['C', 'G', 'H', 'M'], functions: ['diffuser', 'modifier'], impact_band: 'medium', life_hint: [2, 24] },
  fruit: { letters: ['F'], functions: ['hero', 'modifier'], impact_band: 'medium', life_hint: [6, 36] },
  juicy: { letters: ['F'], functions: ['hero', 'modifier'], impact_band: 'high', life_hint: [4, 30] },
  green: { letters: ['G', 'H'], functions: ['modifier', 'support'], impact_band: 'medium', life_hint: [4, 36] },
  crisp: { letters: ['G', 'C', 'M'], functions: ['diffuser', 'modifier'], impact_band: 'medium', life_hint: [2, 18] },
  spice: { letters: ['S', 'P'], functions: ['modifier', 'hero'], impact_band: 'medium', life_hint: [8, 96] },
  airy: { letters: ['B', 'L', 'M'], functions: ['diffuser', 'bridge'], impact_band: 'low', life_hint: [2, 18] },
  lift: { letters: ['B', 'C', 'L'], functions: ['diffuser'], impact_band: 'high', life_hint: [2, 18] },
  petal: { letters: ['R', 'M', 'J'], functions: ['hero', 'bridge'], impact_band: 'medium', life_hint: [6, 72] },
  floral: { letters: ['J', 'L', 'M', 'N', 'R'], functions: ['hero', 'bridge', 'support'], impact_band: 'medium', life_hint: [8, 96] },
  rose: { letters: ['R'], functions: ['hero', 'bridge'], impact_band: 'medium', life_hint: [10, 120] },
  tea: { letters: ['H', 'M', 'L'], functions: ['bridge', 'modifier'], impact_band: 'low', life_hint: [6, 48] },
  powder: { letters: ['I', 'X'], functions: ['blender', 'support'], impact_band: 'low', life_hint: [18, 120] },
  soft: { letters: ['L', 'M', 'X'], functions: ['blender', 'support'], impact_band: 'low', life_hint: [6, 72] },
  warm: { letters: ['Q', 'V', 'W'], functions: ['support', 'hero'], impact_band: 'medium', life_hint: [18, 168] },
  creamy: { letters: ['D', 'V', 'W'], functions: ['blender', 'support'], impact_band: 'medium', life_hint: [18, 144] },
  milky: { letters: ['D', 'V'], functions: ['blender', 'support'], impact_band: 'low', life_hint: [18, 120] },
  sandalwood: { letters: ['W'], functions: ['support', 'fixative', 'bridge'], impact_band: 'medium', life_hint: [36, 240] },
  vanilla: { letters: ['V'], functions: ['support', 'blender'], impact_band: 'medium', life_hint: [30, 240] },
  cedar: { letters: ['W'], functions: ['support', 'fixative'], impact_band: 'medium', life_hint: [30, 240] },
  vetiver: { letters: ['W', 'Y'], functions: ['support', 'fixative'], impact_band: 'medium', life_hint: [30, 240] },
  woody: { letters: ['W', 'Y'], functions: ['support', 'fixative', 'bridge'], impact_band: 'medium', life_hint: [24, 240] },
  amber: { letters: ['Q', 'V'], functions: ['support', 'fixative', 'hero'], impact_band: 'medium', life_hint: [30, 240] },
  resin: { letters: ['Q', 'T'], functions: ['support', 'fixative'], impact_band: 'medium', life_hint: [30, 240] },
  musk: { letters: ['X'], functions: ['fixative', 'blender', 'support'], impact_band: 'low', life_hint: [36, 240] },
  skin: { letters: ['X', 'I'], functions: ['blender', 'support'], impact_band: 'low', life_hint: [24, 240] },
  patchouli: { letters: ['Y', 'W', 'Q'], functions: ['hero', 'fixative', 'support'], impact_band: 'medium', life_hint: [36, 240] },
  earthy: { letters: ['Y'], functions: ['support', 'fixative'], impact_band: 'low', life_hint: [36, 240] },
  dark: { letters: ['Y', 'T', 'Q'], functions: ['hero', 'fixative'], impact_band: 'medium', life_hint: [36, 240] },
  oud: { letters: ['T', 'W', 'Q'], functions: ['hero', 'fixative', 'support'], impact_band: 'high', life_hint: [36, 240] },
  smoky: { letters: ['T', 'Q'], functions: ['hero', 'modifier'], impact_band: 'medium', life_hint: [24, 240] },
  persistent: { functions: ['fixative', 'support'], impact_band: 'medium', life_hint: [72, 240] },
  tenacious: { functions: ['fixative', 'support'], impact_band: 'medium', life_hint: [72, 240] },
  projecting: { functions: ['diffuser', 'hero'], impact_band: 'high', life_hint: [4, 36] },
  controlled: { functions: ['bridge', 'blender', 'support'], impact_band: 'medium', life_hint: [12, 96] },
  balanced: { functions: ['bridge', 'support', 'blender'], impact_band: 'medium', life_hint: [12, 120] },
  lush: { functions: ['hero', 'support'], impact_band: 'high', life_hint: [18, 144] },
  sheer: { functions: ['diffuser', 'bridge'], impact_band: 'low', life_hint: [4, 36] },
};

const IMPACT_BAND_RANK = {
  low: 0,
  medium: 1,
  high: 2,
};

const createQuestion = (id, title, optionsByBranch, defaultBranch = 'default') => ({
  id,
  title,
  optionsByBranch,
  defaultBranch,
});

const questionBank = {
  top: [
    createQuestion('family', 'Opening tone', {
      default: [
        { value: 'citrus_sparkling', label: 'Citrus sparkling', tags: ['citrus', 'sparkling', 'bright'] },
        { value: 'aromatic_clean', label: 'Aromatic clean', tags: ['aromatic', 'clean', 'fresh'] },
        { value: 'fruity_juicy', label: 'Fruity juicy', tags: ['fruit', 'juicy', 'playful'] },
        { value: 'green_crisp', label: 'Green crisp', tags: ['green', 'crisp', 'fresh'] },
        { value: 'spicy_airy', label: 'Spicy airy', tags: ['spice', 'airy', 'lift'] },
        { value: 'petal_lift', label: 'Petal lift', tags: ['petal', 'floral', 'lift'] },
      ],
    }),
    createQuestion('nuance', 'Opening texture', {
      citrus_sparkling: [
        { value: 'zesty_peel', label: 'Zesty peel', tags: ['zesty', 'peel', 'dry citrus'] },
        { value: 'cold_sparkle', label: 'Cold sparkle', tags: ['sparkle', 'cold', 'clean'] },
        { value: 'sunlit_soft', label: 'Sunlit soft', tags: ['sunlit', 'soft', 'warm citrus'] },
      ],
      aromatic_clean: [
        { value: 'lavender_soap', label: 'Lavender clean', tags: ['lavender', 'clean', 'soapy'] },
        { value: 'herbal_breeze', label: 'Herbal breeze', tags: ['herbal', 'breeze', 'airy'] },
        { value: 'tea_crisp', label: 'Tea crisp', tags: ['tea', 'crisp', 'sheer'] },
      ],
      fruity_juicy: [
        { value: 'berry_glow', label: 'Berry glow', tags: ['berry', 'bright', 'soft sweet'] },
        { value: 'pear_fresh', label: 'Pear fresh', tags: ['pear', 'fresh', 'watery'] },
        { value: 'stonefruit_velvet', label: 'Stonefruit velvet', tags: ['apricot', 'velvet', 'round'] },
      ],
      green_crisp: [
        { value: 'leaf_snap', label: 'Leaf snap', tags: ['leafy', 'snap', 'green'] },
        { value: 'stem_bite', label: 'Stem bite', tags: ['stemmy', 'dry green', 'sharp'] },
        { value: 'galbanum_air', label: 'Galbanum air', tags: ['galbanum', 'airy green', 'bright'] },
      ],
      spicy_airy: [
        { value: 'pink_pepper', label: 'Pink pepper glow', tags: ['pepper', 'sparkle', 'rosy spice'] },
        { value: 'cardamom_cool', label: 'Cardamom cool', tags: ['cardamom', 'cool', 'lift'] },
        { value: 'saffron_sheer', label: 'Saffron sheer', tags: ['saffron', 'sheer', 'dry'] },
      ],
      petal_lift: [
        { value: 'dewy_petals', label: 'Dewy petals', tags: ['petal', 'dewy', 'fresh floral'] },
        { value: 'powder_petals', label: 'Powder petals', tags: ['powder', 'petal', 'soft'] },
        { value: 'rose_water_air', label: 'Rose water air', tags: ['rose', 'airy', 'clean floral'] },
      ],
      default: [
        { value: 'clear_lift', label: 'Clear lift', tags: ['clear', 'lift'] },
      ],
    }),
    createQuestion('intensity', 'Opening projection', {
      default: [
        { value: 'soft', label: 'Soft', tags: ['soft', 'close'] },
        { value: 'balanced', label: 'Balanced', tags: ['balanced', 'controlled'] },
        { value: 'vivid', label: 'Vivid', tags: ['vivid', 'projecting'] },
      ],
    }),
  ],
  middle: [
    createQuestion('family', 'Heart identity', {
      default: [
        { value: 'rose_petals', label: 'Rose petals', tags: ['rose', 'petal', 'floral'] },
        { value: 'clean_floral', label: 'Clean floral', tags: ['clean floral', 'transparent', 'sheer'] },
        { value: 'creamy_floral', label: 'Creamy floral', tags: ['creamy', 'floral', 'round'] },
        { value: 'spicy_floral', label: 'Spicy floral', tags: ['spice', 'floral', 'warm'] },
        { value: 'fruity_floral', label: 'Fruity floral', tags: ['fruit', 'floral', 'juicy'] },
        { value: 'woody_floral', label: 'Woody floral', tags: ['wood', 'floral', 'textured'] },
      ],
    }),
    createQuestion('nuance', 'Heart texture', {
      rose_petals: [
        { value: 'fresh_rose', label: 'Fresh rose', tags: ['fresh rose', 'natural petals'] },
        { value: 'jammy_rose', label: 'Jammy rose', tags: ['jammy', 'rose', 'sweet'] },
        { value: 'dry_rose', label: 'Dry rose', tags: ['dry rose', 'spicy', 'elegant'] },
      ],
      clean_floral: [
        { value: 'soapy_white', label: 'Soapy white floral', tags: ['soapy', 'white floral', 'clean'] },
        { value: 'tea_floral', label: 'Tea floral', tags: ['tea', 'floral', 'airy'] },
        { value: 'aldehydic_floral', label: 'Aldehydic floral', tags: ['aldehydic', 'bright', 'floral'] },
      ],
      creamy_floral: [
        { value: 'milky_petals', label: 'Milky petals', tags: ['milky', 'petal', 'soft'] },
        { value: 'sandal_floral', label: 'Sandal floral', tags: ['sandalwood', 'cream', 'floral'] },
        { value: 'vanillic_floral', label: 'Vanillic floral', tags: ['vanilla', 'creamy', 'floral'] },
      ],
      spicy_floral: [
        { value: 'clove_rose', label: 'Clove rose', tags: ['clove', 'rose', 'warm spice'] },
        { value: 'pepper_petals', label: 'Pepper petals', tags: ['pepper', 'petals', 'dry floral'] },
        { value: 'saffron_rose', label: 'Saffron rose', tags: ['saffron', 'rose', 'dry luxury'] },
      ],
      fruity_floral: [
        { value: 'berry_rose', label: 'Berry rose', tags: ['berry', 'rose', 'lush'] },
        { value: 'lychee_floral', label: 'Lychee floral', tags: ['lychee', 'floral', 'bright'] },
        { value: 'peach_petals', label: 'Peach petals', tags: ['peach', 'petals', 'round'] },
      ],
      woody_floral: [
        { value: 'cedar_rose', label: 'Cedar rose', tags: ['cedar', 'rose', 'dry wood'] },
        { value: 'cashmere_floral', label: 'Cashmere floral', tags: ['cashmere wood', 'soft wood', 'floral'] },
        { value: 'vetiver_floral', label: 'Vetiver floral', tags: ['vetiver', 'floral', 'textured'] },
      ],
      default: [
        { value: 'balanced_theme', label: 'Balanced theme', tags: ['balanced', 'heart'] },
      ],
    }),
    createQuestion('body', 'Heart body', {
      default: [
        { value: 'airy', label: 'Airy', tags: ['airy', 'sheer'] },
        { value: 'balanced', label: 'Balanced', tags: ['balanced', 'body'] },
        { value: 'lush', label: 'Lush', tags: ['lush', 'full'] },
      ],
    }),
  ],
  base: [
    createQuestion('family', 'Base backbone', {
      default: [
        { value: 'creamy_wood', label: 'Creamy wood', tags: ['creamy wood', 'sandalwood', 'soft wood'] },
        { value: 'dry_wood', label: 'Dry wood', tags: ['dry wood', 'cedar', 'structured'] },
        { value: 'amber_resin', label: 'Amber resin', tags: ['amber', 'resin', 'warm'] },
        { value: 'musk_skin', label: 'Musk skin', tags: ['musk', 'skin', 'soft'] },
        { value: 'earth_patchouli', label: 'Earthy patchouli', tags: ['patchouli', 'earthy', 'dark'] },
        { value: 'smoky_oud', label: 'Smoky oud nuance', tags: ['oud', 'smoky', 'deep'] },
      ],
    }),
    createQuestion('nuance', 'Base texture', {
      creamy_wood: [
        { value: 'sandal_soft', label: 'Sandal soft', tags: ['sandalwood', 'milky', 'soft'] },
        { value: 'cashmere_warm', label: 'Cashmere warm', tags: ['cashmere wood', 'warm', 'smooth'] },
        { value: 'vanillic_wood', label: 'Vanillic wood', tags: ['vanilla', 'wood', 'creamy'] },
      ],
      dry_wood: [
        { value: 'cedar_sharp', label: 'Cedar sharp', tags: ['cedar', 'sharp', 'dry'] },
        { value: 'vetiver_dry', label: 'Vetiver dry', tags: ['vetiver', 'dry', 'earthy'] },
        { value: 'mineral_wood', label: 'Mineral wood', tags: ['mineral', 'woody', 'clean'] },
      ],
      amber_resin: [
        { value: 'balsamic_glow', label: 'Balsamic glow', tags: ['balsamic', 'amber', 'warm'] },
        { value: 'golden_amber', label: 'Golden amber', tags: ['golden amber', 'smooth', 'radiant'] },
        { value: 'incense_resin', label: 'Incense resin', tags: ['incense', 'resin', 'deep'] },
      ],
      musk_skin: [
        { value: 'clean_skin', label: 'Clean skin', tags: ['clean musk', 'skin'] },
        { value: 'cotton_soft', label: 'Cotton soft', tags: ['cotton', 'soft musk'] },
        { value: 'powder_musk', label: 'Powder musk', tags: ['powder', 'musk'] },
      ],
      earth_patchouli: [
        { value: 'cocoa_patchouli', label: 'Cocoa patchouli', tags: ['cocoa', 'patchouli', 'dark'] },
        { value: 'dry_patchouli', label: 'Dry patchouli', tags: ['dry patchouli', 'woody'] },
        { value: 'mossy_patchouli', label: 'Mossy patchouli', tags: ['moss', 'patchouli', 'green dark'] },
      ],
      smoky_oud: [
        { value: 'smoke_trace', label: 'Smoke trace', tags: ['smoke', 'trace', 'dry'] },
        { value: 'oud_polish', label: 'Polished oud', tags: ['oud', 'polished', 'luxury'] },
        { value: 'resin_oud', label: 'Resin oud', tags: ['oud', 'resin', 'dense'] },
      ],
      default: [
        { value: 'steady_base', label: 'Steady base', tags: ['steady', 'base'] },
      ],
    }),
    createQuestion('tenacity', 'Drydown persistence', {
      default: [
        { value: 'clean', label: 'Clean and easy', tags: ['clean', 'easy drydown'] },
        { value: 'balanced', label: 'Balanced longevity', tags: ['balanced longevity'] },
        { value: 'persistent', label: 'Persistent and present', tags: ['persistent', 'tenacious'] },
      ],
    }),
  ],
};

const getOptionsForQuestion = (question, answers) => {
  const branchKey = answers?.family || answers?.nuance || question.defaultBranch;
  return question.optionsByBranch[branchKey] || question.optionsByBranch.default || [];
};

const getSelectedOption = (question, value, answers) => getOptionsForQuestion(question, answers)
  .find((option) => option.value === value) || null;

const clampLifeRange = (stage, range) => {
  const [defaultMin, defaultMax] = DEFAULT_STAGE_TARGETS[stage]?.life_range_hours || [4, 120];
  const [inputMin, inputMax] = Array.isArray(range) ? range : [defaultMin, defaultMax];
  const min = Math.max(0, Number.isFinite(inputMin) ? inputMin : defaultMin);
  const max = Math.max(min, Number.isFinite(inputMax) ? inputMax : defaultMax);
  return [min, max];
};

const mergeImpactBand = (currentBand, nextBand) => {
  if (!nextBand) {
    return currentBand;
  }

  if (!currentBand) {
    return nextBand;
  }

  return IMPACT_BAND_RANK[nextBand] > IMPACT_BAND_RANK[currentBand] ? nextBand : currentBand;
};

const buildPreferenceSet = (values) => [...new Set(values.filter(Boolean))];

const buildStructuredStageIntent = (stage, tags = []) => {
  const defaults = DEFAULT_STAGE_TARGETS[stage] || DEFAULT_STAGE_TARGETS.middle;
  const letters = [...defaults.preferred_letters];
  const functions = [...defaults.preferred_functions];
  let impactBand = defaults.impact_band;
  let lifeRange = [...defaults.life_range_hours];

  tags.forEach((tag) => {
    const signal = TAG_SIGNAL_MAP[String(tag || '').trim().toLowerCase()];
    if (!signal) {
      return;
    }

    letters.push(...(signal.letters || []));
    functions.push(...(signal.functions || []));
    impactBand = mergeImpactBand(impactBand, signal.impact_band || null);

    if (signal.life_hint) {
      const [signalMin, signalMax] = signal.life_hint;
      const [currentMin, currentMax] = lifeRange;
      lifeRange = [
        Math.min(currentMin, signalMin),
        Math.max(currentMax, signalMax),
      ];
    }
  });

  const distinctLetters = buildPreferenceSet(letters);
  const distinctFunctions = buildPreferenceSet(functions);
  const normalizedLifeRange = clampLifeRange(stage, lifeRange);

  return {
    preferred_letters: distinctLetters,
    preferred_functions: distinctFunctions,
    impact_band: impactBand,
    life_range_hours: normalizedLifeRange,
  };
};

export const getWizardQuestionsForStage = (stage, answers = {}) => {
  const normalizedStage = String(stage || '').trim().toLowerCase();
  return (questionBank[normalizedStage] || []).map((question) => ({
    ...question,
    options: getOptionsForQuestion(question, answers),
  }));
};

export const getStageLabel = (stage) => STAGE_LABELS[stage] || 'Stage';

export const buildStageTargetProfile = (stage, answers = {}, brief = null) => {
  const questions = getWizardQuestionsForStage(stage, answers);
  const selectedOptions = questions
    .map((question) => getSelectedOption(question, answers[question.id], answers))
    .filter(Boolean);
  const tags = [...new Set(selectedOptions.flatMap((option) => option.tags || []))];
  const structuredIntent = buildStructuredStageIntent(stage, tags);
  const summary = selectedOptions.map((option) => option.label).join(' - ');
  const briefContext = [
    brief?.mood_story,
    brief?.audience_usage,
    brief?.performance_target,
  ].filter(Boolean).join(' ');

  const stageGoal = {
    top: 'Focus on lift, clarity, and a convincing opening image.',
    middle: 'Focus on the main identity, body, and emotional theme.',
    base: 'Focus on support, persistence, and drydown harmony.',
  }[stage] || '';

  return {
    summary: summary || `${getStageLabel(stage)} direction`,
    tags,
    brief_context: briefContext,
    stage_goal: stageGoal,
    preferred_letters: structuredIntent.preferred_letters,
    preferred_functions: structuredIntent.preferred_functions,
    impact_band: structuredIntent.impact_band,
    life_range_hours: structuredIntent.life_range_hours,
  };
};
