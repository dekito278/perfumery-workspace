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
