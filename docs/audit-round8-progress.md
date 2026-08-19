# Audit round 8 — the four never-audited modules

Formula workbench, brief AI, material reference, journal editor. Same method as round 7: parallel
finders per dimension, then a skeptic per dimension whose job is to refute, default-refute when the
reasoning cannot be reproduced from the code.

| Module | Findings | Status |
|---|---|---|
| Formula workbench | 37 confirmed / 7 refuted | done (2 withdrawn by the owner's answer) |
| Brief AI | 35 confirmed / 3 refuted | audited; owner chose deletion — deletion NOT done, see below |
| Material reference | 33 live / 8 unreachable / 3 refuted | CRITICAL + all HIGH + the consequential MEDIUM done |
| Journal editor | — | todo |

## Formula workbench — HIGH batch (done)

- **Batch weighing sheet was 1/ratio too large on every line.** `concentrateRows` scaled each material to
  `targetValue` (the finished batch volume) while the batch only consumes `targetValue × formulaRatio` of
  concentrate — 5× at the default 20%. The printed sheet therefore disagreed with the usage ledger
  rendered directly below it, and with what `deduct_batch_material_stock` actually removes. Both twins now
  scale to `concentrateBaseGrams`, the section header states the concentrate and diluent volumes
  explicitly, and the exported bench PDF is titled and totalled by the concentrate. Batch COGS is
  unchanged — the cost-per-unit divisor moved by the same factor. Covered by `batchScaling.selfcheck.mjs`,
  which asserts the sheet equals the RPC's own formula line by line.
- **`saveBatch` reported success for a write that never reached the database.** It swallowed every error
  into localStorage while the UI toasted "Batch saved" — so the batch, and the stock deduction keyed to its
  id, existed only in that browser. It now keeps the local draft but throws.
- **Mobile edit deleted legacy accord rows.** `updateFormula` replaces the whole item set, and the mobile
  editor filtered accord rows out before submitting. Desktop keeps them aside and blocks the update until
  they are cleaned up; mobile now carries them through the save untouched.
- **One wizard candidate click overwrote the entire saved composition.** `persistSeededFormulaItems`
  replaced every item with wizard-derived rows. It now seeds only into an empty composer; with real work
  present it adds the new materials and leaves existing rows alone.
- **Opening a formula armed an overwrite of its last batch.** The page loaded the latest batch into
  `savedBatch` (so saving updates it by id) but left volume, ratio, bottle size and loss at the page
  defaults. Those fields are now hydrated from the batch being edited.
- **The material typeahead returned exactly one suggestion past three characters** — the point where the
  perfumer is most specific. Now 4.
- **Per-row validation errors were keyed by array index**, so inserting or removing a row pinned an error
  to a position that then held a different material. Keyed by `row_key` now, in the hook and the table.

## Formula workbench — the dilution question, answered

Two HIGH findings claimed that stock deduction and cost were wrong for diluted rows. Both rested on an
assumption about how the bench actually works, so it was put to the owner rather than guessed at:

> When a formula row carries a dilution (`dilution_percent` + `dilution_solvent_id`), is the material
> diluted at the bench from neat stock, or is it a material that is already stocked pre-diluted?

**Answer: the row points at a material that is already stocked pre-diluted** — the raw-material list holds
a separate item (e.g. "Iso E Super 10%") with its own `stock_quantity` and `cost_per_unit`, and that is
what gets selected. `raw_materials` supports exactly this: it carries its own `dilution_percentage` and
`dilution_solvent_id`.

So **both findings are withdrawn, and nothing changes**:

- `deduct_batch_material_stock` removing the full row weight from the selected material is CORRECT — that
  weight *is* the stock being consumed. Deducting only `concentrate_amount` would under-deduct, and
  deducting a separate dilution solvent would remove stock that was never touched.
- `formulaDetailData.enrichFormulaItem` pricing the full gram weight at that material's `cost_per_unit` is
  CORRECT for the same reason, and there is no separate solvent cost to add.

The per-row `dilution_percent` / `dilution_solvent_id` / `concentrate_amount` fields are therefore
**descriptive** — they record what the chosen material's dilution is, so the workbench can show active
versus carrier contribution. They are not an instruction to dilute anything.

Worth keeping in mind for future audits of this module: an auditor reading only the code will keep
re-deriving the bench-dilution reading, because `formulaPipeline` seeds a neat material plus a recommended
dilution and auto-picks a solvent, and the PDF import resolves a row to the pure material while creating
the solvent separately. Those paths *look* like bench dilution. They are not.

Note that the batch weighing-sheet fix above is on a different axis and stands: that one is about the
**batch** being diluted (`formulaPercentage`, the batch-level solvent), not about per-row dilution.

## Formula workbench — medium and low batch (done)

- **A rejected dilution left the row half-written.** The solvent guard added in round 7 sat *after* the
  first four `onUpdateItem` calls, so cancelling still marked the row diluted with no solvent — the exact
  state the guard exists to prevent. My own regression; the guard now runs first.
- **`author_name` was erased on every edit.** `normalizeFormulaPayload` forced `null` when the caller
  omitted it, and every edit page omits it. It is now only written when supplied.
- **A material's own dilution could land on a row with a null solvent**, which then failed
  `validateFormulaItems` and blocked the save with an error the perfumer could not act on. Percent and
  solvent now travel together or not at all.
- **Desktop could publish a batch as a product at Rp 0** — the price guard existed only on mobile.
- **Switching formulas quickly could leave `savedBatch` pointing at another formula's batch**, which the
  save path then updates by id. The history load is now cancellable.
- **One failed items query hid the entire formula list.** Per-formula metrics are decoration; they now
  degrade to null instead of rejecting the whole load.
- **Leaving the composer discarded an unsaved composition silently.** Back now confirms.
- **A failed create left a headless formula row behind**, and the retry created a second one. `createFormula`
  now rolls the row back, matching what `updateFormula` already did for items.
- **Removed the mobile "Normalize" button**, which only ever showed a success toast and changed nothing.

### Accepted, not fixed

- Clearing a dilution percentage also clears the solvent, so retyping the number loses the solvent choice.
  The wipe is deliberate (`validateFormulaItems` treats a lone solvent as an incomplete dilution and blocks
  the save), so removing it would need the validator's semantics changed — churn on a real money path for a
  small typing annoyance. Left alone.
- `IngredientSelect` re-scores the whole material library per keystroke per row. Real, but the library is
  small enough that it is not observable today; revisit if the library grows or the composer gets slow.
- Five composer components appear unused. Dead-code removal is safer as its own pass than mixed into a
  behaviour batch.

## Brief AI — audited, then stopped on purpose

35 findings survived verification (7 HIGH). I fixed one and stopped, because checking production first
changed what the right answer is:

**The module is not reachable, and it has never run.**

- Nothing in the app ever creates a `briefs` row. `createBrief` exists in `useBriefs`/`briefsSupabaseService`
  but has no caller, and there is no `/briefs` route. The wizard only appears when
  `briefs.find((b) => b.formula_id === id)` matches (EditFormulaPage.jsx:338), so with no way to create one
  it never appears.
- Production confirms it: `briefs`, `brief_projects` and `brief_material_shortlists` all return **0 rows**.
- `brief_ai_interpretations` returns **404 — the table does not exist in production**. Migration
  `20260502120000_brief_ai_interpretations.sql` was never applied, so every
  `createBriefAiInterpretation` call would fail at runtime anyway.
- Anon **cannot** write to these tables (verified: `42501 row-level security`), so there is no urgent
  security exposure while they sit empty.

So the 7 HIGH findings — the learning accumulator that concatenates strings instead of adding
(`materialCompositionProfile.js:414`), AI wizard options whose tags never reach the ranker, effect tags
inferred from the profile's own keywords, `preferred_letters` matched as single characters, `avoid_tags`
validated and persisted but never read — are all real as code defects, and all of them are in code that
cannot currently execute. Fixing them now would be 35 changes to a feature nobody can open, on a path with
no test coverage and no way to verify the result.

### The one thing fixed

`refreshLinkedProjectStageItems` still replaced the entire composition — the round-8 guard was added to
`persistSeededFormulaItems` only, so the other path kept the wipe. Small, and it completes work I had
already started, so it is done rather than left half-finished.

### Needs an owner decision before anything else here

Is the brief wizard a feature you still want?

- **Revive it** — then the entry point has to be built (something must create a `briefs` row), migration
  `20260502120000` has to be applied, and the 34 remaining findings are worth working through, because the
  ranking defects in particular mean the recommendations it produces would be close to arbitrary.
- **Remove it** — then the honest move is deleting the five services, six utils, two hooks, the wizard UI
  inside EditFormulaPage, `/api/brief-intent` (an unauthenticated LLM endpoint billed to the owner, kept
  alive for a feature nobody can reach), and the five tables. That is a large deletion, so it should be its
  own pass with its own review.

Full finding list: `/private/tmp/.../scratchpad/m2.json` in this session; the important ones are summarised
above.

## Brief AI — the owner chose deletion, and my first attempt at it failed

Decision recorded: remove the module. I attempted it in this session and **backed out**. The tree is
unchanged. What happened is worth writing down, because the next attempt should not repeat it.

### What is genuinely safe to delete

Nothing outside `EditFormulaPage.jsx` has a live consumer:

- services: `briefAiIntentService`, `briefAiInterpretationsService`, `briefsSupabaseService`,
  `briefProjectsSupabaseService`, `briefMaterialShortlistsSupabaseService`
- utils: `briefAiIntent`, `briefProjectWizard`, `briefRecommendationEngine` (already dead), `briefProjectBoard`
  (already dead), `briefFormulaHistory`, `recommendationLearningStorage`
- hooks: `useBriefs`, `useBriefProjects`
- endpoint: `apps/web/api/brief-intent.js`

**`materialCompositionProfile.js` must NOT be deleted** — `formulaPipeline.js` and
`FormulaWorkbookSimulationPanel.jsx` use `resolveMaterialCompositionProfile` /
`resolveRecommendedUsagePlan` on the live formula path. The string-concatenating `bumpMapCount` bug lives
in that file but is only reachable from the wizard, so it becomes truly dead once the wizard goes.

### Why the attempt failed, twice

`EditFormulaPage.jsx` is the live desktop formula editor: 1994 lines, of which ~365 touch brief/wizard.
Removing them mechanically (delete each declaration ESLint reports as unused, repeat) breaks the file,
because:

1. **The build is not a safety net here.** Vite does not run ESLint, so `npm run build` stayed green while
   the page had `setBriefAiIntentLoading is not defined` — a runtime crash waiting for the first user.
   Only `npx eslint` on the file caught it. Any future attempt must gate on ESLint, not the build.
2. **Removing a `useState` because its getter is unused orphans the setter**, which is still called from
   code the strip has not reached yet.
3. **Brief state is referenced by JSX outside the wizard `<Dialog>`.** Removing the dialog (lines
   1014-1437, cleanly contiguous) and the handler cluster (568-841, also contiguous) both work and keep the
   build green — but `linkedProjectStageItems` and friends are still read by other parts of the page, so
   the module's UI is woven into the editor, not isolated in the dialog.

### How to do it next time

In this order, running `npx eslint src/pages/EditFormulaPage.jsx` (not just the build) after every step:

1. Delete the wizard `<Dialog>` block.
2. Delete the handler cluster.
3. Find and delete the *remaining* brief JSX in the page body — this is the part that needs eyes, and it is
   what both automated attempts got wrong.
4. Only then remove effects, state and imports, one at a time.
5. Then delete the standalone modules listed above.
6. Optionally drop the five tables. They are empty, but a drop is irreversible, so it should be its own
   decision and its own manual-apply migration.

## Material reference — critical and first high findings (done)

This audit asked every finding to name the route and action that reaches it, and had the skeptic verify
reachability independently. That split 44 findings into 33 live, 8 unreachable and 3 refuted — worth
keeping for future rounds, because the previous module burned effort on defects nobody could trigger.

- **CRITICAL — the second material in any category was never saved.** Picking a category auto-filled
  `workbook_code` with the bare category letter (`A`..`Z`) whenever the field was blank, and the field sits
  *above* the category select so it usually is. `createRawMaterial` matches on workbook code first, so
  material #2 in category J matched material #1, no INSERT happened, and the modal closed on a
  `toast.info` that read like success — name, cost, stock and CAS all discarded, and any imported guidance
  written onto the unrelated material. The auto-fill is removed: the workbook code is a per-material
  identifier under a unique index, not a category tag. The matched case now warns explicitly that nothing
  was created and keeps the dialog open.
- **`%` in a material name matched the wrong row.** `findExistingRawMaterialByName` / `...ByWorkbookCode`
  passed the name straight into `ilike` as a LIKE pattern. Every stocked dilution is named like
  "Iso E Super 10%", so `%` acted as a wildcard — silently merging a new material into an unrelated one on
  create, and permanently blocking the save on edit. One `escapeLikePattern` helper now feeds both, matching
  what the search paths already did. Covered by `likePattern.selfcheck.mjs`.
- **Merging duplicates destroyed the duplicate's stock.** `buildMergedRawMaterialData` spread the master row
  and never summed `stock_quantity`, and the duplicate is deleted immediately after. Quantities are now
  added and the stricter `minimum_stock` kept. Covered by `mergeStock.selfcheck.mjs`.
- **Opening the guidance quick-edit erased imported reference snapshots.** A page that does not load
  `guidance_reference_profile` produced `{}`, and `createReferenceMetadataPatch` treated that as "replace
  with nothing". An empty object now means "no change", fixing every caller at once.
- **`MAN-<uuid>` was stamped into `workbook_code`.** The synthetic-code guard only knew the `RAW-` family,
  so a manual profile's generated id landed in the unique-indexed column the create path matches on first.
  The guard now covers `RAW-`, `MAN-` and `EXT-`.

Checks: `npm run lint`, ten `*.selfcheck.mjs`, `npm run build`.

### Remaining HIGH findings (also done)

- **Mobile list copied guidance between rows sharing a CAS.** A stocked dilution shares its CAS with the
  neat material, so "Iso E Super 10%" inherited the neat row's use levels — wrong by the dilution factor on
  the exact number a perfumer doses by, and it reached `guidance_reference_profile`, the filters and the
  scoring. Desktop never had this. `hydrateGuidanceFromPeerMaterials` and its three now-orphaned helpers
  are removed.
- **Mobile "new material" reported success when the service merged instead of inserting** — same root as
  the CRITICAL, different call site. It now warns and says nothing was created. (It still navigates to the
  matched material, which is the honest destination: that row is what exists.)
- **Keyword inference outweighed a stated ABC family.** Inferred shares were weighted 0.35 while a family
  entered through the material form carries `raw_material_form` priority 18 → 0.18, so a description
  mentioning another family's descriptor could flip the family the composer doses by. Inference is now
  0.10, below the lowest explicit priority (`fallback` 12 → 0.12), so any stated family wins.
- **All three URL importers are vite-dev-only.** `scentreeImportDevPlugin` is loaded only when `isDev`, and
  production rewrites `/api/(.*)` to not-found — so Scentree, PerfumersWorld and TGSC imports have always
  404'd in the deployed app. Porting three scrapers to serverless is a feature, not a patch, so instead the
  service now exports `URL_IMPORT_AVAILABLE` and throws a truthful error, and the quick-edit dialog shows a
  warning band above the buttons in production. **If you want these working in production, that is a
  separate piece of work** — three handlers under `apps/web/api/imports/` with a host allowlist and an
  admin check, modelled on `api/formula/import-pdf.js`.

### Medium batch (done)

- **An IFRA limit of 0 was read as "no limit".** `toPositiveGuidanceLimit` collapsed 0 into null, so the
  one material that must never appear in a formula was the one material that never raised an advisory. 0
  is now a real ceiling — and a limit of exactly 0 raises a distinct "Prohibited by IFRA" danger advisory
  at any usage above zero. Covered by `guidanceAdvisories.selfcheck.mjs`.
- **The delete pre-check only looked at `formula_items`.** Six `on delete restrict` foreign keys point at
  raw_materials; the dialog checked two, so it said "ready to delete" for materials still held by accords,
  batches and usage records, and the delete then failed at the database with a raw constraint error. All
  six are checked now, and a table missing from a given deployment degrades instead of breaking the preview.
- **Four of the ten reference filters did nothing.** `materialReferenceService` already resolves ids for the
  review-status filters, but the query never applied them, so picking Approved PW / Approved external /
  Provisional / Conflict left the table unfiltered.
- **The search box mangled ordinary names.** Two search paths hand-build PostgREST `or=(...)` groups and
  each escaped a different character set — the material search replaced only `% _ ,`, so `Ambrox (DL)`
  could break the group. Both now use one `sanitizeOrFilterSearch` helper, covered by
  `likePattern.selfcheck.mjs`.

### Still open in this module

Nine MEDIUM and ten LOW, none of them data-destroying. The notable ones: the same material can get two
different effective concentrations for the same IFRA check (three call sites each compute it their own
way); the PDF importer parses the workbook's own totals but never verifies them; and several mobile
filters are applied client-side to only the first page of rows.
