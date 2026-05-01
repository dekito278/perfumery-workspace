export const STAGES = ['top', 'middle', 'base'];
export const POST_STAGE_PHASES = ['review', 'formula', 'validation'];

export const stageColorMap = {
  top: 'bg-[#fff4df] text-[#8b5d00] border-[#f2d39a]',
  middle: 'bg-[#f9edea] text-[#8e4f3b] border-[#e9c1b4]',
  base: 'bg-[#efe8de] text-[#6a5439] border-[#d9c6ab]',
};

export const getEmptyDrafts = () => ({
  top: {},
  middle: {},
  base: {},
});

export const resolveActiveBoardStage = (currentStage) => {
  if (STAGES.includes(currentStage)) {
    return currentStage;
  }

  if (POST_STAGE_PHASES.includes(currentStage)) {
    return 'base';
  }

  return 'top';
};

export const getSelectedStageItems = (stageItemsMap, stage) =>
  (stageItemsMap.get(stage) || []).filter((item) => item.selection_state === 'selected' || item.selection_state === 'manual');

export const getStageStatusFromItems = (items) => (
  items.some((item) => item.selection_state === 'selected' || item.selection_state === 'manual')
    ? 'completed'
    : 'reviewed'
);

export const getFirstIncompleteQuestionIndex = (questions, answers = {}) => {
  const firstIncompleteIndex = questions.findIndex((question) => !answers?.[question.id]);
  return firstIncompleteIndex >= 0 ? firstIncompleteIndex : Math.max(questions.length - 1, 0);
};

export const formatDebugPercent = (value) => `${Math.round(Number(value || 0))}%`;
