import { useEffect } from 'react';

const fieldSelector = 'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])';

const resizeTextarea = (textarea) => {
  if (!(textarea instanceof HTMLTextAreaElement)) return;
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
};

const getFields = (field) => {
  const scope = field.form || field.closest('[data-mobile-form-scope]') || field.closest('.mobile-app') || document;
  return [...scope.querySelectorAll(fieldSelector)].filter((item) => item.offsetParent !== null);
};

export const useMobileFormEnhancements = (enabled = true) => {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;

    const syncEnterKeyHint = (field) => {
      if (!(field instanceof HTMLElement)) return;
      const fields = getFields(field);
      const index = fields.indexOf(field);
      const hasNext = index >= 0 && index < fields.length - 1;

      if (field instanceof HTMLTextAreaElement) {
        field.enterKeyHint = field.dataset.enterKeyHint || 'enter';
        return;
      }

      field.enterKeyHint = field.dataset.enterKeyHint || (hasNext ? 'next' : 'done');
    };

    const handleFocusIn = (event) => {
      const field = event.target;
      if (!(field instanceof HTMLElement) || !field.matches(fieldSelector)) return;
      syncEnterKeyHint(field);
      field.closest('[data-mobile-field]')?.classList.remove('mobile-field-has-error');
    };

    const handleInput = (event) => {
      const field = event.target;
      if (field instanceof HTMLTextAreaElement && field.dataset.autogrow !== 'false') {
        resizeTextarea(field);
      }
      if (field instanceof HTMLElement && field.matches(fieldSelector)) {
        field.closest('[data-mobile-field]')?.classList.remove('mobile-field-has-error');
      }
    };

    const handleKeyDown = (event) => {
      const field = event.target;
      if (!(field instanceof HTMLElement) || !field.matches(fieldSelector) || event.key !== 'Enter') return;
      if (field instanceof HTMLTextAreaElement || field.dataset.enterKeyHint === 'enter') return;

      const fields = getFields(field);
      const index = fields.indexOf(field);
      const nextField = fields[index + 1];

      if (nextField) {
        event.preventDefault();
        nextField.focus();
        return;
      }

      field.blur();
    };

    const handleInvalid = (event) => {
      const field = event.target;
      if (!(field instanceof HTMLElement) || !field.matches(fieldSelector)) return;
      field.setAttribute('aria-invalid', 'true');
      field.closest('[data-mobile-field]')?.classList.add('mobile-field-has-error');
      window.setTimeout(() => {
        field.focus({ preventScroll: true });
        field.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 0);
    };

    document.querySelectorAll('.mobile-app textarea').forEach(resizeTextarea);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('input', handleInput);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('invalid', handleInvalid, true);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('input', handleInput);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('invalid', handleInvalid, true);
    };
  }, [enabled]);
};

export default useMobileFormEnhancements;
