// A chain whose subject is not in the build's checkout.
//
// Vercel checks out `apps/web`, not the repository root, so `docs/` does not exist during the build.
// Two chains read it — launchYearIsStatedNotGuessed (the Fragrantica submission) and staleSqlDrafts
// (every SQL snippet a reader could copy out of docs/) — and on 2026-10-23 they took the production
// build down the first time the chains ran there.
//
// The temptation is to let the runner skip those two by name. That is a hand-typed list, which is the
// defect this whole gate was just rebuilt to remove. So instead a chain DECLARES that its subject is
// missing, and the runner counts and prints the skip. A skip is loud and in the summary; what it must
// never be is silent, because a chain nobody runs looks exactly like a chain that passes.
export const SKIP_MARKER = '[skip]';

/** Say out loud that part of a chain could not run here. The caller carries on with the rest. */
export const noteSkip = (reason) => {
  console.log(`${SKIP_MARKER} ${reason}`);
};

/** Say it and stop, for a chain whose whole subject is missing. Exit 0: absent is not failed. */
export const skipChain = (reason) => {
  noteSkip(reason);
  process.exit(0);
};

/** The reason these two exist, written once. */
export const DOCS_OUTSIDE_CHECKOUT = 'docs/ is outside the build checkout (Vercel takes apps/web only), '
  + 'so this runs on a developer machine and nowhere else';
