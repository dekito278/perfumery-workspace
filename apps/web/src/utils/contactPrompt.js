/**
 * Does this sentence tell the reader to contact us?
 *
 * Asked of the TEXT, not of a list of keys. The tracking page opens with a sentence chosen by
 * describeOrderKey, and two of those sentences end with "tanya lewat WhatsApp" / "message us on
 * WhatsApp" — an instruction the page then gave the buyer no way to follow. Reading the sentence means
 * a new state, or a rewording in either language, carries its own button without anyone remembering to
 * wire one up.
 */
export const invitesWhatsApp = (text) => /whatsapp/i.test(String(text || ''));

export default invitesWhatsApp;
