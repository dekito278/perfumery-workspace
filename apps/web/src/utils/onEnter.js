// Enter in a code field runs that field's own action. Without it, Enter in a field inside the checkout or
// bespoke <form> SUBMITS THE ORDER with the code typed but never applied (found 12 Nov 2026), and in the
// cart, which has no form, it did nothing at all.
export const onEnter = (action) => (event) => {
  if (event.key !== 'Enter' || event.nativeEvent?.isComposing) return;
  event.preventDefault();
  action();
};
