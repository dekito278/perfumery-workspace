import ayangAyang from './ayang-ayang.js';

const stories = {
  'ayang-ayang': ayangAyang,
};

export const getProductStory = (slug) => stories[slug] || null;
export const hasProductStory = (slug) => slug in stories;
