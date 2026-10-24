// The gate, the grammar and the wording of the two-way Telegram bot — kept out of the endpoint so a
// chain can test the parts that decide who gets in.
//
// Dekito asked for a bot that can also WRITE: stock, products, articles. He was told what that costs
// and chose it anyway, so this is built to that scope — with the strongest locks that do not take the
// feature away.
//
// WHAT IS ACTUALLY AT STAKE. The serverless endpoints hold SUPABASE_SERVICE_ROLE_KEY, which bypasses
// every RLS rule in the database. Studio protects the same writes with a login AND the TOTP second
// factor. A chat message has neither. So whoever holds the unlocked phone, or takes over the Telegram
// account, reaches the shop. Three things narrow that, and all three are enforced here:
//
//   1. the request must carry Telegram's secret header, so nothing but Telegram can call the endpoint;
//   2. the sender must be the ONE chat id the alerts already go to — no second operator, no groups;
//   3. anything that cannot be undone by one reply asks for confirmation first.
//
// FAIL CLOSED is the rule throughout. A missing secret, a missing allowlist, an unparseable body — all
// of them refuse. The alternative is an endpoint that is wide open for exactly as long as it takes
// someone to notice an environment variable was never set.

/** The one chat allowed to command the shop, read from the alert config that is already in place. */
export const allowedChatIdFrom = (extraJson) => {
  try {
    const parsed = JSON.parse(String(extraJson || '{}'));
    const id = String(parsed?.chat_id ?? '').trim();
    return /^-?\d+$/.test(id) ? id : '';
  } catch {
    return '';
  }
};

/**
 * May this update act?
 *
 * Returns a reason rather than a bare false so the endpoint can log WHY without telling the sender —
 * a stranger who learns which half of the lock they failed is halfway in.
 */
export const authorise = ({ secretHeader = '', expectedSecret = '', chatId = '', allowedChatId = '' } = {}) => {
  // Fail closed on configuration. An unset secret must never mean "no check".
  if (!String(expectedSecret).trim()) return { ok: false, reason: 'secret-not-configured' };
  if (!String(allowedChatId).trim()) return { ok: false, reason: 'allowlist-not-configured' };
  if (String(secretHeader) !== String(expectedSecret)) return { ok: false, reason: 'bad-secret' };
  if (String(chatId) !== String(allowedChatId)) return { ok: false, reason: 'wrong-chat' };
  return { ok: true, reason: '' };
};

/** Commands that change something. Everything here has to be confirmed before it runs. */
export const WRITING_COMMANDS = new Set(['stok', 'produk', 'artikel']);

/** `/stok aquilaria 12` -> { command: 'stok', args: ['aquilaria', '12'], body: '' } */
export const parseCommand = (text = '') => {
  const raw = String(text ?? '').trim();
  if (!raw.startsWith('/')) return { command: '', args: [], body: '' };
  const [firstLine, ...rest] = raw.split('\n');
  // Telegram appends @botname when several bots share a group. Strip it, or every command misses.
  const [word, ...args] = firstLine.slice(1).split(/\s+/).filter(Boolean);
  return {
    command: String(word || '').split('@')[0].toLowerCase(),
    args,
    body: rest.join('\n').trim(),
  };
};

export const isWritingCommand = (command) => WRITING_COMMANDS.has(String(command || '').toLowerCase());

/**
 * The confirmation token for a writing command.
 *
 * Derived from the command itself rather than stored: a serverless function has no memory between
 * calls, and a token the sender echoes back proves they saw what they were about to do. Short on
 * purpose — it is a speed bump against a fat finger, not a password.
 */
export const confirmationToken = (command, args = [], body = '') => {
  const subject = `${command} ${args.join(' ')} ${body}`.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < subject.length; i += 1) {
    hash = ((hash << 5) - hash + subject.charCodeAt(i)) | 0;
  }
  return `ya-${Math.abs(hash) % 10000}`.padEnd(7, '0');
};

export const HELP_TEXT = [
  'Perintah yang ada:',
  '',
  'BACA',
  '/stok — semua stok, yang menipis di atas',
  '/stok <nama> — satu produk',
  '/order — 5 order terakhir',
  '',
  'TULIS (minta konfirmasi dulu)',
  '/stok <nama> <angka> — ubah stok',
  '/produk <nama> — produk draft baru, selesaikan di Studio',
  '/artikel <judul>, lalu isinya di baris berikutnya — artikel draft baru',
  '',
  'Produk dan artikel dibuat sebagai DRAFT: belum terlihat pembeli sampai kamu terbitkan di Studio.',
].join('\n');
