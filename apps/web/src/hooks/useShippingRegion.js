import { useEffect, useState } from 'react';
import { detectShippingRegion } from '@/utils/shippingRegion.js';

/**
 * Southeast Asia, or the rest of the world — which decides which international price a reader is shown.
 *
 * Resolved in an EFFECT, never during render, for the same reason the shop language is: eighteen product
 * pages are prerendered, and a region decided while rendering would bake one visitor's answer into the
 * HTML Google indexes. Until the effect runs the answer is 'world', which is the dearer of the two and
 * therefore the safe one to show by mistake.
 */
export const useShippingRegion = () => {
  const [region, setRegion] = useState('world');
  useEffect(() => { setRegion(detectShippingRegion()); }, []);
  return region;
};

export default useShippingRegion;
