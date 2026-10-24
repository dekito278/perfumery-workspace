// Does every chunk actually define the names it exports?
//
// Why this exists, measured rather than imagined: on 2026-10-25 every Vercel PREVIEW deployment of this
// shop was a dead page. The browser stopped at
//
//   Uncaught SyntaxError: Export 'AUDIT_KEYS_THAT_MATTER' is not defined in module
//
// The entry chunk carried `export{…410 names…}` and did not declare or import a single one of them. The
// browser names only the first, so the error reads like one bad symbol; the chunk was wholly hollow. The
// build had exited 0, Vercel reported "Vercel — pass", and the GitHub check went green. Nothing in the
// pipeline looked at whether the thing it had just built could run.
//
// That matters beyond previews: I had been merging on that green check. It only ever proved the build
// command exited 0. Production survived because its own builds happened not to land in the same chunk
// layout — not because anything checked. The trigger is bundler-side (manualChunks together with
// experimentalMinChunkSize, which merges chunks after the export lists are written), so it can reappear
// on any build, including a production one.
//
// The cause, found by bisecting rather than guessing: it happens when the CLIENT SUPABASE ENV IS ABSENT.
// `vercel env ls` says VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY exist for Production only, so every
// preview built without them. Removing the env file locally reproduces the failing deployment's chunk
// byte for byte — the same 147,387 bytes under the same hash, index-ChbJ5m0k.js. Removing
// experimentalMinChunkSize does NOT fix it; that was tested and the hollow chunk stayed (358 names).
// The real repair is to give Preview the same two variables, which also makes previews a verification
// surface for the first time.
//
// Rather than give up the measured chunking win, refuse the BUILD when its output is hollow.
//
// How it decides, with no JS parser: in `export{local as public}` the local name must exist somewhere
// else in the same chunk — as a declaration, or as an import into it. A name that appears exactly once
// in the whole file, inside the export list, is a name the chunk does not have. On the broken chunk this
// fires on all 410; on a healthy build, on none.
//
// Free of framework imports: the build step runs in plain node with no bundler.

/** Every `export{…}` list in a chunk, split into its `local as exported` pairs. */
const exportLists = (source) => [...source.matchAll(/export\s*\{([^}]*)\}/g)].map((match) => match[1]);

const localNames = (list) => list
  .split(',')
  .map((entry) => entry.trim().split(/\s+as\s+/)[0].trim())
  // `export{}` and `export{default as x}` carry nothing to look up.
  .filter((name) => name && name !== 'default' && /^[A-Za-z_$][\w$]*$/.test(name));

const occurrences = (source, name) => {
  const matches = source.match(new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'g'));
  return matches ? matches.length : 0;
};

/**
 * The names a chunk exports without having them. Empty means the chunk is sound.
 *
 * Returns at most `limit` names: a hollow chunk reports hundreds, and the first handful is enough to act
 * on while the count tells the real story.
 */
export const undefinedExportsIn = (source, limit = 5) => {
  const missing = [];
  for (const list of exportLists(source)) {
    for (const name of localNames(list)) {
      if (occurrences(source, name) < 2) missing.push(name);
    }
  }
  return { count: missing.length, names: missing.slice(0, limit) };
};
