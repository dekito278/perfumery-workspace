import {
  createEmptyRecommendationFeedbackContext,
  deserializeRecommendationFeedbackContext,
  serializeRecommendationFeedbackContext,
} from '@/utils/materialCompositionProfile.js';

const STORAGE_PREFIX = 'perfumer-studio.recommendation-learning.v1';
const buildStorageKey = (userId) => `${STORAGE_PREFIX}:${userId}`;

export const readPersistedRecommendationLearning = (userId) => {
  if (!userId || typeof window === 'undefined') {
    return createEmptyRecommendationFeedbackContext();
  }

  try {
    const rawValue = window.localStorage.getItem(buildStorageKey(userId));
    if (!rawValue) {
      return createEmptyRecommendationFeedbackContext();
    }
    return deserializeRecommendationFeedbackContext(JSON.parse(rawValue));
  } catch {
    return createEmptyRecommendationFeedbackContext();
  }
};

export const writePersistedRecommendationLearning = (userId, context) => {
  if (!userId || typeof window === 'undefined' || !context) {
    return;
  }

  try {
    window.localStorage.setItem(
      buildStorageKey(userId),
      JSON.stringify(serializeRecommendationFeedbackContext(context)),
    );
  } catch {
    // Keep the recommendation flow usable even if browser storage fails.
  }
};
