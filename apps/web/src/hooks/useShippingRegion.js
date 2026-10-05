import { useEffect, useState } from 'react';
import { detectShippingRegion, shippingRegionForCountry } from '@/utils/shippingRegion.js';
import { useShippingDestination } from '@/hooks/useShippingDestination.js';

/**
 * Southeast Asia, or the rest of the world — which decides which international price a reader is shown.
 *
 * THE PICKED DESTINATION OUTRANKS THE GUESS, and that is the point of this hook rather than a detail of
 * it. Until 2026-10-05 this answered purely from `detectShippingRegion()` — the browser's clock, with
 * ?ship= as an override — so the price followed a guess about WHO WAS READING. Two readers in the same
 * city could be charged differently for the same parcel because one of them had an English browser, and
 * that is the form of two-tier pricing that cannot be said out loud. Dekito's decision, 2026-10-05: the
 * price follows the DESTINATION the buyer selects. See the note at the top of shippingDestination.js.
 *
 * The clock is not gone, it is demoted to the default — which is all a guess was ever good for. A reader
 * who has not touched the picker sees exactly what they saw before, so nothing regresses while the
 * picker sits untouched.
 *
 * ?dest=DE therefore also beats ?ship=asia when both are on the address. The more specific override wins,
 * and it is the only one of the two that can also quote the shipping.
 *
 * Resolved in an EFFECT, never during render, for the same reason the shop language is: eighteen product
 * pages are prerendered, and a region decided while rendering would bake one visitor's answer into the
 * HTML Google indexes. Until the effect runs the answer is 'world', which is the dearer of the two and
 * therefore the safe one to show by mistake.
 */
export const useShippingRegion = () => {
  const [detected, setDetected] = useState('world');
  const { country } = useShippingDestination();
  useEffect(() => { setDetected(detectShippingRegion()); }, []);
  return country ? shippingRegionForCountry(country) : detected;
};

export default useShippingRegion;
