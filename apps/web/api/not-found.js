// Terminal destination for /api/* paths that match no function.
//
// Vercel resolves the filesystem (static files and functions) BEFORE applying
// rewrites — that is why the SPA catch-all does not swallow /assets/* — so a real
// endpoint is served long before this one is considered. Only genuinely unmatched
// /api paths land here, and they get JSON 404 instead of falling through to the SPA
// catch-all and answering 200 text/html.
export default function handler(request, response) {
  response.statusCode = 404;
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify({ message: `No API route for ${request.url || 'this path'}` }));
}
