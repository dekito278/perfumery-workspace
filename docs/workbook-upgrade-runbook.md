# Workbook Upgrade Runbook

## Goal

Upgrade the current web app into a workbook-driven perfume creation system without breaking the existing inventory, formula, batch, and production-costing flows.

This runbook follows these product rules:

- do not break the current app
- do not block formula creation when IFRA or workbook limits are exceeded
- treat workbook data as reference and simulation intelligence
- keep price editable by the user
- allow default stock seeding for the imported material library

## Product Direction Confirmed

The target experience is:

1. The database already contains a large raw-material library from the workbook export.
2. Users can still edit operational fields like stock, vendor, and price manually.
3. When creating or editing a formula, the app shows workbook-driven guidance:
   - IFRA limit
   - odour description
   - impact
   - lifetime
   - top / middle / base balance
   - warnings when limits are exceeded
4. Warnings are advisory only.
5. Later, the formula should also show workbook-driven visuals:
   - odour profile chart
   - colour / family composition chart
   - life decay and top-mid-base behaviour

## Current Repo Status

Already in place:

- reference-layer schema and link tables
- workbook reference import and match tooling
- raw material detail page with reference profile display
- formula detail advisory warnings for workbook use-level and IFRA reference limits
- raw material reference search, filters, and manual matching UI

Still missing for the full workbook-style product:

- full material library seeded as operational inventory records
- formula simulation engine wired into the live formula editor flow
- formula-level impact and lifetime summary panel
- odour profile aggregation view
- colour / facet chart based on workbook classes
- controlled default stock seeding rules

## Safe Implementation Order

### Phase 1. Freeze Current Working Flows

Objective:

- protect the current app before deeper workbook integration

Must remain stable:

- login
- dashboard
- raw materials CRUD
- formulas CRUD
- batches
- production costing

Definition of done:

- lint passes
- build passes
- browser QA passes for the main routes

### Phase 2. Seed the Workbook Material Library Into Operational Inventory

Objective:

- make the imported workbook materials usable immediately in formula creation

Rules:

- use workbook records as the source for material identity and reference metadata
- create operational `raw_materials` records so they can be selected in formulas
- do not overwrite user-entered prices later

Default operational seeding policy:

- stock quantity: default `1000`
- unit: default `ml` unless there is a strong reason to infer something else later
- cost per unit: default `0`
- minimum stock: default safe baseline such as `1`
- vendor: empty or workbook supplier only if we explicitly choose it
- workbook code: populated from workbook reference code
- IFRA limit: populated from workbook if present
- scent family / category: derived from workbook ABC mapping

Important:

- this phase creates usable inventory records
- this is different from the reference layer that already exists

Definition of done:

- workbook material records are in `raw_materials`
- formulas can select them directly
- current stock and cost logic still works

### Phase 3. Make Formula Creation Workbook-Aware

Objective:

- formula creation and editing should consume workbook intelligence in real time

Required behaviours:

- when a material is added, show workbook summary fields if available
- during editing, calculate:
  - formula percentage per line
  - line impact contribution
  - formula impact estimate
  - simple lifetime estimate
  - odour-weighted lifetime estimate
  - top / middle / base balance
- show line-level advisories:
  - above typical use level
  - above max use level
  - above IFRA reference limit

Important:

- never block save
- never block batch creation
- show warning language only

Definition of done:

- formula edit/create flows show workbook guidance live
- warnings are visible but non-blocking

### Phase 4. Add Formula Simulation Summary

Objective:

- expose the workbook logic as a proper formula intelligence panel

Panel contents:

- formula impact estimate
- lifetime estimate
  - simple weighted life
  - odour-weighted life
- note balance
  - top
  - middle
  - base
- major warnings summary

Inputs:

- workbook `Impact`
- workbook `ClassHr`
- workbook use-level and IFRA fields
- formula composition percentages

Formula set to use first:

```text
pct_i = qty_i / sum(qty_all) * 100
impact_contribution_i = (pct_i / 100) * impact_i
formula_impact = sum(impact_contribution_i)
simple_life_hours = sum((pct_i / 100) * life_i)
odour_weighted_life_hours = sum(impact_contribution_i * life_i) / sum(impact_contribution_i)
```

Definition of done:

- one formula page shows a stable workbook simulation summary

### Phase 5. Add Odour Profile and Colour Charts

Objective:

- make workbook composition visible and intuitive

Data source:

- workbook class distribution fields
- ABC family mapping
- workbook image/category colour mapping where available

Charts to build:

- circular odour profile chart
- grouped family distribution chart
- top/middle/base balance chart
- optional time-decay or life-distribution chart

Important:

- first release can use clean class/family colours
- image-perfect parity with the legacy app is not required in the first pass

Definition of done:

- formula detail shows odour and family composition visually

### Phase 6. Refine Batch / Costing Integration

Objective:

- make workbook intelligence useful after formula creation too

Use workbook data for:

- informational costing context
- batch warnings
- reporting

Do not use workbook data to:

- replace operational costs
- replace user vendor info
- replace stock source-of-truth

Definition of done:

- workbook metrics appear in downstream screens without changing stock math

## Concrete Work Queue For This Repo

### Immediate next implementation step

Build the material-library seeding workflow.

This should include:

1. inspect the existing import output and matching output
2. define the exact mapping from `material-reference-clean.json` into `raw_materials`
3. create a seeding script that:
   - creates missing operational records
   - links them to reference profiles
   - applies default stock and zero pricing
4. dry-run the seed
5. apply the seed safely
6. browser-test formula creation using the seeded library

### After that

Build the formula simulation engine service for the live formula flow.

This should include:

1. reusable workbook simulation utility
2. line contribution calculation
3. formula impact and lifetime summary
4. note balance calculation
5. UI panel in formula create/edit/detail

## Explicit Guardrails

Never do these during the first rollout:

- block formula saving because of IFRA or workbook use-level warnings
- overwrite user-entered price with workbook catalog price
- overwrite user stock with workbook data after seeding
- replace production-costing operational math with workbook estimates
- mix reference-only records into core batch logic without compatibility checks

## Acceptance Criteria

The workbook upgrade is considered safely on-track when:

- the app still behaves correctly for the current routes
- users can build formulas from a seeded material library
- workbook guidance appears in formula flows
- warnings are non-blocking
- formula impact and lifetime become visible and credible
- charts are introduced only after the simulation numbers are stable
