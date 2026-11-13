import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Removing a cart line keeps the keyboard somewhere and says what happened.
 *
 * Seventh visitor audit, 13 Nov 2026: "Hapus" removed the button under the focus, focus fell to <body> and
 * nothing was announced. After a removal, focus moves to the next line's name (or the previous one), or to
 * the empty-cart heading when it was the last; a polite status line names what was removed.
 *
 * Lines and headings opt in with data attributes: `data-cart-line-name` on each name link (in order) and
 * `data-cart-empty-heading` (tabIndex -1) on the empty state's heading.
 */
export const useCartLineRemoval = (removeItem, lines = []) => {
  const [removedName, setRemovedName] = useState('');
  const pendingIndex = useRef(null);

  const removeLine = useCallback((slug, name) => {
    pendingIndex.current = lines.findIndex((line) => line.slug === slug);
    setRemovedName(name);
    removeItem(slug);
  }, [lines, removeItem]);

  useEffect(() => {
    if (pendingIndex.current === null) return;
    const index = pendingIndex.current;
    pendingIndex.current = null;
    window.requestAnimationFrame(() => {
      const names = [...document.querySelectorAll('[data-cart-line-name]')];
      const target = names[Math.min(index, names.length - 1)] || document.querySelector('[data-cart-empty-heading]');
      target?.focus();
    });
  }, [lines]);

  return { removeLine, removedName };
};

export default useCartLineRemoval;
