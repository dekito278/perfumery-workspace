// What may reach the browser out of the build environment.
//
// Vite inlines every `VITE_`-prefixed variable into the client bundle. Vercel, for a project it detects as
// Vite, copies its OWN system variables into `VITE_`-prefixed twins — so sixteen of them were being served
// to every visitor of solivagantscent.com, and this app reads none of them. One is
// VITE_VERCEL_GIT_COMMIT_MESSAGE: the whole commit BODY, which in this repo is a page of prose about
// pricing decisions, margins and defects found. The bundle was publishing it.
//
// Called from vite.config.js at module scope, before Vite reads the environment. It lives here rather than
// inline in the config so that `envReachingTheBrowserIsRead.selfcheck.mjs` can RUN it: the config imports
// plugins through Vite's own resolver and cannot be loaded by node at all.
export const VERCEL_INJECTED_ENV_PREFIX = 'VITE_VERCEL_';

/**
 * Deletes Vercel's injected twins from `env` in place. Returns the names dropped, so a build can say so.
 *
 * Only that prefix: a sweep of everything the app does not obviously read is how a shop loses its Supabase
 * URL to a scan that missed one call site.
 */
export const dropUnreadClientEnv = (env = {}) => {
  const dropped = [];
  for (const key of Object.keys(env)) {
    if (!key.startsWith(VERCEL_INJECTED_ENV_PREFIX)) continue;
    delete env[key];
    dropped.push(key);
  }
  return dropped;
};
