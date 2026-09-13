import { useEffect, useMemo, useState } from 'react';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { getMyPriceTier, getTierPricesFor } from '@/services/tierPricingService.js';
import { applyTierPrices } from '@/utils/tierPricedCatalog.js';
import { formatRupiah } from '@/services/productCatalogService.js';
import supabase from '@/lib/supabaseClient.js';

// The tier the visitor is on and the prices they are entitled to. Both are resolved by the server from
// the session — nothing here asks the browser who it is.
//
// Every failure is silent on purpose. Retail is a real price, so a visitor who sees it has not been told
// anything false; a red banner on a shop front because a lookup timed out would be worse than the
// answer being slightly less generous. Studio is where the same condition has to be loud.
//
// ONE lookup for the whole page, not one per hook call. This hook is reached from the page, from the
// cart, and from the header, and each mount used to run its own pair of RPCs — measured at fourteen
// round trips for a single product page, before counting the extra pair that onAuthStateChange fires
// the moment it subscribes. useCatalogProducts already had a warm cache for exactly this reason; this
// is the same pattern, module-level so no provider has to be mounted.
let tierState = { tier: 'retail', index: {} };
let tierLoaded = false;
let inFlight = null;
const listeners = new Set();

const notify = () => { for (const listener of listeners) listener(tierState); };

const loadTierPrices = () => {
  if (inFlight) return inFlight;
  inFlight = Promise.all([getMyPriceTier(), getTierPricesFor()])
    .then(([{ tier }, { index }]) => {
      tierState = { tier, index };
      tierLoaded = true;
      notify();
    })
    .finally(() => { inFlight = null; });
  return inFlight;
};

// Signing in is what makes someone a member, so the prices on screen have to follow the session. One
// subscription for the app, and INITIAL_SESSION is ignored: it fires on subscribe and would only repeat
// the load this module already does.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'INITIAL_SESSION') return;
  tierLoaded = false;
  loadTierPrices();
});

export const useTierPrices = () => {
  const [state, setState] = useState(tierState);

  useEffect(() => {
    listeners.add(setState);
    if (!tierLoaded) loadTierPrices();
    else setState(tierState);
    return () => { listeners.delete(setState); };
  }, []);

  return state;
};

/** The catalog as this visitor may buy it. Every buyer-facing surface reads this, not the raw catalog. */
export const useStorefrontProducts = (options) => {
  const products = useCatalogProducts(options);
  const { tier, index } = useTierPrices();
  return useMemo(() => applyTierPrices(products, tier, index, formatRupiah), [products, tier, index]);
};

export default useStorefrontProducts;
