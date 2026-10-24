// The two-way half of the Telegram bot: Dekito sends a command, the shop answers.
//
// He asked for one that can also WRITE — stock, products, articles — was told plainly that these
// endpoints hold SUPABASE_SERVICE_ROLE_KEY and bypass every RLS rule, that Studio protects the same
// writes behind a login and a TOTP second factor, and that a chat message has neither. He chose it
// anyway, so it is built to that scope with the strongest locks that do not take the feature away.
//
// The locks, all enforced before a single byte is read as a command:
//   1. Telegram's own secret header — nothing but Telegram can reach past this line;
//   2. the sender must be the ONE chat id the order alerts already go to;
//   3. every writing command needs a confirmation token echoed back.
//
// FAIL CLOSED everywhere: a missing secret, a missing allowlist or an unreadable body all refuse. An
// endpoint that treats "not configured" as "no check needed" is open from the moment it deploys.
//
// It always answers Telegram with 200. A non-200 makes Telegram retry the same update for hours, which
// would turn one rejected message into a flood — and the reply to the SENDER is where refusals are
// reported, never in the HTTP status.
import process from 'node:process';
import { Buffer } from 'node:buffer';
import {
  HELP_TEXT, allowedChatIdFrom, authorise, confirmationToken, isWritingCommand, parseCommand,
} from '../../src/utils/telegramCommands.js';

const ok = (res) => { res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}'); };

const readBody = async (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return null;
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
};

const say = async (text) => {
  const url = String(process.env.ORDER_ALERT_WEBHOOK_URL || '').trim();
  const extra = String(process.env.ORDER_ALERT_EXTRA || '{}');
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...JSON.parse(extra), text: String(text).slice(0, 3500) }),
    });
  } catch { /* the shop does not depend on being able to talk back */ }
};

const db = () => {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  return url && key ? { url, key } : null;
};

const rest = async (path, init = {}) => {
  const conn = db();
  if (!conn) throw new Error('database not configured');
  const response = await fetch(`${conn.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: conn.key, Authorization: `Bearer ${conn.key}`,
      'Content-Type': 'application/json', ...(init.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text.slice(0, 180) || `HTTP ${response.status}`);
  return text ? JSON.parse(text) : null;
};

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

// --- the commands ------------------------------------------------------------------------------------

const readStock = async (needle) => {
  const rows = await rest('storefront_products?select=name,slug,stock&order=stock.asc&limit=60');
  const list = (rows || []).filter((row) => (
    !needle || String(row.name || '').toLowerCase().includes(needle.toLowerCase())
  ));
  if (!list.length) return needle ? `Tidak ada produk yang cocok dengan "${needle}".` : 'Belum ada produk.';
  return list.slice(0, 25).map((row) => `${Number(row.stock ?? 0)} — ${row.name}`).join('\n');
};

const readOrders = async () => {
  const rows = await rest('storefront_orders?select=order_number,subtotal,payment_status,status,created_at&order=created_at.desc&limit=5');
  if (!rows?.length) return 'Belum ada order.';
  return rows.map((row) => (
    `${row.order_number} · ${money(row.subtotal)} · ${row.payment_status || '-'}/${row.status || '-'}`
  )).join('\n');
};

const setStock = async (needle, units) => {
  const rows = await rest(`storefront_products?select=id,name,stock,updated_at&name=ilike.*${encodeURIComponent(needle)}*&limit=4`);
  if (!rows?.length) return `Tidak ada produk bernama "${needle}".`;
  if (rows.length > 1) return `"${needle}" cocok ke ${rows.length} produk:\n${rows.map((r) => r.name).join('\n')}\nSebutkan lebih spesifik.`;
  const target = rows[0];
  // Through the RPC, never by writing the column. Stock has two sanctioned movements and a third way
  // that just assigns a number is audit round 7's bug: a value decided before an order deducted stock
  // and written after it. The RPC refuses when the row moved since this read.
  const changed = await rest('rpc/storefront_set_stock', {
    method: 'POST',
    body: JSON.stringify({ p_product_id: target.id, p_stock: units, p_expected_updated_at: target.updated_at }),
  });
  if (changed === false) return `Stok ${target.name} berubah barusan (mungkin ada order). Coba lagi.`;
  return `${target.name}: ${Number(target.stock ?? 0)} → ${units}`;
};

const draftProduct = async (name) => {
  // A DRAFT, deliberately: catalog_visible false and no price. A product invented from one chat word
  // would otherwise be orderable at whatever the empty fields default to.
  const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  await rest('storefront_products', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([{ name, slug, catalog_visible: false }]),
  });
  return `Produk draft "${name}" dibuat. Harga, varian dan foto diselesaikan di Studio — belum terlihat pembeli.`;
};

const draftArticle = async (title, body) => {
  await rest('journal_posts', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([{ title, content: body || '', status: 'draft', category: 'experience' }]),
  });
  return `Artikel draft "${title}" dibuat${body ? ` (${body.length} karakter)` : ' tanpa isi'}. Terbitkan di Studio kalau sudah pas.`;
};

// --- the endpoint ------------------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== 'POST') return ok(res);

  const verdict = authorise({
    secretHeader: req.headers['x-telegram-bot-api-secret-token'] || '',
    expectedSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
    chatId: '',
    allowedChatId: allowedChatIdFrom(process.env.ORDER_ALERT_EXTRA),
  });
  // The secret is checked before the body is even read: an unauthenticated caller must not be able to
  // make this endpoint do work, let alone reach the database.
  if (!verdict.ok && verdict.reason !== 'wrong-chat') {
    // The REASON, never the values. A refusal is silent to the sender on purpose — telling a stranger
    // which half of the lock they failed is halfway to opening it — but silent to the owner too is how
    // a dead bot looks exactly like a wrong secret. This line is the difference between diagnosing it
    // and guessing at it.
    console.warn(`[telegram] refused: ${verdict.reason}`);
    return ok(res);
  }

  const update = await readBody(req);
  const message = update?.message || update?.edited_message || null;
  const chatId = String(message?.chat?.id ?? '');
  const gate = authorise({
    secretHeader: req.headers['x-telegram-bot-api-secret-token'] || '',
    expectedSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
    chatId,
    allowedChatId: allowedChatIdFrom(process.env.ORDER_ALERT_EXTRA),
  });
  if (!gate.ok) {
    // Same again for the second half. 'wrong-chat' here means the secret matched — so Telegram and the
    // endpoint agree — and the sender simply is not the chat id in ORDER_ALERT_EXTRA.
    console.warn(`[telegram] refused: ${gate.reason}`);
    return ok(res);
  }

  const { command, args, body } = parseCommand(message?.text || '');
  if (!command) return ok(res);

  try {
    if (['bantuan', 'help', 'start'].includes(command)) { await say(HELP_TEXT); return ok(res); }

    // Writing commands carry their own confirmation. Stateless on purpose: a serverless call remembers
    // nothing, and a token echoed back proves the sender saw what they were about to do.
    let tail = [...args];
    let confirmed = false;
    if (isWritingCommand(command) && /^ya-\d+/.test(tail[tail.length - 1] || '')) {
      confirmed = tail.pop() === confirmationToken(command, tail, body);
      if (!confirmed) { await say('Kode konfirmasi tidak cocok. Kirim ulang perintahnya.'); return ok(res); }
    }

    if (command === 'stok' && tail.length >= 2 && /^\d+$/.test(tail[tail.length - 1])) {
      const units = Number(tail[tail.length - 1]);
      const needle = tail.slice(0, -1).join(' ');
      if (!confirmed) {
        await say(`Ubah stok "${needle}" jadi ${units}?\nKirim:\n/stok ${needle} ${units} ${confirmationToken('stok', tail, '')}`);
        return ok(res);
      }
      await say(await setStock(needle, units));
      return ok(res);
    }
    if (command === 'stok') { await say(await readStock(tail.join(' '))); return ok(res); }
    if (command === 'order') { await say(await readOrders()); return ok(res); }

    if (command === 'produk' && tail.length) {
      const name = tail.join(' ');
      if (!confirmed) {
        await say(`Buat produk draft "${name}"?\nKirim:\n/produk ${name} ${confirmationToken('produk', tail, '')}`);
        return ok(res);
      }
      await say(await draftProduct(name));
      return ok(res);
    }

    if (command === 'artikel' && tail.length) {
      const title = tail.join(' ');
      if (!confirmed) {
        await say(`Buat artikel draft "${title}"${body ? ` dengan isi ${body.length} karakter` : ' tanpa isi'}?\nKirim ulang perintah yang sama dengan ${confirmationToken('artikel', tail, body)} di akhir baris pertama.`);
        return ok(res);
      }
      await say(await draftArticle(title, body));
      return ok(res);
    }

    await say(`Perintah "${command}" tidak dikenal.\n\n${HELP_TEXT}`);
  } catch (error) {
    // The reason goes to Dekito, never into the HTTP response — Telegram retries on non-200 and the
    // sender is the only one who should learn anything about why something failed.
    await say(`Gagal: ${String(error?.message || error).slice(0, 300)}`);
  }
  return ok(res);
}
