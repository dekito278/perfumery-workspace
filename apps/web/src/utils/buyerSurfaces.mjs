// What a stranger can reach, derived from the route table. Read by the guards, never by the app.
//
// Three selfchecks were asking this same question and each had written its own answer:
// buyerTextComesFromTheMessageFile (does every spoken string come from the message file),
// publicErrorMessage (does any buyer surface print a caught error verbatim) and storefrontTierPrice
// (does every screen that shows a price read the tier-priced catalogue). Three copies meant three
// chances to get it wrong, and all three were wrong in at least one way:
//
//   1. THE IMPORT CONVENTION is lazyRoute(() => import('@/...')), not lazy(...). A pattern written for
//      lazy() resolved 9 of 24 components and said nothing about the other 15.
//   2. A ROUTE BLOCK ENDS AT THE NEXT <Route, not at the first "/>". `element={<ByShop domestic={<X />}
//      international={<Y />} />}` ends at X's slash, which dropped InternationalCartPage out of two
//      sweeps entirely. A count floor cannot see this: twenty-odd pages still resolve.
//   3. THE ROUTED FILE IS NOT THE SCREEN. /mobile/dashboard mounts MobileCommerceTabsPage and the
//      catalog, storefront and articles screens are its children; a sweep that stopped at the routed
//      file never opened any of the three. That is where a live leak was found — the phone journal
//      printing Postgres at shoppers. A one-level walk is not enough either: the search bar and the
//      state panel those screens render are three levels down.
//
// So it is one function, with the traps recorded once. Free of framework imports: the guards run in
// plain node.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

// Wrappers and redirects, which are not screens.
const STRUCTURAL = ['Route', 'ProtectedRoute', 'Navigate', 'ByShop', 'DomesticOnly'];

const walkJsx = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = join(dir, entry.name);
  if (entry.isDirectory()) return walkJsx(full);
  return /\.jsx$/.test(entry.name) ? [full] : [];
});

/**
 * Every component name App.jsx imports, however it imports it, mapped to its path relative to src.
 * Both forms: a plain import, and the lazyRoute(() => import(...)) the routes use.
 */
export const appImports = (appSource) => {
  const imports = new Map();
  for (const match of appSource.matchAll(/import\s+(\w+)\s+from\s+'@\/([^']+)'/g)) {
    imports.set(match[1], match[2]);
  }
  for (const match of appSource.matchAll(/const\s+(\w+)\s*=\s*\w*[Ll]azy\w*\(\s*\(\)\s*=>\s*import\('@\/([^']+)'\)/g)) {
    imports.set(match[1], match[2]);
  }
  return imports;
};

/** One <Route> and its own element, cut at the next <Route so nothing nested is lost. */
export const routeBlocks = (appSource) => appSource.split(/(?=<Route\b)/).slice(1).map((part) => {
  const next = part.slice(1).search(/<Route\b/);
  return next === -1 ? part : part.slice(0, next + 1);
});

/**
 * The component names a stranger can reach, and the ones behind the gate.
 *
 * A name that appears in both is gated: being mounted publicly somewhere does not make a protected
 * mount public. Paths under /studio count as gated whether or not they carry <ProtectedRoute>.
 */
export const routedComponentNames = (appSource) => {
  const publicNames = new Set();
  const gatedNames = new Set();
  for (const block of routeBlocks(appSource)) {
    const path = (block.match(/path="([^"]+)"/) || [])[1] || '';
    const gated = /<ProtectedRoute/.test(block) || /^\/(?:studio|mobile\/studio)/.test(path);
    for (const match of block.matchAll(/<([A-Z]\w+)/g)) {
      if (!STRUCTURAL.includes(match[1])) (gated ? gatedNames : publicNames).add(match[1]);
    }
  }
  return { publicNames: new Set([...publicNames].filter((name) => !gatedNames.has(name))), gatedNames };
};

/**
 * Every file a stranger can reach: the public routes, everything they import, and components/storefront
 * — which is buyer-facing by construction and holds the files App.jsx renders as Suspense fallbacks, so
 * the closure alone never reaches them.
 *
 * @param src      absolute path to apps/web/src
 * @param exclude  component/file basenames to leave out, each with a reason at the call site
 */
export const buyerSurfaces = ({ src, exclude = new Set() } = {}) => {
  const appSource = readFileSync(join(src, 'App.jsx'), 'utf8');
  const imports = appImports(appSource);
  const { publicNames } = routedComponentNames(appSource);

  const resolve = (rel) => {
    if (!rel) return null;
    for (const candidate of [rel, `${rel}.jsx`]) {
      if (existsSync(join(src, candidate))) return join(src, candidate);
    }
    return null;
  };

  const routed = [...publicNames]
    .filter((name) => !exclude.has(name))
    .map((name) => resolve(imports.get(name)))
    .filter(Boolean);

  const reachable = new Set([...routed, ...walkJsx(join(src, 'components', 'storefront'))]);
  const queue = [...reachable];
  const depth = new Map([...reachable].map((file) => [file, 1]));
  while (queue.length) {
    const file = queue.shift();
    for (const match of readFileSync(file, 'utf8').matchAll(/from\s+'@\/((?:pages|components|layouts)\/[^']+)'/g)) {
      const next = resolve(match[1]);
      if (!next || reachable.has(next) || exclude.has(basename(next, '.jsx'))) continue;
      reachable.add(next);
      depth.set(next, (depth.get(file) || 1) + 1);
      queue.push(next);
    }
  }

  return {
    routed,
    files: [...reachable].filter((file) => file.endsWith('.jsx')),
    depthOf: (name) => depth.get([...depth.keys()].find((file) => basename(file, '.jsx') === name)) || 0,
    resolve,
    appSource,
  };
};

export default buyerSurfaces;
