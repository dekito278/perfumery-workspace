const STAGE_LABELS = {
  top: 'Top',
  middle: 'Middle',
  base: 'Base',
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
  };
};
