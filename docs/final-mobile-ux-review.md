# Final mobile UX review — finishing adjustments

Date: 2026-05-17
Scope: end-to-end review of mobile routes, page patterns, mobile shell, action bars, overlays, empty/error states, and keyboard behavior.

## Overall read

The mobile app is now directionally much stronger: long flows are starting to move out of modals, the fixed action pattern exists, keyboard avoidance is centralized, and several heavy pages have been reframed as task flows. The remaining work is mostly consistency polish plus a few high-friction legacy pages that still carry desktop mental models.

The app-like target should be:

- one obvious primary action per screen,
- stable bottom action behavior,
- predictable back/return behavior,
- short overlays only for short side tasks,
- full-page flows for sustained typing or multi-step decisions,
- consistent loading/empty/error surfaces,
- and less visible “database filtering” on operational screens.

## Small consistency adjustments to finish

### 1. Normalize fixed action bars

**Issue**
Some pages already use `StickyBottomActionBar fixed reserveSpace`, but others use inline action bars or fixed bars without reserve spacing. This can create inconsistent bottom spacing and a slightly different feel per flow.

**Adjust**
- Use `fixed reserveSpace` for all dedicated create/edit/review flows.
- Use inline/non-fixed action bars only inside short sheets or embedded cards.
- For pages with bottom nav, fixed actions should sit above the nav and reserve scroll space.

**Candidates**
- `MobileBriefEditorPage.jsx` currently uses `StickyBottomActionBar` but not the newer fixed/reserve pattern.
- `MobileEditFormulaPage.jsx` uses fixed action but should be checked for `reserveSpace` and keyboard behavior.
- Any future batch/raw-material editor should start with `fixed reserveSpace` by default.

### 2. Make keyboard behavior explicit per flow

**Issue**
The global CSS hides fixed actions when keyboard is active, while the action bar component supports `keyboardBehavior`. This is good, but pages should intentionally choose behavior.

**Adjust**
- Use `keyboardBehavior="hide"` for forms where focused typing should get maximum space.
- Use `keyboardBehavior="stay"` only for short forms where save/continue must remain visible while typing.
- Avoid mixing ad-hoc fixed footers with component-managed action bars.

**Candidates**
- `MobileCheckoutPage.jsx`: likely okay with fixed action, but security/customer-code inputs should be checked with keyboard open.
- `MobileBespokePage.jsx`: wizard CTA should remain predictable through long typing moments.
- `MobileValidationEditorPage.jsx`: likely okay hiding during typing; preserve page space.

### 3. Disable FAB on pages with explicit primary actions

**Issue**
The app shell supports FAB, and some pages now have top-bar add buttons or fixed CTAs. Double primary actions can make the app feel less native and more web-app-ish.

**Adjust**
- Use `showFab={false}` on create/edit/detail flows with their own CTA.
- Reserve FAB only for index/list pages where “create” is the dominant global action and there is no top-right add button.

**Candidates**
- Already handled on several refactored pages.
- Recheck list pages with both top-right `Plus` and shell FAB.

### 4. Add missing empty/error states to detail and editor pages

**Issue**
Several pages have loading/error fallbacks, but some detail pages still rely on generic content absence or redirects.

**Adjust**
- Every route-level mobile page should have one of:
  - loading skeleton/state,
  - empty state,
  - not-found state,
  - retryable error state.

**Candidates**
- `MobileOrderDetailPage.jsx`: has not-found, but should use a more consistent `MobileStatePanel` for all error states.
- `MobileProductDetailPage.jsx`: add state treatment if product load fails or variant missing.
- `MobileRawMaterialDetailPage.jsx`: add a clearer retry/not-found panel if material lookup fails.
- `MobileDashboardPage.jsx`: add fallback for empty studio data instead of only metric cards.

### 5. Standardize page headers

**Issue**
Studio/internal pages mostly use `MobileTopBar`; commerce/public pages sometimes use custom hero/header layouts. That can be fine, but transitions between commerce and studio should still feel intentional.

**Adjust**
- Studio pages: always use `MobileTopBar` with consistent title/subtitle/eyebrow/action density.
- Dedicated editor pages: always include `onBack` and short subtitle explaining the task.
- Commerce browse pages can keep branded headers, but checkout/payment should use stronger step context.

**Candidates**
- `MobileBespokePage.jsx`, `MobileCheckoutPage.jsx`, `MobileCatalogPage.jsx`, `MobileStorefrontPage.jsx`, `MobileCartPage.jsx` should be reviewed as a separate commerce consistency pass.

### 6. Reduce multi-column metric density

**Issue**
A few pages still show 4-, 5-, or 6-column grids. These are the clearest visual smell of desktop compression.

**Adjust**
- Replace 4+ column grids with horizontal chips, stacked rows, or 2-column max summary tiles.
- For status/progress, use timeline rows rather than many equal-width pills.

**Candidates**
- `MobileOrderDetailPage.jsx`: 5- and 6-column grids.
- `MobileBatchesPage.jsx`: 4-column production metrics/action blocks.
- `MobileCatalogPage.jsx`: 4-column filter/category grids can be made more touch-friendly.

### 7. Convert remaining long bottom-sheet forms into page flows

**Issue**
The bottom-sheet component now has good guardrails, but some pages still use sheets for sustained editing.

**Adjust**
- Keep sheets for: select formula, select category, quick status update, confirm tiny side task.
- Move to pages for: create/edit raw material, create/edit batch, formula metadata if it affects save readiness, guidance authoring.

**Candidates**
- `MobileRawMaterialsPage.jsx`: add/edit material sheets.
- `MobileBatchesPage.jsx`: batch setup sheet.
- `MobileRawMaterialDetailPage.jsx`: guidance editing sheet.
- `MobileCreateFormulaPage.jsx` / `MobileEditFormulaPage.jsx`: metadata sheet should become a section or step.

### 8. Make filters feel like mobile queues, not database controls

**Issue**
Operational pages often expose many filters as horizontally scrolling chips. This works, but it can feel like a web table toolbar translated into mobile.

**Adjust**
- First-level tabs should answer user intent: `Needs action`, `Ready`, `Waiting`, `Done`.
- Advanced filters should live behind a single filter control.
- Active filters should appear as removable chips below search.

**Candidates**
- `MobileOrdersPage.jsx`
- `MobileFulfillmentPage.jsx`
- `MobileRawMaterialsPage.jsx`
- `MobileCatalogPage.jsx`

### 9. Align transition/back behavior

**Issue**
Some pages use `useMobileBackNavigation`, some call `navigate('/mobile/...')` directly. Direct navigation loses return context after entering from filtered/detail screens.

**Adjust**
- Use `getMobileFromState(location)` when moving from list to detail/editor.
- Use `useMobileBackNavigation(fallback)` on detail/editor pages.
- Preserve `restoreScroll` on return to long lists.

**Candidates**
- Validation editor is now aligned.
- Review Product Management, Raw Material detail/edit, Batch detail/edit, Order detail flows.

### 10. Normalize copy tone and action labels

**Issue**
Some pages use operational English, some use Indonesian, some use terse dashboard labels. This makes the app feel assembled from modules.

**Adjust**
- Pick a primary language per surface. If studio app remains English, keep action labels concise and consistent.
- Prefer verb-first CTAs: `Save validation`, `Create batch`, `Review order`, `Update material`.
- Avoid generic `Save` when the task has a meaningful object.

**Candidates**
- Checkout/customer-facing pages currently include Indonesian labels; that may be intentional for customers.
- Studio pages should use a consistent English operational tone.

## End-to-end priority list for remaining polish

### Finish now / tiny wins

1. Add `reserveSpace` to existing fixed action bars that do not have it.
2. Replace any remaining desktop `DialogContent` on mobile task flows with `MobileBottomSheet` or a dedicated page.
3. Add missing `MobileStatePanel` fallback to detail/editor routes.
4. Audit pages with top-right add button plus FAB and remove duplicate primary actions.
5. Replace 4+ column grids with 2-column max or timeline/chip patterns.

### Next implementation batch

1. `MobileBatchesPage.jsx`: split batch create/edit into dedicated flow.
2. `MobileOrderDetailPage.jsx`: reframe as timeline + next-action task cards.
3. `MobileRawMaterialsPage.jsx`: move add/edit material to full-page flow.
4. `MobileBriefEditorPage.jsx`: update to fixed/reserved action bar pattern.
5. `MobileCreateFormulaPage.jsx` / `MobileEditFormulaPage.jsx`: make metadata first-class, reduce sheet dependence.

## Definition of done for “app-like” mobile

A mobile page is done when:

- the user can describe the page’s primary job in one sentence,
- there is one obvious next action,
- long input never lives in a cramped overlay,
- keyboard open does not hide the field being edited,
- the bottom nav and CTA never visually fight,
- empty/loading/error states are intentional,
- back returns to the user’s previous context,
- and no screen looks like a desktop dashboard squeezed into cards.
