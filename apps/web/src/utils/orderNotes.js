// Order notes are a newline-joined blob built by cartService.buildOrderNotes:
//   Address: <address>\nArea: <area>\nShipping: <summary>\nPayment: <method>\nNotes: <free text>
// A delivery address the buyer typed across several lines therefore spans several lines of the blob.
// Splitting on '\n' and taking the first line dropped everything after the first newline — the shipping
// label printed a truncated address (audit round 7). Parse by key instead: a value runs until the next
// known key.

export const ORDER_NOTE_KEYS = ['Address', 'Area', 'Shipping', 'Payment', 'Notes'];

const keyOf = (line) => ORDER_NOTE_KEYS.find((key) => (
  line.toLowerCase().startsWith(`${key.toLowerCase()}:`)
));

export const parseOrderNoteRows = (notes = '') => {
  const rows = [];
  for (const rawLine of String(notes || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const key = keyOf(line);
    if (key) {
      rows.push({ label: key, value: line.slice(key.length + 1).trim() });
      continue;
    }

    // A continuation line belongs to the value above it.
    if (rows.length) {
      rows[rows.length - 1].value = [rows[rows.length - 1].value, line].filter(Boolean).join('\n');
    } else {
      const [label, ...rest] = line.split(':');
      rows.push({ label: label || 'Note', value: rest.join(':').trim() });
    }
  }
  return rows.map((row) => ({ ...row, value: row.value || '-' }));
};

export const getOrderNoteField = (notes = '', label) => {
  const row = parseOrderNoteRows(notes).find((item) => item.label.toLowerCase() === String(label).toLowerCase());
  return row && row.value !== '-' ? row.value : '';
};

// The text an admin expects when they tap "Salin" on an order. The mobile list used to copy
// order.checkoutDraft directly, so an order without a draft put the literal string "undefined" on the
// clipboard and a clipboard rejection went unhandled (audit round 7).
export const buildOrderCopyText = (order = {}) => (
  order.checkoutDraft || order.notes || order.orderNumber || ''
);
