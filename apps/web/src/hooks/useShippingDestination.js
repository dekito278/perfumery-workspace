import { useEffect, useState } from 'react';
import {
  readDestinationFromUrl,
  readStoredDestination,
  writeStoredDestination,
} from '@/utils/shippingDestination.js';

/**
 * The destination the buyer picked, and how many bottles — shared by every component on the page.
 *
 * ONE value with listeners, the shape useStorefrontRegion and useTierPrices already use, because the
 * surfaces that read it must never disagree. Three of them render at once on a product page: the quote
 * block, the price headline above it, and the WhatsApp button (plus a sticky bar on two of the three
 * pages). Each resolving its own would let the headline quote the Southeast Asia price while the button
 * sends Dekito the European total for the same bottle — which is the bait-and-switch this whole feature
 * exists to remove, pointing inwards.
 *
 * Resolved in an EFFECT, never during render: the 18 product pages are prerendered, and a destination
 * decided at render time would bake one buyer's country into the HTML Google indexes.
 *
 * THE DEFAULT IS DELIBERATELY EMPTY. Dekito asked for a guessed default that the buyer could correct,
 * and the only country-shaped guess a browser offers is the region subtag of navigator.language — where
 * `en-US` is the commonest value on earth and is wrong for most of the people who report it. Guessing
 * the United States for a buyer in Berlin shows US$115 and then corrects it to US$140 once they pick, so
 * the guess would re-create the upward surprise this screen was built to remove. An empty picker asks one
 * question; a wrong default answers it badly. The clock's existing guess still seeds the BOTTLE price, so
 * nothing about today's behaviour regresses while the picker sits untouched.
 */
let currentCountry = '';
let currentBottles = 1;
let resolved = false;
const listeners = new Set();

const publish = () => {
  for (const listener of listeners) listener({ country: currentCountry, bottles: currentBottles });
};

export const useShippingDestination = () => {
  const [state, setState] = useState({ country: currentCountry, bottles: currentBottles });

  useEffect(() => {
    listeners.add(setState);
    if (!resolved) {
      resolved = true;
      // The address first, then the stored choice. ?dest=DE is how Dekito and anyone checking his work
      // see what a buyer in Berlin is quoted from a desk in Jakarta, so it has to outrank the value this
      // browser happens to have saved.
      const fromUrl = readDestinationFromUrl();
      if (fromUrl) writeStoredDestination(fromUrl);
      currentCountry = fromUrl || readStoredDestination() || '';
      publish();
    } else {
      setState({ country: currentCountry, bottles: currentBottles });
    }
    return () => { listeners.delete(setState); };
  }, []);

  return {
    country: state.country,
    bottles: state.bottles,
    setCountry: (next) => {
      const code = String(next || '').trim().toUpperCase();
      // An empty selection is a real state — "I have not said yet" — and it must be allowed back, so the
      // buyer can undo a mis-click rather than being stuck with a country they did not mean. Written
      // first, then published: writeStoredDestination refuses silently when storage is blocked, which
      // leaves the choice good for this page view.
      if (code) writeStoredDestination(code);
      currentCountry = code;
      publish();
    },
    // Not stored. A country is a fact about the buyer that is worth remembering across a visit; a bottle
    // count is what they are thinking about on this page, and reviving last week's "4 bottles" on a fresh
    // visit quotes a shipping tier nobody asked for.
    setBottles: (next) => {
      const count = Math.round(Number(next) || 0);
      currentBottles = count > 0 ? count : 1;
      publish();
    },
  };
};

export default useShippingDestination;
