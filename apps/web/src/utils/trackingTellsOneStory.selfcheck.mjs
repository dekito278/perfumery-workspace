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
  TRACKING_STEP_COUNT,
  describeOrderKey,
  orderHasShipped,
  orderIsDelivered,
  orderProgressStepCount,
} from './trackingLead.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

// ── The page is still the subject ────────────────────────────────────────────────────────────────────
const page = read('pages', 'PublicTrackingPage.jsx');

// The count must OPEN the assignment the timeline is drawn from. A mention anywhere in the file is not
// enough: `if (false && orderProgressStepCount(order))` has walked past two guards in this repo.
assert.match(
  page,
  /const completeCount = useMemo\(\(\) => \(isCancelled \? 0 : orderProgressStepCount\(order\)\)/,
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

        assert.ok(count >= 1 && count <= TRACKING_STEP_COUNT, `step count ${count} is off the timeline for ${JSON.stringify(order)}`);
        assert.ok(
          LEADS_BY_COUNT[count].includes(lead),
          `the sentence and the timeline disagree about ${JSON.stringify(order)}: step ${count} of ${TRACKING_STEP_COUNT} under "${lead}"`,
        );

        // The two questions both ladders now open with, stated as properties rather than read off the
        // clause order — this is what broke: a finished order that no shipment field called finished.
        assert.equal(
          orderIsDelivered(order),
          count === TRACKING_STEP_COUNT,
          `orderIsDelivered and the last tick must mean the same thing for ${JSON.stringify(order)}`,
        );
        if (orderHasShipped(order)) {
          assert.ok(count >= 5, `${JSON.stringify(order)} has shipped but sits at step ${count}`);
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

console.log(`trackingTellsOneStory: ok — ${checked} status combinations, ${pageSteps.length} steps, the sentence and the timeline agree on all of them`);
