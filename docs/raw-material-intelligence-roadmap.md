# Raw Material Intelligence Roadmap

## Goal

Expand the current raw material system so each material can evolve from a simple inventory item into a rich reference profile, while keeping existing workflows for formulas, batches, costing, and stock deduction stable.

This rollout is intentionally incremental:

1. Keep the current `raw_materials` table working as the operational source of truth.
2. Add a new "knowledge layer" beside it instead of replacing it immediately.
3. Delay bulk import until schema, UI, and matching rules are proven stable.

## Current State

The app already supports:

- inventory stock and pricing
- workbook code
- vendor
- CAS number
- IFRA limit
- scent family
- dilution setup
- material detail and usage history

Current `raw_materials` is operational data.

The workbook export introduces reference data such as:

- reference code
- synonym list
- ABC classification and family system
- odour description and odour profile
- perfume/flavour uses
- impact and lifetime
- use-level min/typical/max
- IFRA formula limit
- stability fields
- physical state
- molecular formula and molecular weight
- supplier/catalog metadata
- raw source payload

## Safe Architecture Direction

Do not overload the operational `raw_materials` table with every workbook field at once.

Use two layers:

### 1. Operational Layer

Keep `raw_materials` for:

- user-owned inventory
- stock quantity
- cost
- dilution
- vendor-specific purchasing context
- active material used in formulas and batches

### 2. Reference Layer

Add workbook-style reference entities for:

- canonical raw material profile
- classification and odour metadata
- safe usage guidance
- stability and chemistry details
- source import metadata

This keeps formulas and batches stable because they still point to operational materials.

## Recommended Data Model

### Phase 1 tables

Add a new canonical reference table:

- `material_reference_profiles`

Suggested core columns:

- `id`
- `reference_code`
- `name`
- `synonym`
- `supplier`
- `abc_code`
- `abc_primary_letter`
- `abc_primary_family`
- `abc_secondary_letter`
- `abc_secondary_family`
- `category`
- `classification`
- `brief_description`
- `odour_description`
- `odour_profile`
- `perfume_uses`
- `flavour_uses`
- `function_labels`
- `impact`
- `life_hours`
- `use_level_min_percent`
- `use_level_typical_percent`
- `use_level_max_percent`
- `ifra_limit_percent`
- `stability_heat`
- `stability_discolour`
- `stability_storage`
- `stability_antioxidant`
- `stability_summary`
- `state`
- `mol_formula`
- `molecular_weight`
- `cas_no`
- `safety`
- `ifra`
- `catalog_tag`
- `catalog_unit`
- `catalog_price`
- `catalog_available`
- `raw_payload`
- `created_at`
- `updated_at`

Add one mapping table:

- `raw_material_reference_links`

Suggested columns:

- `id`
- `raw_material_id`
- `reference_profile_id`
- `match_method`
- `match_confidence`
- `is_primary`
- `created_at`

This lets one inventory material be linked to one trusted workbook reference profile without changing formula logic.

### Phase 2 optional tables

Normalize later only if needed:

- `material_reference_odour_facets`
- `material_reference_aliases`
- `material_reference_usage_notes`
- `material_reference_stability_rules`

Do not start with these unless the UI truly needs them.

## Field Mapping Strategy

### Existing app field -> workbook candidate

- `raw_materials.workbook_code` -> `reference_code`
- `raw_materials.name` -> `name`
- `raw_materials.vendor` -> purchasing/vendor context
- `raw_materials.cas_number` -> `cas_no`
- `raw_materials.ifra_limit` -> `ifra_limit_percent`
- `raw_materials.category` -> category
- `raw_materials.scent_family` -> derived display family

### Important rule

Do not replace user-entered inventory values with workbook values automatically.

Examples:

- Keep app `vendor` as user purchasing vendor.
- Keep workbook `supplier` inside reference profile.
- Keep app `cost_per_unit` as operational cost.
- Keep workbook price only as optional reference/catalog price.

## Rollout Plan

## Phase 0: Analysis and freeze points

Objective:

- lock the target architecture before touching import

Deliverables:

- reference field inventory
- mapping rules
- confidence rules for matching inventory materials to reference rows

Success criteria:

- no change to current formula, batch, costing, or stock flows

## Phase 1: Reference schema only

Objective:

- add new reference tables without wiring them into existing workflows

Work:

- create migration for `material_reference_profiles`
- create migration for `raw_material_reference_links`
- add indexes on `reference_code`, `name`, `cas_no`
- add app service layer for reading reference profiles

Success criteria:

- app behaves exactly the same as today when no reference profile exists

## Phase 2: Internal matching layer

Objective:

- let an inventory material optionally connect to a workbook profile

Work:

- create matching utility by workbook code, CAS, and normalized name
- expose reference match status in admin/developer tooling first
- add confidence scoring:
  - exact workbook code match
  - exact CAS match
  - normalized name match
  - alias match

Success criteria:

- materials can be linked safely without changing user-facing formula behavior

## Phase 3: Detail page expansion

Objective:

- enrich raw material detail page without disturbing list and stock workflows

Work:

- add a collapsible "Reference profile" section on raw material detail
- show:
  - synonyms
  - ABC classification
  - odour profile
  - impact and life
  - use levels
  - IFRA reference limit
  - stability
  - molecular data
  - workbook/source reference code

Success criteria:

- the detail page becomes richer
- raw materials list stays simple and operational

## Phase 4: Formula assistance

Objective:

- use reference data as guidance, not as hard blockers

Work:

- show warnings in formula detail and preview:
  - above recommended max use level
  - above IFRA reference limit
  - unusual concentration ranges
- optionally compute formula impact estimate and lifetime estimate

Important:

- these are advisory checks only
- do not block save or batch creation in early rollout

Success criteria:

- users gain insight without breaking current composing workflow

## Phase 5: Search and discovery

Objective:

- make workbook knowledge searchable

Work:

- add search by:
  - reference code
  - synonym
  - CAS
  - ABC family
  - odour terms
  - perfume use keywords
- add filters for:
  - family
  - impact range
  - life range
  - stability
  - IFRA-limited materials

Success criteria:

- raw material browsing feels like a material library, not only inventory

## Phase 6: Controlled import

Objective:

- import workbook reference data first, inventory data later

Work order:

1. import `abc-classification-reference.csv`
2. import `material-reference-clean.json`
3. validate duplicate reference codes
4. validate duplicate CAS and name collisions
5. populate reference links only for high-confidence matches
6. review unresolved matches manually

Important:

- do not import directly into `raw_materials` first
- import into `material_reference_profiles`

Success criteria:

- workbook dataset is present in app without polluting user inventory

## Phase 7: Optional inventory seeding

Objective:

- if desired later, create actual inventory materials from selected references

Work:

- build "Create inventory item from reference profile"
- let user set:
  - stock
  - purchase price
  - vendor
  - unit
  - low stock threshold

Success criteria:

- reference library and owned inventory remain separate concepts

## UI Guidance

### Keep simple pages simple

Do not overload:

- dashboard
- raw material list
- formula table rows

### Put rich data in detail surfaces

Best locations:

- `RawMaterialDetailPage`
- formula detail side panels
- optional inspector drawer

### Suggested UX pattern

- Summary first
- Reference tabs or accordions next
- Raw source payload never shown by default

Suggested sections for detail page:

- Overview
- Classification
- Odour profile
- Usage guidance
- Safety and stability
- Chemistry
- Source and aliases

## Matching Rules

Recommended priority:

1. workbook code exact match
2. CAS exact match
3. normalized name exact match
4. synonym match
5. manual review

Never auto-link low-confidence records silently.

## Data Quality Risks

Known risks from workbook-style data:

- HTML fragments embedded in text fields
- inconsistent supplier vs vendor meaning
- duplicate names with different references
- multiple synonyms in one string
- missing IFRA data
- raw profile fields containing mixed prose and markup

Mitigation:

- clean and normalize in import pipeline
- preserve original raw payload
- store cleaned display fields separately

## What We Should Build First In This Repo

Recommended implementation order for this app:

1. Create reference schema migrations
2. Add service layer for reference profiles and links
3. Add reference sections to raw material detail page
4. Add lightweight match status badge on raw materials
5. Add formula advisory checks using reference limits
6. Build importer scripts
7. Import workbook dataset

## Explicit Non-Goals For First Release

Do not do these in the first pass:

- replacing formulas to reference profiles directly
- rewriting stock logic
- changing batch deduction logic
- auto-blocking formulas with workbook rules
- importing all workbook raw payload into visible UI

## Immediate Next Step

Start with Phase 1 only:

- add `material_reference_profiles`
- add `raw_material_reference_links`
- wire read-only services

Once that is in place, the rest becomes a safe enhancement path instead of a risky rewrite.
