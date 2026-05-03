import {
  createFallbackBriefAiIntent,
  normalizeBriefAiIntent,
} from '@/utils/briefAiIntent.js';

export const requestBriefAiIntent = async ({
  brief = null,
  payload = {},
} = {}) => {
  try {
    const response = await fetch('/api/brief-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Brief intent request failed (${response.status})`);
    }

    const data = await response.json();
    return normalizeBriefAiIntent(data, data?.source || 'ai');
  } catch (error) {
    console.error('Falling back to local brief intent:', error);
    return createFallbackBriefAiIntent({
      freeText: payload?.freeText || '',
      brief,
    });
  }
};
