// A product name that carries its own Javanese script, split into the two lines the storefront sets.
//
// "Ayang-ayang (ꦲꦪꦤ꧀ꦒ꧀​ꦲꦪꦤ꧀ꦒ꧀)" is how Studio stores it: one field, the aksara in brackets. The redesign
// sets the Latin name in the display face and the aksara under it in Noto Sans Javanese, so a page
// needs them apart — and only the name itself, never a guess: a product with no aksara in its name gets
// none (writing a transliteration here would be inventing a fact about the product).

const JAVANESE = /[ꦀ-꧟]/;
const TRAILING_SCRIPT = /^(.*?)\s*\(([^()]*)\)\s*$/;

export const splitScriptName = (name) => {
  const text = String(name ?? '').trim();
  const match = text.match(TRAILING_SCRIPT);
  if (!match || !JAVANESE.test(match[2])) return { name: text, script: '' };
  return { name: match[1].trim() || text, script: match[2].trim() };
};

export default splitScriptName;
