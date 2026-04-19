# Material Reference Import Guide

## Purpose

These commands import workbook reference data into the new reference layer without changing operational inventory logic.

Operational inventory remains in:

- `raw_materials`

Reference workbook data goes into:

- `material_reference_abc_families`
- `material_reference_profiles`
- `material_reference_odour_facets`
- `raw_material_reference_links`

## Source files

Default source directory:

- `C:\webapp\perfumers-workbook\exports`

Expected files:

- `material-reference-clean.json`
- `abc-classification-reference.csv`

## Step 1: Apply database migration

Run your normal Supabase migration flow first so the new tables exist.

Required migration:

- [20260419183000_material_reference_profiles.sql](C:/webapp/dekito-workspace-perfumery/supabase/migrations/20260419183000_material_reference_profiles.sql:1)

## Step 2: Dry-run export from workbook resources

From repo root:

```powershell
$env:Path += ';C:\Program Files\nodejs'
npm.cmd run reference:export --prefix apps/web
```

This creates local JSON snapshots in:

- `docs/material-reference-export`

Use this step to verify normalization before touching the database.

## Step 3: Apply reference dataset to database

Required environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Then run:

```powershell
$env:SUPABASE_URL='https://<project>.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'
$env:Path += ';C:\Program Files\nodejs'
npm.cmd run reference:apply --prefix apps/web
```

What it does:

- upserts ABC family reference rows
- upserts material reference profiles by `reference_code`
- replaces odour facets for imported profiles

## Step 4: Dry-run match inventory materials to reference profiles

```powershell
$env:SUPABASE_URL='https://<project>.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'
$env:Path += ';C:\Program Files\nodejs'
npm.cmd run reference:match --prefix apps/web
```

This writes reports into:

- `docs/material-reference-match-report`

Generated files:

- `material-reference-match-summary.json`
- `material-reference-matches.json`
- `material-reference-unmatched.json`

## Step 5: Apply high-confidence matches

Default threshold is `0.95`.

That means these match types apply automatically:

- exact workbook code
- exact CAS
- exact normalized name

Run:

```powershell
$env:SUPABASE_URL='https://<project>.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'
$env:Path += ';C:\Program Files\nodejs'
npm.cmd run reference:match:apply --prefix apps/web
```

## Step 6: Plan operational inventory seeding

This step turns workbook reference records into usable `raw_materials` inventory rows with safe defaults.

Default seeded values:

- `stock_quantity = 1000`
- `unit = ml`
- `cost_per_unit = 0`
- `minimum_stock = 1`
- `low_stock_threshold = 1`

Workbook data still stays in the reference layer. This step only creates operational inventory rows so the materials can be used directly in formulas.

With Supabase credentials, this will also compare against existing users, inventory rows, and primary links.

Without Supabase credentials, the command now falls back to an offline workbook-catalog plan so you can still review the candidate operational rows safely.

```powershell
$env:Path += ';C:\Program Files\nodejs'
npm.cmd run reference:inventory:plan --prefix apps/web
```

Optional Supabase-backed planning:

```powershell
$env:SUPABASE_URL='https://<project>.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'
$env:Path += ';C:\Program Files\nodejs'
npm.cmd run reference:inventory:plan --prefix apps/web
```

Generated files:

- `docs/material-library-seed/material-library-seed-summary.json`
- `docs/material-library-seed/material-library-seed-create-plan.json`
- `docs/material-library-seed/material-library-seed-existing.json`
- `docs/material-library-seed/material-library-seed-link-backfill.json`
- `docs/material-library-seed/material-library-seed-missing-reference-profiles.json`

Planning modes:

- `offline_workbook_catalog`: workbook-only candidate seed list, no DB reads
- `supabase`: full plan with duplicate detection, user expansion, and missing-link backfill

## Step 7: Apply operational inventory seeding

Only run this after reviewing the plan output.

```powershell
$env:SUPABASE_URL='https://<project>.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'
$env:Path += ';C:\Program Files\nodejs'
npm.cmd run reference:inventory:apply --prefix apps/web
```

What it does:

- creates missing `raw_materials` rows for each auth user
- maps workbook ABC code into the app A-Z category labels
- defaults stock and pricing safely
- links the seeded inventory rows back to `material_reference_profiles`

Important:

- it does not overwrite existing workbook-coded inventory rows
- it does not overwrite manual pricing
- it does not block formula usage

## Matching rules

Current priority:

1. `workbook_code` exact
2. `cas_number` exact
3. normalized material name exact
4. synonym exact

Only high-confidence matches should be applied automatically.

## Recommended rollout

1. Run migration
2. Run `reference:export`
3. Inspect output JSON
4. Run `reference:apply`
5. Run `reference:match`
6. Review unmatched records
7. Run `reference:match:apply`

## Important guardrails

Do not bypass the controlled seeding workflow when importing workbook data into `raw_materials`.

Do not replace:

- stock quantity
- cost per unit
- vendor purchasing context
- dilution setup

Workbook data is a reference layer, not operational inventory.
