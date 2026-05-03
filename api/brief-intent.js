const { z } = require('zod');

const STAGES = ['top', 'middle', 'base'];

const stageBlueprintSchema = z.object({
  goal: z.string().default(''),
  aroma_keywords: z.array(z.string()).default([]),
  effect_tags: z.array(z.string()).default([]),
  preferred_letters: z.array(z.string()).default([]),
  preferred_functions: z.array(z.string()).default([]),
  impact_band: z.enum(['low', 'medium', 'high']).default('medium'),
  life_range_hours: z.tuple([z.number(), z.number()]).default([4, 96]),
  avoid_tags: z.array(z.string()).default([]),
});

const questionOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  tags: z.array(z.string()).default([]),
  hint: z.string().default(''),
});

const intentSchema = z.object({
  scent_story: z.string(),
  interpreted_terms: z.array(z.object({
    term: z.string(),
    meaning: z.string(),
  })).default([]),
  stage_blueprints: z.object({
    top: stageBlueprintSchema,
    middle: stageBlueprintSchema,
    base: stageBlueprintSchema,
  }),
  question_plan: z.object({
    top: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      options: z.array(questionOptionSchema).min(2).max(6),
    })).default([]),
    middle: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      options: z.array(questionOptionSchema).min(2).max(6),
    })).default([]),
    base: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      options: z.array(questionOptionSchema).min(2).max(6),
    })).default([]),
  }),
  material_biases: z.array(z.object({
    keyword: z.string(),
    weight: z.number().min(-2).max(2),
    rationale: z.string().default(''),
  })).default([]),
  avoidances: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  fallback_reason: z.string().default(''),
});

const gasFallbackIntent = {
  scent_story: 'Arah brief dibaca sebagai efek uap gas/fuel yang realistis: volatile, cold-air, ozonic, mineral, metallic, transparent, diffusive, sedikit solventy, tetapi tetap wearable dan tidak harsh.',
  interpreted_terms: [
    { term: 'gas', meaning: 'volatile fuel-vapor impression, cold metallic air, ozonic mineral lift' },
    { term: 'realistic', meaning: 'textural and believable, not a fruity/floral default' },
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
      avoid_tags: ['burnt_rubber', 'sulfur', 'overly_sweet'],
    },
    middle: {
      goal: 'Jaga heart tetap clean-industrial dan airy agar efek gas tidak berubah menjadi floral/fruity biasa.',
      aroma_keywords: ['transparent', 'mineral', 'metallic', 'clean_aromatic', 'dry_tea', 'cold_spice'],
      effect_tags: ['mineral', 'cool', 'spicy_ping'],
      preferred_letters: ['G', 'H', 'L', 'M', 'S'],
      preferred_functions: ['bridge', 'support', 'modifier'],
      impact_band: 'medium',
      life_range_hours: [10, 72],
      avoid_tags: ['jammy_fruit', 'dense_white_floral'],
    },
    base: {
      goal: 'Kunci drydown dengan mineral musk/wood yang bersih agar realism tetap aman, bukan smoky atau tarry.',
      aroma_keywords: ['mineral_musk', 'clean_wood', 'transparent_amber', 'dry_woods', 'skin_musk'],
      effect_tags: ['mineral', 'creamy_body'],
      preferred_letters: ['W', 'X', 'L', 'Q'],
      preferred_functions: ['support', 'fixative', 'blender', 'bridge'],
      impact_band: 'low',
      life_range_hours: [36, 180],
      avoid_tags: ['tar', 'burnt', 'animalic_dirty'],
    },
  },
  question_plan: {
    top: [{
      id: 'family',
      title: 'Fuel-vapor opening',
      description: 'Pilih cara top note menerjemahkan realisme gas/fuel.',
      options: [
        { value: 'cold_ozonic_vapor', label: 'Cold ozonic vapor', tags: ['ozonic', 'cold_air', 'mineral', 'transparent'], hint: 'Uap dingin, airy, dan sangat diffusive.' },
        { value: 'metallic_aldehydic_flash', label: 'Metallic aldehydic flash', tags: ['metallic', 'aldehydic', 'sparkling', 'bright'], hint: 'Kilat metalik dan sparkling untuk kesan volatil.' },
        { value: 'solventy_mineral_lift', label: 'Solventy mineral lift', tags: ['solventy', 'mineral', 'diffusive', 'dry'], hint: 'Sedikit laboratory/fuel nuance, tetap dikontrol.' },
      ],
    }],
    middle: [],
    base: [],
  },
  material_biases: [
    { keyword: 'ozonic', weight: 1.2, rationale: 'gas vapor realism' },
    { keyword: 'mineral', weight: 1.1, rationale: 'cold metallic air' },
    { keyword: 'metallic', weight: 1, rationale: 'industrial edge' },
    { keyword: 'aldehydic', weight: 0.9, rationale: 'volatile lift' },
  ],
  avoidances: ['burnt rubber', 'sulfur overload', 'too sweet fruity floral default'],
  confidence: 0.72,
  fallback_reason: 'Local gas/fuel concept interpreter',
};

const defaultFallbackIntent = {
  scent_story: 'AI intent belum tersedia, jadi wizard memakai fallback lokal dan deterministic recommendation engine.',
  interpreted_terms: [],
  stage_blueprints: Object.fromEntries(STAGES.map((stage) => [stage, {
    goal: `${stage} direction based on the existing wizard answers.`,
    aroma_keywords: [],
    effect_tags: [],
    preferred_letters: [],
    preferred_functions: [],
    impact_band: 'medium',
    life_range_hours: stage === 'top' ? [2, 24] : stage === 'middle' ? [10, 96] : [36, 240],
    avoid_tags: [],
  }])),
  question_plan: { top: [], middle: [], base: [] },
  material_biases: [],
  avoidances: [],
  confidence: 0.35,
  fallback_reason: 'AI gateway unavailable',
};

const buildFallbackIntent = (freeText, reason) => {
  const text = String(freeText || '').toLowerCase();
  const payload = /\b(gas|gasoline|bensin|fuel|petrol|vapor|uap)\b/i.test(text)
    ? gasFallbackIntent
    : defaultFallbackIntent;
  return {
    ...payload,
    source: 'fallback',
    model: 'deterministic-local',
    fallback_reason: reason || payload.fallback_reason,
  };
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const freeText = String(body.freeText || '').slice(0, 6000);
  const locale = body.locale || 'id-ID';

  if (!freeText.trim()) {
    return res.status(200).json(buildFallbackIntent('', 'Empty brief text'));
  }

  if (process.env.DISABLE_BRIEF_AI_INTENT === '1') {
    return res.status(200).json(buildFallbackIntent(freeText, 'AI intent disabled by environment'));
  }

  try {
    const { generateText, Output } = await import('ai');
    const model = process.env.BRIEF_INTENT_MODEL || 'openai/gpt-5.4';
    const prompt = [
      'You are a senior perfumer and formulation assistant.',
      'Interpret the user brief into a structured scent intent for a hybrid deterministic material recommendation engine.',
      'Return practical perfumery language, not marketing fluff. Do not invent material names.',
      'For unusual briefs like gas/fuel/metal/stone, preserve that direction using tags such as ozonic, mineral, metallic, aldehydic, solventy, transparent, diffusive, cold_air, and clear avoidances.',
      `Locale: ${locale}. Prefer Indonesian explanations with concise English scent terms when useful.`,
      `Brief: ${freeText}`,
      `Existing answers: ${JSON.stringify(body.existingAnswers || {})}`,
      `Feedback summary: ${JSON.stringify(body.feedbackSummary || {})}`,
      'Question plan should include adaptive family/nuance options per stage when it improves the brief fit.',
    ].join('\n\n');

    const result = await generateText({
      model,
      prompt,
      output: Output.object({ schema: intentSchema }),
      temperature: 0.25,
    });
    const object = result.output || result.object || result.experimental_output;
    const parsed = intentSchema.parse(object);

    return res.status(200).json({
      ...parsed,
      source: 'ai',
      model,
    });
  } catch (error) {
    console.error('brief-intent fallback:', error);
    return res.status(200).json(buildFallbackIntent(freeText, error?.message || 'AI intent failed'));
  }
};
