import React, { useEffect, useState } from 'react';
import { normalizeLocalizedDecimalInput, parseLocalizedNumber } from '@/utils/numberInputs.js';

// <input type="number"> is the wrong control for Indonesian money entry. The browser reads "." as a
// decimal point, so "150.000" is a perfectly valid 150 to it: no warning, the typed text stays on screen,
// and the handler is handed 150. "1.500.000" is worse — the second dot is dropped, leaving 1.5.
//
// This keeps the typed text in its own state and reports the parsed number, so the digits on screen and
// the value stored always mean the same thing. The parent keeps holding a number; only the display is a
// string, which is what lets a half-typed "150." survive long enough to become "150.000".
const LocalizedNumberInput = ({ as: Field = 'input', value, onChange, ...props }) => {
  const asText = (input) => (input === '' || input === null || input === undefined ? '' : String(input));
  const [text, setText] = useState(() => asText(value));

  // Resync only when the number underneath actually changed — a form load or reset. Rewriting the text
  // whenever it merely parses to the same number would erase a trailing "." or "0" as it is typed.
  useEffect(() => {
    const shown = text === '' ? Number.NaN : parseLocalizedNumber(text, Number.NaN);
    const incoming = value === '' || value === null || value === undefined ? Number.NaN : Number(value);
    if (!Object.is(shown, incoming)) {
      setText(asText(value));
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps -- text is the thing being resynced, not a trigger

  return (
    <Field
      {...props}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(event) => {
        const next = normalizeLocalizedDecimalInput(event.target.value);
        setText(next);
        onChange(next === '' ? '' : parseLocalizedNumber(next, 0));
      }}
    />
  );
};

export default LocalizedNumberInput;
