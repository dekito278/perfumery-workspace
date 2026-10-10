// `node src/utils/trackingTellsOneStory.selfcheck.mjs`
//
// /track/<orderNumber> is the page printed on every parcel's QR code. It says one sentence at the top
// (describeOrderKey) over a six-step timeline (orderProgressStepCount), and those two were written as
// separate ladders of if-clauses reading overlapping fields. So they could describe the same order
// differently, and did:
//
//   status=completed ship=packing    timeline "Dikemas" (4/6)   lead "sedang disiapkan"
//   status=completed ship=not_ready  timeline "Dibayar" (2/6)   lead "menunggu diproses"
//   status=shipped   ship=not_ready  timeline "Dikirim" (5/6)   lead "menunggu diproses"
//
// All three shapes are in the live table (read 2026-10-10, service role, 35 orders): 3 of the 8
// completed orders carry no shipment_status 'delivered', because Studio's order-status <select> writes
// 'completed' on its own while only the fulfillment screen writes the shipment side. An order this shop
// considers finished — it refuses to edit it — told its buyer it was still being packed.
//
// The rule is not those three rows. It is: for ANY order, the sentence and the timeline tell the same
// story. Checked over the cross product of the three vocabularies the owner can actually set, so a
// status nobody has used yet fails here rather than on a buyer's phone.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  ORDER_PHASES,
  PORTAL_STEP_KEYS,
  STUDIO_STEP_KEYS,
  TRACKING_STEP_COUNT,
  describeOrderKey,
  orderHasShipped,
  orderIsDelivered,
  orderPhase,
  orderProgressStepCount,
  portalActiveStepIndex,
  studioActiveStepIndex,
} from './trackingLead.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

// ── The page is still the subject ────────────────────────────────────────────────────────────────────
const page = read('pages', 'PublicTrackingPage.jsx');

// The count must OPEN the assignment the timeline is drawn from. A mention anywhere in the file is not
// enough: `if (false && orderProgressStepCount(order))` has walked past two guards in this repo.
assert.match(
  page,
  /const completeCount = useMemo\(\(\) => orderProgressStepCount\(order\), \[order\]\);/,
  'the tracking timeline must be counted by orderProgressStepCount — if the page now counts its own steps again, the sentence above them can drift from them again',
);
assert.match(
  page,
  /index < completeCount/,
  'the timeline must still tick steps from completeCount',
);

// TRACKING_STEP_COUNT is a number written in a util about a list that lives in the page. Check it
// against the page rather than trusting it: a seventh step added to the page would otherwise leave
// every delivered order one tick short, forever.
const stepsBody = page.match(/const steps = \[([\s\S]*?)\n\];/);
assert.ok(stepsBody, 'could not find the step list in PublicTrackingPage — this guard\'s parse is broken, not the page');
const pageSteps = [...stepsBody[1].matchAll(/key: '(\w+)'/g)].map((match) => match[1]);
assert.equal(
  pageSteps.length,
  TRACKING_STEP_COUNT,
  `the page draws ${pageSteps.length} steps and TRACKING_STEP_COUNT says ${TRACKING_STEP_COUNT} — a delivered order would stop short of the last one`,
);
assert.equal(pageSteps.at(-1), 'delivered', 'the last step is what orderIsDelivered fills — it must still be the delivered one');

// ── The vocabularies the owner can really set ───────────────────────────────────────────────────────
const objectKeys = (source, name) => {
  const body = source.match(new RegExp(`${name} = \\{([\\s\\S]*?)\\n\\};`));
  assert.ok(body, `could not find ${name} — this guard's parse is broken, not the vocabulary`);
  return [...body[1].matchAll(/^\s*(\w+):/gm)].map((match) => match[1]);
};
const orderService = read('services', 'orderService.js');
const orderStatuses = objectKeys(orderService, 'const orderStatusLabels');
const shipmentStatuses = objectKeys(orderService, 'const shipmentStatusLabels');
const paymentStatuses = objectKeys(read('utils', 'orderWorkflow.js'), 'export const paymentStatusLabels');
for (const [what, values] of [['order', orderStatuses], ['shipment', shipmentStatuses], ['payment', paymentStatuses]]) {
  assert.ok(values.length >= 4, `only ${values.length} ${what} statuses parsed — the parse is broken`);
}
assert.ok(orderStatuses.includes('completed'), 'order status "completed" must still be one the owner can set — the bug this guard exists for starts there');

// ── One order, one story ────────────────────────────────────────────────────────────────────────────
// Which leads may accompany which tick count. Written as the WHOLE allowed set per count, so a new lead
// key has to be placed here deliberately.
const LEADS_BY_COUNT = {
  // 0 is a cancelled order: nothing ticked, and a lead that says so instead of waiting for a payment
  // that will never be accepted.
  0: ['track.cancelledLead'],
  6: ['track.delivered'],
  5: ['track.shipped', 'track.shippedNoWaybill'],
  4: ['track.preparing'],
  3: ['track.preparing'],
  2: ['track.queued'],
  1: ['track.recorded'],
};

let checked = 0;
for (const status of orderStatuses) {
  for (const shipmentStatus of shipmentStatuses) {
    for (const paymentStatus of paymentStatuses) {
      for (const stamps of [{}, { shippedAt: '2026-10-01T00:00:00Z' }, { deliveredAt: '2026-10-02T00:00:00Z' }]) {
        const order = { status, shipmentStatus, paymentStatus, ...stamps };
        const count = orderProgressStepCount(order);
        const lead = describeOrderKey(order);
        checked += 1;

        assert.ok(count >= 0 && count <= TRACKING_STEP_COUNT, `step count ${count} is off the timeline for ${JSON.stringify(order)}`);
        assert.equal(
          count === 0,
          orderPhase(order) === 'cancelled',
          `only a cancelled order ticks nothing — ${JSON.stringify(order)} ticks ${count}`,
        );
        assert.ok(
          LEADS_BY_COUNT[count].includes(lead),
          `the sentence and the timeline disagree about ${JSON.stringify(order)}: step ${count} of ${TRACKING_STEP_COUNT} under "${lead}"`,
        );

        // The two questions both ladders now open with, stated as properties rather than read off the
        // clause order — this is what broke: a finished order that no shipment field called finished.
        //
        // Cancelled is the exception, and deliberately so: a cancellation is the NEWER fact about a
        // parcel that had already left, which is the same rule the invoice applies (invoiceShipment's
        // 'closed' beats its 'delivered'). So these two properties hold for every order the shop still
        // considers live.
        const cancelled = orderPhase(order) === 'cancelled';
        if (!cancelled) {
          assert.equal(
            orderIsDelivered(order),
            count === TRACKING_STEP_COUNT,
            `orderIsDelivered and the last tick must mean the same thing for ${JSON.stringify(order)}`,
          );
          if (orderHasShipped(order)) {
            assert.ok(count >= 5, `${JSON.stringify(order)} has shipped but sits at step ${count}`);
          }
        }
        if (status === 'completed') {
          assert.equal(count, TRACKING_STEP_COUNT, `a completed order must fill the timeline — ${JSON.stringify(order)} stopped at ${count}`);
          assert.equal(lead, 'track.delivered', `a completed order must read as delivered — ${JSON.stringify(order)} says "${lead}"`);
        }
      }
    }
  }
}
assert.ok(checked >= 300, `only ${checked} combinations exercised — the cross product collapsed`);

// Every lead key the ladder can return has to exist in both shops.
const { MESSAGES } = await import('../i18n/messages.js');
for (const keys of Object.values(LEADS_BY_COUNT)) {
  for (const key of keys) {
    for (const lang of ['id', 'en']) {
      assert.ok(MESSAGES[lang]?.[key], `${key} has no ${lang} wording`);
    }
  }
}

// ── The portal's last step must not argue with its own tick ─────────────────────────────────────────
// Same bug, other screen: the member portal ticks the final step from order.status and captioned it
// from delivered_at alone, so a completed order with no date read "menunggu pengiriman" under a step
// already marked done. The caption has to READ the tick — the `done ?` is the whole point.
const portal = read('pages', 'CustomerPortalPage.jsx');
const completedBranch = portal.match(/if \(step\.key === 'completed'\) \{([\s\S]*?)\n    \}/);
assert.ok(completedBranch, 'could not find the portal\'s completed step — this guard\'s parse is broken, not the portal');
assert.match(
  completedBranch[1],
  /done \? 'cust\.recorded'/,
  'the portal\'s final step caption must fall back on the tick (done), not on a sentence about waiting',
);

// ── Four screens draw a progress strip. They answer one question ───────────────────────────────────
// The lists differ on purpose — /track has a Dikemas step the others do not, the portal opens with
// "Order dibuat", Studio's is five long — so the invariant is not an equal index. It is that each
// screen reads the same PHASE, and that its own table never puts a later phase on an earlier step.
const SCREENS = [
  { name: '/track', index: orderProgressStepCount, steps: TRACKING_STEP_COUNT, blank: 0 },
  { name: '/customer', index: portalActiveStepIndex, steps: PORTAL_STEP_KEYS.length, blank: -1 },
  { name: 'Studio order detail', index: studioActiveStepIndex, steps: STUDIO_STEP_KEYS.length, blank: -1 },
];

const orderFor = (phase) => ({
  cancelled: { status: 'cancelled', paymentStatus: 'expired', shipmentStatus: 'not_ready' },
  recorded: { status: 'pending_payment', paymentStatus: 'unpaid', shipmentStatus: 'not_ready' },
  paid: { status: 'paid', paymentStatus: 'paid', shipmentStatus: 'not_ready' },
  preparing: { status: 'processing', paymentStatus: 'paid', shipmentStatus: 'not_ready' },
  packed: { status: 'paid', paymentStatus: 'paid', shipmentStatus: 'packing' },
  shipped: { status: 'shipped', paymentStatus: 'paid', shipmentStatus: 'shipped', shippedAt: '2026-10-01T00:00:00Z' },
  delivered: { status: 'completed', paymentStatus: 'paid', shipmentStatus: 'delivered', deliveredAt: '2026-10-02T00:00:00Z' },
}[phase]);

for (const phase of ORDER_PHASES) {
  const order = orderFor(phase);
  assert.ok(order, `no sample order for phase ${phase} — add one rather than leaving it unchecked`);
  assert.equal(orderPhase(order), phase, `the sample order for ${phase} does not land on it`);
}

for (const screen of SCREENS) {
  // A cancelled order ticks nothing. Studio's desktop strip used to tick "Menunggu bayar" on all 6 of
  // the cancelled orders on production, because Math.max(0, indexOf(...)) turns -1 into 0.
  assert.equal(
    screen.index(orderFor('cancelled')),
    screen.blank,
    `${screen.name} marks progress on a cancelled order`,
  );
  // Monotonic: later phase, never an earlier step.
  const live = ORDER_PHASES.filter((phase) => phase !== 'cancelled');
  for (let i = 1; i < live.length; i += 1) {
    const earlier = screen.index(orderFor(live[i - 1]));
    const later = screen.index(orderFor(live[i]));
    assert.ok(
      later >= earlier,
      `${screen.name} puts ${live[i]} (step ${later}) before ${live[i - 1]} (step ${earlier})`,
    );
  }
  // And inside its own list.
  for (const phase of live) {
    const step = screen.index(orderFor(phase));
    assert.ok(
      step >= 0 && step <= screen.steps,
      `${screen.name} answers ${step} for ${phase}, which is off a ${screen.steps}-step strip`,
    );
  }
}

// Over the live cross product, no two screens may disagree about which phase an order is in. Checked
// through the phase rather than the index, because the indices are deliberately different numbers.
for (const status of orderStatuses) {
  for (const shipmentStatus of shipmentStatuses) {
    for (const paymentStatus of paymentStatuses) {
      const order = { status, shipmentStatus, paymentStatus };
      const phase = orderPhase(order);
      for (const screen of SCREENS) {
        assert.equal(
          screen.index(order),
          screen.index(orderFor(phase)),
          `${screen.name} puts ${JSON.stringify(order)} on a different step than the ${phase} order it shares a phase with`,
        );
      }
    }
  }
}

// ── No screen keeps a private ladder ───────────────────────────────────────────────────────────────
const SCREEN_FILES = {
  'pages/CustomerPortalPage.jsx': /const activeStep = portalActiveStepIndex\(order\);/,
  'pages/OrderDetailPage.jsx': /const activeStep = studioActiveStepIndex\(order\);/,
  'pages/mobile/MobileOrderDetailPage.jsx': /const activeStep = studioActiveStepIndex\(order\);/,
};
for (const [file, wiring] of Object.entries(SCREEN_FILES)) {
  const source = read(...file.split('/'));
  assert.match(source, wiring, `${file} must take its active step from the shared reading`);
  assert.doesNotMatch(source, /const getActiveStep = /,
    `${file} has grown its own step ladder again`);
  assert.doesNotMatch(source, /Math\.max\(0, statusSteps\.indexOf/,
    `${file} is back to turning an unlisted status into step 0`);
}

// The two Studio screens slice their synthetic timeline out of the step list, so it has to be ONE list.
for (const file of ['pages/OrderDetailPage.jsx', 'pages/mobile/MobileOrderDetailPage.jsx']) {
  assert.match(read(...file.split('/')), /const statusSteps = STUDIO_STEP_KEYS;/,
    `${file} must share the Studio step list rather than writing it out again`);
}

// And the portal's own list — labels and all — must still be the one its table was built for.
const portalSteps = read('pages', 'CustomerPortalPage.jsx').match(/const progressSteps = \[([\s\S]*?)\n\];/);
assert.ok(portalSteps, "could not find the portal's step list — this guard's parse is broken, not the portal");
assert.deepEqual(
  [...portalSteps[1].matchAll(/key: '(\w+)'/g)].map((m) => m[1]),
  PORTAL_STEP_KEYS,
  "the portal draws a different step list than portalActiveStepIndex indexes into",
);

console.log(`trackingTellsOneStory: ok — ${checked} status combinations; the sentence and the timeline agree, and ${SCREENS.length} screens read one phase from one ladder`);
