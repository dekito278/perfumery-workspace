/**
 * Does this sentence TELL the reader to contact us?
 *
 * Asked of the TEXT, not of a list of keys. The tracking page opens with a sentence chosen by
 * describeOrderKey, and two of those sentences end with "tanya lewat WhatsApp" / "message us on
 * WhatsApp" — an instruction the page then gave the buyer no way to follow. Reading the sentence means
 * a new state, or a rewording in either language, carries its own button without anyone remembering.
 *
 * Mentioning WhatsApp is not the same as asking for it. "An order from abroad is arranged on WhatsApp"
 * describes how something works; "Nomor WhatsApp wajib diisi" is a form field about the BUYER's number.
 * Neither is an instruction to open a chat, and demanding a button beside them would teach whoever meets
 * this rule next that it cries wolf. So the sentence must also carry a word aimed at the reader.
 */
const CONTACT_CUE = /\b(tanya|hubungi|japri|chat|kirim pesan|message us|messaging us|ask us|contact us|talk to us|reach us)\b/i;

export const invitesWhatsApp = (text) => {
  const value = String(text || '');
  return /whatsapp/i.test(value) && CONTACT_CUE.test(value);
};

export default invitesWhatsApp;
