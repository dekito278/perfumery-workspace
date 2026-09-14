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

const publish = (next) => {
  current = next;
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
