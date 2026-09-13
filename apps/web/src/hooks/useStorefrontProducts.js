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
export const useTierPrices = () => {
  const [state, setState] = useState({ tier: 'retail', index: {} });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [{ tier }, { index }] = await Promise.all([getMyPriceTier(), getTierPricesFor()]);
      if (mounted) setState({ tier, index });
    };

    load();
    // Signing in is what makes someone a member, so the prices on screen have to follow the session.
    const { data } = supabase.auth.onAuthStateChange(() => { load(); });

    return () => {
      mounted = false;
      data?.subscription?.unsubscribe?.();
    };
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
