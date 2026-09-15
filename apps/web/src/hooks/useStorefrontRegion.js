import { useEffect, useState } from 'react';
import { detectOverseasVisitor } from '@/utils/overseasVisitor.js';
import {
  REGION_EN,
  REGION_ID,
  readStoredRegion,
  resolveRegion,
  writeStoredRegion,
} from '@/utils/storefrontRegion.js';

// One value shared by every component, with listeners — the same shape useTierPrices uses. Each component
// resolving its own would let the header say Indonesia while the price panel says international, and the
// two would disagree for a whole page view.
let current = REGION_ID;
let resolved = false;
const listeners = new Set();

// The page says what language it is in, and it has to stay true when the shop changes language.
//
// index.html ships lang="id", which is right for the prerendered HTML and right until a visitor picks
// the English shop — after which every word on screen is English and the document still claims to be
// Indonesian. A screen reader then pronounces English with Indonesian phonetics, which is the whole
// page for a blind buyer, and Chrome offers to translate a page that is already in the reader's
// language.
//
// Here rather than in the hook body: publish() is the one place a region change passes through, so the
// attribute cannot drift from the value the components are rendering.
const writeDocumentLanguage = (region) => {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = region === REGION_EN ? 'en' : 'id';
};

const publish = (next) => {
  current = next;
  writeDocumentLanguage(next);
  for (const listener of listeners) listener(next);
};

/**
 * The shop this visitor is looking at, and the way to change it.
 *
 * Resolved in an effect, never during render: the 18 product pages are prerendered, and a region decided
 * at render time would bake one visitor's answer into the HTML Google indexes. Until the effect runs the
 * answer is Indonesia, which is what the prerendered HTML already says.
 */
export const useStorefrontRegion = () => {
  const [region, setRegion] = useState(current);

  useEffect(() => {
    listeners.add(setRegion);
    if (!resolved) {
      resolved = true;
      publish(resolveRegion(readStoredRegion(), detectOverseasVisitor()));
    } else {
      setRegion(current);
    }
    return () => { listeners.delete(setRegion); };
  }, []);

  return {
    region,
    isInternational: region === REGION_EN,
    setRegion: (next) => {
      if (next !== REGION_ID && next !== REGION_EN) return;
      // Written first, then published: a choice that does not survive a reload is still a choice for
      // this page view, and writeStoredRegion refuses silently rather than throwing when storage is
      // blocked.
      writeStoredRegion(next);
      publish(next);
    },
  };
};

export default useStorefrontRegion;
