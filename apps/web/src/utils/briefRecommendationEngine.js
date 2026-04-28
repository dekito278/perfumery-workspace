const KEYWORD_GROUPS = {
  rose: ['rose', 'mawar', 'rosy'],
  floral: ['floral', 'flower', 'bunga', 'jasmine', 'melati', 'tuberose', 'ylang', 'violet', 'iris', 'peony'],
  desert: ['desert', 'padang pasir', 'sand', 'pasir', 'dry heat', 'sun-baked', 'sun baked', 'arid'],
  woody: ['woody', 'wood', 'cedar', 'sandalwood', 'gaharu', 'oud', 'patchouli', 'vetiver'],
  fresh: ['fresh', 'clean', 'airy', 'aquatic', 'green', 'citrus', 'bergamot', 'lemon', 'tea'],
  sweet: ['sweet', 'gourmand', 'vanilla', 'caramel', 'candy', 'sugar', 'dessert'],
  dark: ['dark', 'smoky', 'mysterious', 'incense', 'resin', 'amber', 'leather'],
  office: ['office', 'professional', 'formal', 'daily', 'work', 'meeting'],
  night: ['night', 'evening', 'date', 'sensual', 'seductive', 'intimate'],
  unisex: ['unisex', 'genderless', 'shared'],
  feminine: ['feminine', 'woman', 'women', 'female'],
  masculine: ['masculine', 'man', 'men', 'male'],
  luxury: ['luxury', 'premium', 'elegant', 'high-end', 'exclusive'],
  budget: ['budget', 'affordable', 'cheap', 'efficient', 'cost aware', 'cost-sensitive'],
  strong: ['strong', 'bold', 'powerful', 'beast mode', 'projecting', 'loud'],
  soft: ['soft', 'comforting', 'smooth', 'skin scent', 'subtle', 'gentle'],
  longLasting: ['long lasting', 'long-lasting', 'tenacious', 'lasting', 'all day', '12 jam', '8 jam'],
};

const containsAny = (text, words) => words.some((word) => text.includes(word));

const titleCase = (value) => value
  .split(/\s+/)
  .filter(Boolean)
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

const inferTitle = (description) => {
  const cleaned = String(description || '').trim();
  if (!cleaned) {
    return '';
  }

  const shortTitle = cleaned
    .replace(/[.,!?;:]/g, ' ')
    .split(/\s+/)
    .slice(0, 6)
    .join(' ');

  return titleCase(shortTitle);
};

export const generateBriefRecommendations = (description) => {
  const normalized = String(description || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const flags = Object.fromEntries(
    Object.entries(KEYWORD_GROUPS).map(([key, words]) => [key, containsAny(normalized, words)])
  );

  const moodParts = [];
  const audienceParts = [];
  const performanceParts = [];
  const budgetParts = [];
  const tags = [];

  if (flags.rose) {
    moodParts.push('Rose-forward floral heart with a clear petal signature.');
    tags.push('rose');
  }

  if (flags.floral && !flags.rose) {
    moodParts.push('Floral-driven profile with expressive bloom in the core structure.');
    tags.push('floral');
  }

  if (flags.desert) {
    moodParts.push('Dry, sunlit, expansive atmosphere with a sandy and heat-polished impression.');
    performanceParts.push('Keep the opening radiant but avoid too much watery freshness so the arid mood stays intact.');
    budgetParts.push('Use dry woods, amber, spice, and rose modifiers to create heat and air without overloading the formula.');
    tags.push('desert');
  }

  if (flags.woody) {
    moodParts.push('Support the core with woody texture so the scent feels grounded and dimensional.');
    tags.push('woody');
  }

  if (flags.fresh) {
    moodParts.push('Maintain breathable lift so the scent opens cleanly and does not feel heavy too early.');
    performanceParts.push('Prioritize opening clarity and smooth transition into the heart.');
    tags.push('fresh');
  }

  if (flags.dark) {
    moodParts.push('Introduce darker shadow or resin depth in the drydown to add contrast.');
    performanceParts.push('Let the base arrive gradually so the mood deepens without collapsing the floral identity.');
    tags.push('dark');
  }

  if (flags.office) {
    audienceParts.push('Targeted for polished daily wear, professional settings, and close-range social space.');
    performanceParts.push('Moderate diffusion with a clean, controlled trail is preferable.');
    tags.push('office');
  }

  if (flags.night) {
    audienceParts.push('Designed for evening wear, intimate settings, or more dramatic personal presence.');
    performanceParts.push('Allow stronger projection and richer drydown density than a daytime formula.');
    tags.push('night');
  }

  if (flags.unisex) {
    audienceParts.push('Keep the composition unisex by balancing floral beauty with texture, dryness, or woods.');
    tags.push('unisex');
  } else if (flags.feminine) {
    audienceParts.push('Lean the emotional profile toward a feminine floral expression.');
    tags.push('feminine');
  } else if (flags.masculine) {
    audienceParts.push('Balance floral notes with woods, spice, or mineral dryness for a more masculine profile.');
    tags.push('masculine');
  }

  if (flags.strong) {
    performanceParts.push('Target strong projection and noticeable presence in the first few hours.');
    budgetParts.push('Watch for overload in loud materials so intensity stays intentional, not harsh.');
    tags.push('strong');
  }

  if (flags.soft) {
    performanceParts.push('Aim for softness, comfort, and better skin feel over loud projection.');
    tags.push('soft');
  }

  if (flags.longLasting) {
    performanceParts.push('Prioritize tenacity and drydown persistence with stable heart-to-base bridging.');
    tags.push('long-lasting');
  }

  if (flags.luxury) {
    budgetParts.push('Allow premium structure and higher-cost materials where they materially improve realism or texture.');
    tags.push('luxury');
  }

  if (flags.budget) {
    budgetParts.push('Keep the architecture cost-aware by limiting expensive naturals and using efficient support materials.');
    tags.push('budget-aware');
  }

  if (!audienceParts.length) {
    audienceParts.push('Suitable for modern personal wear with a clear identity and easy evaluation path.');
  }

  if (!performanceParts.length) {
    performanceParts.push('Target a readable opening, coherent heart, smooth bridge into drydown, and no abrupt collapse.');
  }

  if (!budgetParts.length) {
    budgetParts.push('Balance beauty and cost by protecting hero materials and using support materials for lift, bridge, and endurance.');
  }

  if (!moodParts.length) {
    moodParts.push('Translate the description into a clear scent world with one memorable emotional image and one structural anchor.');
  }

  return {
    title: inferTitle(description),
    mood_story: moodParts.join(' '),
    audience_usage: audienceParts.join(' '),
    performance_target: performanceParts.join(' '),
    budget_direction: budgetParts.join(' '),
    tags,
  };
};
