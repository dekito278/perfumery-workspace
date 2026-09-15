import { REGION_EN } from '../../utils/storefrontRegion.js';
import ayangAyang from './ayang-ayang.js';
import ayangAyangEn from './ayang-ayang.en.js';

// One entry per product, and the English story is optional. A product whose story exists only in
// Indonesian answers null for the English shop rather than falling back to it: an overseas buyer scrolled
// through a full-screen Javanese letter they could not read, which is worse than the ordinary product
// page they get instead.
const stories = {
  'ayang-ayang': { id: ayangAyang, en: ayangAyangEn },
};

export const getProductStory = (slug, region) => {
  const pair = stories[slug];
  if (!pair) return null;
  return region === REGION_EN ? (pair.en || null) : pair.id;
};

export const hasProductStory = (slug, region) => Boolean(getProductStory(slug, region));
