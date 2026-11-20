// Vercel Routing Middleware: sends each visitor to the shop of the country they are in, before any page is
// served (Dekito, 18 Nov 2026). The rules, and what they leave alone, are in src/utils/shopByCountry.js.
import { shopRedirect } from './src/utils/shopByCountry.js';

export const config = {
  // Shop pages only — never files, the API, or the Studio. The function checks the page list again.
  matcher: [
    '/',
    '/en',
    '/:first(home|catalog|products|articles|about|bespoke|journal|help|reviews|cart|checkout|welcome|hug|chant-nocturne|jaipong|porte-vers-le-paradis|trace-daventure|customer)/:rest*',
    '/en/:first(home|catalog|products|articles|about|bespoke|journal|help|reviews|cart|checkout|welcome|hug|chant-nocturne|jaipong|porte-vers-le-paradis|trace-daventure|customer)/:rest*',
  ],
};

export default function middleware(request) {
  const decision = shopRedirect({
    url: request.url,
    country: request.headers.get('x-vercel-ip-country') || '',
    userAgent: request.headers.get('user-agent') || '',
    cookie: request.headers.get('cookie') || '',
  });
  // No decision: carry on to the page as asked (what @vercel/functions' next() sends).
  if (!decision) return new Response(null, { headers: { 'x-middleware-next': '1' } });
  const headers = new Headers({ Location: decision.location, 'Cache-Control': 'private, no-store' });
  if (decision.setCookie) headers.append('Set-Cookie', decision.setCookie);
  return new Response(null, { status: 307, headers });
}
