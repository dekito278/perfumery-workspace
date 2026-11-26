/**
 * What, once focused, opens the phone's on-screen keyboard. Studio's phone screens hide the fixed Simpan bar
 * and the bottom navigation while the keyboard is up, and scroll the field into view.
 *
 * It used to be every `input` (26 Nov 2026): ticking a checkbox — "Pilihan di beranda", "Badge LIMITED",
 * "Foto utama = foto botol" — counted as typing, so on Android (where a tapped checkbox takes focus) the
 * Simpan bar vanished until something else was tapped. A checkbox, radio, file picker or button opens no
 * keyboard.
 */
const NO_KEYBOARD_INPUTS = ['checkbox', 'radio', 'file', 'range', 'color', 'button', 'submit', 'reset', 'image', 'hidden'];

export const KEYBOARD_FOCUS_TARGETS = [
  `input${NO_KEYBOARD_INPUTS.map((type) => `:not([type="${type}"])`).join('')}`,
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[role="combobox"]',
  '[cmdk-input]',
].join(', ');

export default KEYBOARD_FOCUS_TARGETS;
