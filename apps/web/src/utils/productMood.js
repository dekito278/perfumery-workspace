// Every product in the catalogue stores the same mood: 'Custom perfume profile'. It is the value
// normalizeProduct writes when nobody supplies one, and until now nobody could — neither product form
// had a mood input. So it is a default masquerading as data.
//
// Two places need to agree about that. The product pages must not print it as if a perfumer chose it,
// and the forms must not pre-fill an editor with it, or the owner has to clear the same phrase
// eighteen times before typing anything real.
export const PLACEHOLDER_MOODS = [
  'custom perfume profile',
  'profil parfum custom',
  'profil parfum bespoke',
];

export const isPlaceholderMood = (mood) => (
  !mood || PLACEHOLDER_MOODS.includes(String(mood).trim().toLowerCase())
);

// What an editor should start with: a real mood, or nothing to clear.
export const moodForEditing = (mood) => (isPlaceholderMood(mood) ? '' : String(mood));

export default isPlaceholderMood;
