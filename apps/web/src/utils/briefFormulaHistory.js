const normalizeText = (value) => String(value || '').trim().toLowerCase();

const tokenize = (value) => normalizeText(value)
  .split(/[^a-z0-9]+/g)
  .filter((token) => token.length >= 3);

export const buildBriefContextText = (brief = null) => [
  brief?.title,
  brief?.mood_story,
  brief?.audience_usage,
  brief?.performance_target,
  brief?.budget_direction,
].filter(Boolean).join(' ');

const buildTokenSet = (brief) => new Set(tokenize(buildBriefContextText(brief)));

const computeBriefSimilarity = (currentBrief, candidateBrief) => {
  const currentTokens = buildTokenSet(currentBrief);
  const candidateTokens = buildTokenSet(candidateBrief);

  if (!currentTokens.size || !candidateTokens.size) {
    return 0;
  }

  let overlap = 0;
  currentTokens.forEach((token) => {
    if (candidateTokens.has(token)) {
      overlap += 1;
    }
  });

  const titleBoost = tokenize(candidateBrief?.title).some((token) => currentTokens.has(token)) ? 0.4 : 0;
  return overlap + titleBoost;
};

export const selectRelatedBriefFormulaIds = ({
  briefs = [],
  currentBrief = null,
  excludeFormulaId = '',
  limit = 12,
} = {}) => {
  const excludedId = String(excludeFormulaId || '');

  return (briefs || [])
    .filter((brief) => brief?.formula_id && String(brief.formula_id) !== excludedId && (!currentBrief || brief.id !== currentBrief.id))
    .map((brief) => ({
      formulaId: String(brief.formula_id),
      briefText: buildBriefContextText(brief),
      similarity: currentBrief ? computeBriefSimilarity(currentBrief, brief) : 0,
    }))
    .filter((entry) => entry.similarity > 0)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, limit);
};
