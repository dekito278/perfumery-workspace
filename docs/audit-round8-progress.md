# Audit round 8 — the four never-audited modules

Formula workbench, brief AI, material reference, journal editor. Same method as round 7: parallel
finders per dimension, then a skeptic per dimension whose job is to refute, default-refute when the
reasoning cannot be reproduced from the code.

| Module | Findings | Status |
|---|---|---|
| Formula workbench | 37 confirmed / 7 refuted | HIGH batch done; MEDIUM+LOW pending |
| Brief AI | — | todo |
| Material reference | — | todo |
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

## Formula workbench — needs an owner decision, NOT fixed

Two HIGH findings turn on one domain question I will not guess at, because both readings are defensible
and the wrong one corrupts inventory or cost:

> When a formula row carries a dilution (`dilution_percent` + `dilution_solvent_id`), does the perfumer
> dilute at the bench from **neat** stock — or pick a material that is **already stocked pre-diluted**?

`raw_materials` supports both: it has its own `dilution_percentage` / `dilution_solvent_id`, so a stocked
item can itself be "Iso E Super 10% in DPG".

- If dilution is done **at the bench**, then `deduct_batch_material_stock` is wrong: it removes the full
  diluted weight from the neat material (10× too much at 10%) and never deducts the dilution solvent at
  all, and `formulaDetailData.enrichFormulaItem` prices the diluted weight at the neat material's rate
  while ignoring the solvent — so both stock and COGS are overstated.
- If the row points at a **pre-diluted stocked material**, today's behaviour is correct and "fixing" it
  would under-deduct stock and understate cost.

The code leans toward bench dilution (`formulaPipeline` seeds neat material + a recommended dilution + an
auto-picked solvent; the PDF import resolves the row to the pure material and creates the solvent as a
separate material). But leaning is not enough to rewrite stock and cost maths in production.
