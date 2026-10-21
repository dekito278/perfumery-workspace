// Where an international buyer sends the money.
//
// FROM THE ENVIRONMENT, NOT FROM THIS FILE. Dekito's brief, §0: "Data sensitif (nomor rekening, kontak)
// disimpan di config/env, bukan hard-coded di template." An account number in the repository is in every
// clone, every fork and every screenshot of a diff — and it changes without a deploy being wanted.
//
// Unset is a FIRST-CLASS state, not a crash and not a blank line. The page says the details are being
// sent by WhatsApp instead, which is true and is what happened before this page existed. A half-filled
// bank block is worse than none: a buyer who sends to an incomplete recipient loses the transfer.
//
// Set these in Vercel (Production and Preview), all of them VITE_ because the page renders in a browser:
//   VITE_PAY_BANK_NAME       e.g. BCA (Bank Central Asia)
//   VITE_PAY_BANK_ACCOUNT    the account number
//   VITE_PAY_BANK_HOLDER     the name on the account
//   VITE_PAY_WIRE_BANK       the USD/SWIFT bank's name
//   VITE_PAY_WIRE_BIC        its SWIFT/BIC code
//   VITE_PAY_WIRE_ACCOUNT    the USD account number
//   VITE_PAY_WIRE_ADDRESS    the branch address the wire form asks for
//   VITE_PAY_CASH_CITY       the city for a Western Union cash pickup

const read = (name) => {
  try {
    return String(import.meta.env?.[name] ?? '').trim();
  } catch {
    return '';
  }
};

export const PAY_BANK = {
  country: 'Indonesia',
  currency: 'IDR',
  bank: read('VITE_PAY_BANK_NAME'),
  account: read('VITE_PAY_BANK_ACCOUNT'),
  holder: read('VITE_PAY_BANK_HOLDER'),
};

export const PAY_WIRE = {
  bank: read('VITE_PAY_WIRE_BANK'),
  bic: read('VITE_PAY_WIRE_BIC'),
  account: read('VITE_PAY_WIRE_ACCOUNT'),
  address: read('VITE_PAY_WIRE_ADDRESS'),
  holder: read('VITE_PAY_BANK_HOLDER'),
};

export const PAY_CASH = {
  holder: read('VITE_PAY_BANK_HOLDER'),
  city: read('VITE_PAY_CASH_CITY'),
};

/** Every field a buyer needs in order to send money without guessing. All or nothing, per block. */
export const bankIsConfigured = () => Boolean(PAY_BANK.bank && PAY_BANK.account && PAY_BANK.holder);
export const wireIsConfigured = () => Boolean(PAY_WIRE.bank && PAY_WIRE.bic && PAY_WIRE.account && PAY_WIRE.holder);
export const cashIsConfigured = () => Boolean(PAY_CASH.holder && PAY_CASH.city);
