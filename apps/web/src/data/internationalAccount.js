/**
 * Where an international buyer sends dollars.
 *
 * Transcribed from the invoice Dekito already sends by hand (SOL-2026-001-B, 14 Sep 2026). A domestic
 * transfer needs an account number; an international one does not work without the bank's legal name and
 * a SWIFT code, and a buyer who has to come back and ask for them has already lost confidence.
 *
 * `ourCharges` is his own instruction and it is the real fix for a problem this repo was solving with
 * arithmetic. "OUR" tells the sending bank that the SENDER pays every fee in the chain, so the full
 * amount arrives instead of $15-25 being taken out somewhere over the Pacific. The rounding in
 * usdPrice.js is the belt; this is the braces, and it is the better of the two because it is exact.
 */
export const INTERNATIONAL_TRANSFER_PAYMENT = {
  id: 'manual_transfer_usd',
  provider: 'manual_transfer_usd',
  label: 'International transfer (USD)',
  bankName: 'PT Bank BTPN Tbk (Jenius)',
  swift: 'SUNIIDJA',
  accountNumber: '90022310398',
  accountName: 'Ade Rizki Wiranto',
  currency: 'USD',
};
