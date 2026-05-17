# Mobile pages that still feel like compressed desktop

Date: 2026-05-17
Scope: `apps/web/src/pages/mobile/*.jsx`

## Recommendation summary

The next mobile UX work should prioritize pages where the user is doing real work, not just browsing. The strongest desktop-shrink smell is when a page still presents many controls, sheets, panels, or dense metric grids at once instead of guiding one mobile task at a time.

## Priority ranking

### P0 — Fix first

#### 1. `MobileBatchesPage.jsx`

**Why it feels desktop-shrunk**
- Very large page surface with many simultaneous concepts: batch setup, workflow status, costing, materials, output, and production actions.
- Dense grids, including 4-column metric/action groups, make it feel like a production dashboard compressed into cards.
- Uses a bottom sheet for batch creation/editing, but batch setup is a long, consequential workflow.

**Recommended direction**
- Split into a task-oriented batch flow:
  1. Choose formula/product
  2. Set batch size and yield
  3. Review material requirements
  4. Confirm production status/action
- Keep list/overview page focused on queue and current batch states.
- Move long batch setup/editing out of sheet into `/mobile/batches/new` and `/mobile/batches/:id/edit` style dedicated flows.
- Add stable fixed action bar for confirm/update actions.

**Expected impact**: High. This page is operational and likely used under time pressure.

#### 2. `MobileOrderDetailPage.jsx`

**Why it feels desktop-shrunk**
- Very long page with many order-management responsibilities in one screen.
- Contains 5-column and 6-column grids that are hard to parse on phones.
- Payment proof rejection still uses a desktop-style dialog, although rejection is a focused decision task.
- Several fulfillment/payment/customer/status sections compete for hierarchy.

**Recommended direction**
- Convert into an order timeline + task cards model:
  - Primary next action at top
  - Payment task
  - Fulfillment task
  - Customer/contact task
  - Items summary
  - Timeline/history
- Replace wide status grids with horizontal timeline chips or stacked state rows.
- Move reject-proof flow to bottom sheet if short, or dedicated page if it needs reason templates/history.
- Add a fixed action bar only for the current primary order action.

**Expected impact**: High. This page affects revenue operations and mistakes are costly.

#### 3. `MobileRawMaterialsPage.jsx`

**Why it feels desktop-shrunk**
- Multiple bottom sheets for add/edit/category/guidance-like work create overlay stacking and context switching.
- Filter controls are dense and horizontally scrollable in multiple rows.
- Raw material editing can be data-heavy; putting it in sheets risks keyboard/scroll friction.

**Recommended direction**
- Keep the page as a search/browse/audit queue.
- Move add/edit raw material into dedicated page flows.
- Keep quick category/source selection as sheets only if they are one-step selectors.
- Consolidate filters into a single filter surface with active chips shown inline.

**Expected impact**: High. Raw materials are foundational data; mobile editing needs confidence and lower error risk.

### P1 — Important next wave

#### 4. `MobileCreateFormulaPage.jsx` and `MobileEditFormulaPage.jsx`

**Why it feels desktop-shrunk**
- Formula composition is inherently workbook-like; the mobile pages still depend on metadata sheets and composer overlays.
- Create and edit are similar but not fully unified around one mobile pattern.
- Metadata is hidden in sheets even though it affects save/readiness.

**Recommended direction**
- Keep the composer itself as the main workspace, but make metadata a first-class step or collapsible section, not a separate sheet.
- Standardize create/edit around the same action bar and step model:
  - Details
  - Materials
  - Review
- Reserve overlays for material search/selection only.

**Expected impact**: Medium-high. It will make formulation feel less like operating a tiny spreadsheet.

#### 5. `MobileRawMaterialDetailPage.jsx`

**Why it feels desktop-shrunk**
- Detail page has good mobile bones, but edit and guidance still happen through sheets.
- Guidance editing can be cognitively heavier than a quick sheet interaction.

**Recommended direction**
- Keep simple metadata quick edits in bottom sheets.
- Move guidance authoring/editing into a dedicated flow if it includes source, notes, interpretation, and confidence.
- Give the detail page one clear next action: audit, edit core data, or review guidance.

**Expected impact**: Medium-high, especially for data quality workflows.

#### 6. `MobileDashboardPage.jsx`

**Why it feels desktop-shrunk**
- Still reads partly like a web dashboard with many summary cards and a bottom sheet for quick create.
- Horizontal scroll metrics are acceptable, but the page should more clearly answer: “What should I do next?”

**Recommended direction**
- Reframe dashboard as a mobile command center:
  - Today/urgent queue
  - Continue recent work
  - Create shortcuts
  - Health signals collapsed below
- Keep metrics secondary, not top-level equal citizens.

**Expected impact**: Medium. Improves first impression and daily navigation.

### P2 — Polish / pattern consistency

#### 7. `MobileFulfillmentPage.jsx` and `MobileOrdersPage.jsx`

**Why it still has desktop residue**
- Dense filter rows and horizontally scrolling controls.
- Card patterns are mostly mobile-friendly, but the flow still leans toward database filtering rather than task queues.

**Recommended direction**
- Convert filter-heavy controls into intent tabs: `Needs action`, `Ready`, `Waiting`, `Done`.
- Keep advanced filters behind one filter button.
- Promote per-card next action.

**Expected impact**: Medium. Useful after Order Detail is fixed.

#### 8. `MobileCatalogPage.jsx` and `MobileStorefrontPage.jsx`

**Why it has minor desktop residue**
- Some 4-column filter/category grids and horizontal filter strips can feel dense.
- Commerce browsing itself is already closer to native mobile, so this is not as urgent.

**Recommended direction**
- Reduce 4-column controls to chips/carousels or 2-column cards depending on content.
- Keep product grid; it is a familiar mobile pattern.
- Make filter state more explicit and easier to reset.

**Expected impact**: Low-medium.

## Pages that are now in better mobile shape

- `MobileValidationPage.jsx` + `MobileValidationEditorPage.jsx`: now split between list and dedicated form flow.
- `MobileProductManagementPage.jsx`: improved grouping and stable CTA.
- `MobileProductionCostingPage.jsx`: more task-oriented after refactor.
- `MobileBriefEditorPage.jsx`: already uses a stepped editor and action bar, though it should use the fixed/reserved action bar pattern consistently.
- `MobileBriefsPage.jsx`, `MobileCustomersPage.jsx`, `MobileCategoriesPage.jsx`, `MobileCartPage.jsx`: comparatively simple and mobile-appropriate.

## Proposed execution order

1. **Batches** — biggest operational workflow mismatch.
2. **Order Detail** — highest risk/cost if actions are unclear.
3. **Raw Materials list/editing** — foundational data quality and many sheet-heavy edits.
4. **Formula create/edit** — unify composer patterns and reduce sheet dependence.
5. **Raw Material Detail guidance editing** — split heavier authoring from quick detail review.
6. **Dashboard** — reframe from metrics dashboard to action hub.
7. **Orders/Fulfillment lists** — simplify filtering into queues.
8. **Catalog/Storefront polish** — lighter density and filter polish.

## Pattern rule going forward

Use a modal or bottom sheet only when the task is:
- short,
- reversible,
- one-context,
- and does not require sustained typing.

Use a dedicated mobile page flow when the task has:
- multiple sections,
- keyboard-heavy input,
- review/confirmation,
- data-loss risk,
- or more than one meaningful decision.
