# Mobile overlay rules

This app uses three different interaction surfaces on mobile:

## 1. Dedicated page route

Use a page when the interaction is a **primary task**:

- multi-step flow
- checkout or payment
- more than a few required fields
- long text entry
- something a user may want to leave and return to
- a flow that should have a stable URL

Examples:

- bespoke wizard
- checkout
- future long-form editors

## 2. `MobileBottomSheet`

Use a bottom sheet only for **short, interruptible side tasks**:

- quick confirmation
- choose from a short list
- compact edit form
- lightweight follow-up action

Good examples:

- add-to-cart confirmation
- pick a category
- import a URL
- confirm publishing a product draft

Do **not** use a bottom sheet for:

- fullscreen flows
- multi-step wizards
- checkout
- long forms with many fields
- anything that needs its own page-level navigation

## 3. `MobileFullScreenModal`

Use a fullscreen modal sparingly for a **bounded subflow** that still belongs to
the current route and benefits from temporary focus.

Acceptable example:

- validation entry when it remains a compact subordinate task

If the modal starts becoming one of the following, convert it to a page route:

- long-lived
- multi-step and business-critical
- independently addressable
- keyboard-heavy enough to feel like a screen of its own

## Quick decision test

If any of these are true, prefer a **page route**:

1. The user could reasonably think of it as "going somewhere".
2. It contains more than 5 meaningful inputs.
3. It has more than 1 step.
4. It includes payment, shipping, or data that must be reviewed carefully.
5. Keyboard handling becomes part of the design conversation.

## Current mobile input-flow audit

### Keep as dedicated full-page flows

These are primary, keyboard-heavy, or review-heavy tasks. They should stay on
routes with the page scroller and the shared mobile action bar pattern.

| Flow | File | Decision | Reason |
| --- | --- | --- | --- |
| Checkout | `pages/mobile/MobileCheckoutPage.jsx` | Full page | Payment, shipping, customer data, and review requirements. |
| Bespoke request wizard | `pages/mobile/MobileBespokePage.jsx` | Full page | Multi-step customer-facing flow with payment/shipping consequences. |
| Brief editor | `pages/mobile/MobileBriefEditorPage.jsx` | Full page | Long creative text entry and review before save. |
| Formula create/edit composer | `pages/mobile/MobileCreateFormulaPage.jsx`, `pages/mobile/MobileEditFormulaPage.jsx`, `components/mobile/MobileFormulaComposerWorkspace.jsx` | Full page | Primary formula work, dense composition editing, and unsaved-state risk. |
| Batch calculator | `pages/mobile/MobileBatchesPage.jsx` | Full page | Dense numeric input, costing, QC, yield, and product-stock consequences. |
| Production costing | `pages/mobile/MobileProductionCostingPage.jsx` | Full page | Scenario-heavy numeric modeling; users need context while editing. |
| Product management | `pages/mobile/MobileProductManagementPage.jsx` | Full page | Catalog admin form with variants, images, notes, visibility, and pricing. |
| Bespoke settings | `pages/mobile/MobileBespokeSettingsPage.jsx` | Full page | Admin configuration with upload, pricing, enabled state, and descriptions. |
| Order detail operational update | `pages/mobile/MobileOrderDetailPage.jsx` | Full page | Payment proof review, shipment tracking, status changes, and operational notes need visible context. |

### Convert to dedicated full-page flows

These currently use a modal/sheet for a task that has grown past "quick edit".

| Current flow | File | Current surface | Recommendation | Reason |
| --- | --- | --- | --- | --- |
| Add material | `pages/mobile/MobileRawMaterialsPage.jsx` | `MobileBottomSheet` | Convert to `/mobile/raw-materials/new` | 7 meaningful fields, stock thresholds, supplier/category data; easy to lose context with keyboard. |
| Edit material | `pages/mobile/MobileRawMaterialDetailPage.jsx` | `MobileBottomSheet` | Convert to `/mobile/raw-materials/:id/edit` | Very long form: identity, stock, cleanup status, guidance metrics, notes. This is no longer a compact edit. |
| Validation create/edit | `pages/mobile/MobileValidationPage.jsx` | `MobileFullScreenModal` | Convert to `/mobile/validation/new` and `/mobile/validation/:id/edit` | Multiple fields plus long sensory notes and next action; behaves like a document entry rather than a transient overlay. |

### Keep as modal / bottom sheet

These are short, interruptible, or confirmation-oriented tasks.

| Flow | File | Surface | Reason |
| --- | --- | --- | --- |
| Add-to-cart confirmation | `pages/mobile/MobileProductDetailPage.jsx` | `MobileBottomSheet` | Post-action confirmation with two choices. |
| Batch publish confirmation | `pages/mobile/MobileBatchesPage.jsx` | `MobileBottomSheet` | Confirmation/review gate, not data entry. |
| Formula category picker | `pages/mobile/MobileCreateFormulaPage.jsx` | `MobileBottomSheet` | Short option picker. |
| Formula metadata | `pages/mobile/MobileCreateFormulaPage.jsx`, `pages/mobile/MobileEditFormulaPage.jsx` | `MobileBottomSheet` | Acceptable while compact; keep only if it stays to name/code/version/status/notes. |
| Material stock quick edit | `pages/mobile/MobileRawMaterialsPage.jsx` | `MobileBottomSheet` | Borderline but acceptable as a focused stock/price adjustment. Convert if more identity/guidance fields are added. |
| Import guidance URL | `pages/mobile/MobileRawMaterialsPage.jsx`, `pages/mobile/MobileRawMaterialDetailPage.jsx`, `components/mobile/MobileFormulaComposerWorkspace.jsx` | `MobileBottomSheet` | URL + source + result state; compact side task. |
| Formula dilution setup | `components/mobile/MobileFormulaComposerWorkspace.jsx` | `MobileBottomSheet` | Bounded 1-material setup with a clear save/cancel. |
| Reject payment proof | `pages/mobile/MobileOrderDetailPage.jsx` | `Dialog` | One required note and a destructive confirmation; keep modal. |
| Navigation/FAB menus | `components/mobile/MobileBottomNavigation.jsx`, `components/mobile/MobileFloatingActionButton.jsx` | `MobileBottomSheet` | Short navigation menus; no long input. |

### Watchlist

- `MobileRawMaterialsPage` stock quick edit has 4 numeric fields. It is still
  okay as a quick operational sheet, but do not add supplier, guidance, or notes
  there.
- Formula metadata sheets are acceptable because the main composition remains
  full-page. If metadata becomes multi-section, promote it to a route.
- `MobileOrderDetailPage` already keeps most operational forms inline. Preserve
  that pattern; avoid moving shipment/payment/status controls into sheets.
