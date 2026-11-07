// How many times one address may ask in a window, for the endpoints that spend a paid quota.
//
// /api/shipping/rates and /destinations call RajaOngkir with the shop's key on every request, and
// neither asks who is calling. Anyone could loop on them until the day's quota ran out — and then
// every buyer's checkout stops at "Ongkir" with nothing to pick.
//
// ponytail: memory of one warm instance, so a flood spread across instances or addresses gets through.
// It stops one script hammering one endpoint, which is the cheap attack. Move the counts to a shared
// store (a Supabase table or KV) if the RajaOngkir dashboard ever shows a quota burned by strangers.
export const createRateLimit = ({ limit, windowMs, maxKeys = 5000 }) => {
  const hits = new Map();
  return (key, now = Date.now()) => {
    const recent = (hits.get(key) || []).filter((at) => now - at < windowMs);
    const allowed = recent.length < limit;
    if (allowed) recent.push(now);
    // Bounded: a flood of distinct addresses must not grow the map until the instance dies.
    if (!hits.has(key) && hits.size >= maxKeys) hits.clear();
    hits.set(key, recent);
    return allowed;
  };
};

// Vercel writes the caller's address into x-real-ip and x-forwarded-for itself; a client cannot set them.
export const clientAddress = (request) => String(
  request.headers?.['x-real-ip'] || String(request.headers?.['x-forwarded-for'] || '').split(',')[0] || 'unknown',
).trim();
