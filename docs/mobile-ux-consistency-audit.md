# Mobile UX consistency audit

Date: 2026-05-17  
Scope: mobile layouts, page hierarchy, spacing, fixed actions, bottom navigation,
empty states, loading states, overlays, and cross-flow transitions.

## Executive summary

The mobile app has a solid foundation: shared shells, bottom navigation,
keyboard-aware behavior, state panels, bottom sheets, and an emerging fixed action
bar pattern. The biggest consistency issue is not missing components; it is that
pages use them unevenly. Some mobile pages now feel intentionally task-oriented
(`MobileProductManagementPage`, `MobileProductionCostingPage`, checkout,
bespoke), while older operational pages still feel like compressed web
dashboards.

The system is closest to consistent when pages follow this shape:

1. `MobileTopBar` or commerce header
2. one task/summary hero
3. grouped `mobile-card` sections
4. one clear bottom action pattern for long flows
5. shared empty/loading/error state
6. route transition/back behavior that preserves the previous list context

## Priority recommendations

### P0 - prevent interaction conflicts

| Area | Finding | Recommendation |
| --- | --- | --- |
| Fixed action + bottom nav | Fixed action bars are now present on key long flows, but not all long forms use the same reserve-space and keyboard behavior. | Require `StickyBottomActionBar fixed reserveSpace` for every long mobile flow with a primary CTA. Avoid hand-written `mobile-fixed-action` markup. |
| Keyboard behavior | Global CSS hides fixed nav/action surfaces during input focus. This is good, but pages with custom inline buttons still sometimes place critical actions near inputs. | Any keyboard-heavy page should rely on the shared action bar and avoid placing the only submit button at the end of a long form. |
| Bottom nav + FAB | Studio shell can show bottom nav plus FAB plus session actions; commerce shell can show bottom nav plus studio floating link. These can compete with fixed action bars. | Long task pages should pass `showFab={false}` and use one fixed action surface only. |

### P1 - unify page hierarchy

| Area | Finding | Recommendation |
| --- | --- | --- |
| Page rhythm | Some pages use a strong task hero; others jump directly into cards/lists. | Standardize long/task pages around: top bar -> task hero -> step/section cards -> fixed action. |
| Section headers | New pages use `eyebrow/title/description`; older pages use mixed text sizes and ad-hoc card headings. | Extract a shared `MobileTaskSection`/`MobileSectionHeader` component instead of defining local section wrappers per page. |
| Density | Operational pages (`MobileOrderDetailPage`, `MobileBatchesPage`, raw material flows) are still dense and dashboard-like. | Convert high-density areas to task sections with a primary next action and move secondary data into accordions. |

### P1 - rationalize flow transitions

| Area | Finding | Recommendation |
| --- | --- | --- |
| Back behavior | Detail pages generally use `useMobileBackNavigation`, but not every edit/create flow does. | Require list -> detail/edit navigation to pass `getMobileFromState(location)` and use `useMobileBackNavigation` on the destination. |
| Route animation | App-level mobile route transitions exist and distinguish push/pop/tab. This is good. | Keep route transitions subtle; do not add page-local animation unless it reinforces a subflow. |
| Scroll restoration | `ScrollToTop` supports `restoreScroll`; commerce nav also uses it for keep-alive tabs. | Ensure all card/list links pass restore state when returning from detail pages. |

### P2 - consolidate empty/loading states

| Area | Finding | Recommendation |
| --- | --- | --- |
| Empty states | Many pages use `MobileEmptyState`/`MobileStatePanel`, but a few still use custom card text. | Replace custom "no data" cards with `MobileEmptyState` unless the card is part of a richer onboarding section. |
| Loading states | `MobileLoadingState` and `MobileLoadingSkeleton` are both used. The distinction is not always clear. | Use `MobileLoadingState` for full-page blocking loads; use `MobileLoadingSkeleton` for list/content placeholders. |
| Error states | Error handling is mostly panel-based but tone/copy varies. | Use `MobileStatePanel tone="error"` with action text like "Try again" consistently. |

## Dimension-by-dimension audit

## 1. Spacing

### What is consistent

- `mobile-app-shell` establishes global padding and safe-area bottom spacing.
- Most pages use `main.mobile-page.space-y-4`.
- `mobile-card`/`mobile-soft-card` are common containers.
- Small-device media rules reduce padding and radii.

### Inconsistencies

- Some pages use raw `p-3`, `p-4`, `space-y-3`, `space-y-4` interchangeably
  without an obvious semantic rule.
- Long forms sometimes use a single card containing many fields, while newer
  pages use separate section cards.
- A few pages add custom bottom padding classes (`mobile-bespoke-page`,
  `mobile-checkout-page`) while newer fixed action bars use `reserveSpace`.

### Recommendation

Adopt these spacing rules:

- Page stack: `space-y-4`
- Section card: `p-4`
- Compact sub-card: `p-3`
- Field stack inside section: `gap-3`
- Dense numeric grids: `gap-2`
- Long fixed-action pages: use `StickyBottomActionBar reserveSpace`, not
  one-off page padding unless the flow has unusual geometry.

## 2. Hierarchy

### What is consistent

- Studio pages mostly use `MobileTopBar`.
- Commerce pages use a branded commerce header.
- Several recent refactors use a task hero with current context and summary
  metrics.

### Inconsistencies

- `MobileDashboardPage`, list pages, and some detail pages are more dashboard
  than task-oriented.
- Some pages expose many equal-weight cards, making it unclear what the next
  best action is.
- Section headings are often hand-authored, so type hierarchy varies.

### Recommendation

Introduce a shared hierarchy primitive:

```jsx
<MobileTaskHero eyebrow title description metrics />
<MobileTaskSection eyebrow title description action />
```

Use it on:

- `MobileBatchesPage`
- `MobileOrderDetailPage`
- `MobileRawMaterialsPage`
- `MobileRawMaterialDetailPage`
- `MobileValidationPage`

## 3. Fixed action pattern

### What is consistent

- `StickyBottomActionBar` now supports fixed mode, reserve space, and keyboard
  behavior.
- Checkout, bespoke, product management, production costing, validation, and
  formula edit flows use or are moving toward this pattern.

### Inconsistencies

- Some pages still use inline or terminal CTAs only.
- `MobileActionDock` and `StickyBottomActionBar` overlap conceptually.
- Fixed actions are not yet governed by a clear "one primary action per flow"
  rule.

### Recommendation

Use:

- `StickyBottomActionBar fixed reserveSpace` for primary long-flow actions.
- `MobileActionDock` for detail-page action clusters that are not fixed.
- Inline buttons for local, reversible actions only.

Avoid:

- hand-written `mobile-fixed-action`
- multiple floating actions on the same page
- leaving submit buttons only at the bottom of long forms

## 4. Bottom navigation

### What is consistent

- Both commerce and studio shells use fixed bottom nav.
- Bottom nav hides when keyboard is active.
- Studio nav groups complex destinations into two high-level groups.

### Inconsistencies

- Commerce bottom nav has five direct tabs; studio bottom nav has two group
  buttons that open a sheet. This is understandable but creates a different
  mental model.
- Some studio pages still show FAB unless explicitly disabled.
- Commerce has a floating `Studio` link for authenticated users, adding a third
  navigation surface.

### Recommendation

Define the contract:

- Commerce shell = customer journey nav.
- Studio shell = workspace switcher nav.
- Long task route = bottom nav remains available, FAB disabled, fixed action
  owns the bottom action layer.

Consider adding a route-level `taskMode` option to `MobileAuthenticatedLayout`
that automatically disables FAB and adjusts nav/action spacing.

## 5. Empty, loading, and error states

### What is consistent

- `MobileStatePanel` is flexible and already supports empty/error/loading/success.
- `MobileEmptyState` wraps the empty case.
- Several pages use shared loading skeleton/state components.

### Inconsistencies

- Some pages use custom empty cards instead of `MobileEmptyState`.
- Some loading states are full-screen, others are inline skeletons, without a
  stable rule.
- Empty copy varies from operational to conversational tone.

### Recommendation

Use this rule:

- Full-page async dependency: `MobileLoadingState`
- List or feed loading: `MobileLoadingSkeleton`
- No data: `MobileEmptyState`
- Recoverable error: `MobileStatePanel tone="error"` with retry action
- Success completion: `MobileStatePanel tone="success"` only when the flow
  actually ends

## 6. Transitions between flows

### What is consistent

- App-level `MobileRouteTransition` exists.
- It distinguishes detail push/pop and tab forward/back transitions.
- `ScrollToTop` restores scroll when instructed.
- `useMobileBackNavigation` exists for detail pages.

### Inconsistencies

- Not every navigation into detail/edit pages passes `from` state.
- Some flows use direct `navigate('/mobile/...')`, losing previous list context.
- Keep-alive behavior is mainly commerce dashboard/catalog; studio list/detail
  pages depend on scroll restoration.

### Recommendation

Adopt navigation rules:

- List/card -> detail: pass `getMobileFromState(location)`.
- Detail/edit back: use `useMobileBackNavigation(fallback)`.
- Tab switch: preserve scroll.
- New/create flow: back goes to parent list, not browser history ambiguity.
- Checkout/payment: no ambiguous back; use explicit "Edit cart", "Back to order",
  or "Continue shopping".

## Page-level notes

### Strong / mostly consistent

- `MobileCheckoutPage.jsx`: good long-flow action bar and checklist.
- `MobileBespokePage.jsx`: now reads as a full-page wizard.
- `MobileProductManagementPage.jsx`: recently improved into clear grouped
  sections with stable CTA.
- `MobileProductionCostingPage.jsx`: recently improved into a task flow with
  export action bar.
- `MobileBriefEditorPage.jsx`: good full-page editor pattern.

### Needs hierarchy/spacing pass

- `MobileBatchesPage.jsx`: powerful, but still panel-heavy. Convert to
  task-section rhythm like production costing.
- `MobileOrderDetailPage.jsx`: operationally rich but visually dense. Split into
  "next action", "payment proof", "shipment", "timeline", and "notes" hierarchy.
- `MobileRawMaterialsPage.jsx`: list/actions are functional, but add-material
  should become a full-page flow per overlay audit.
- `MobileRawMaterialDetailPage.jsx`: edit material sheet should become full-page;
  detail page can then simplify.
- `MobileValidationPage.jsx`: create/edit should become dedicated routes.

### Commerce-specific

- `MobileCatalogPage.jsx` and `MobileDashboardPage.jsx` use keep-alive/restore
  patterns well, but should keep card spacing and hero hierarchy aligned.
- `MobileProductDetailPage.jsx` has a healthy confirmation bottom sheet.
- `MobileCartPage.jsx` is simpler and should eventually use the same fixed
  action pattern if cart CTAs grow.

## Recommended implementation order

1. Extract shared `MobileTaskHero` and `MobileTaskSection`.
2. Add `taskMode` to `MobileAuthenticatedLayout` to disable FAB and reserve
   bottom action space rules consistently.
3. Replace remaining manual section/header patterns in:
   - `MobileBatchesPage`
   - `MobileOrderDetailPage`
   - `MobileRawMaterialsPage`
4. Convert full-page candidates from the overlay audit:
   - add material
   - edit material
   - validation create/edit
5. Normalize empty/loading/error states using the state rule above.
6. Audit all list -> detail links for `getMobileFromState(location)` and all
   detail/edit pages for `useMobileBackNavigation`.

## Acceptance checklist for future mobile pages

- [ ] Uses the correct shell: commerce vs studio.
- [ ] Uses `MobileTopBar` or commerce header, not a custom top header.
- [ ] Has one clear primary task.
- [ ] Uses `mobile-page space-y-4`.
- [ ] Uses section cards with title/description, not one giant form card.
- [ ] Uses `StickyBottomActionBar fixed reserveSpace` for long-flow primary CTA.
- [ ] Disables FAB on long task pages.
- [ ] Uses shared loading/empty/error states.
- [ ] Preserves return context from list/detail flows.
- [ ] Keyboard focus does not obscure the active field or the only primary CTA.

