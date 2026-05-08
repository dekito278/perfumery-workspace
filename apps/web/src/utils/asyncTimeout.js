export const runWithTimeout = (promise, fallbackValue, timeoutMs = 7000) => Promise.race([
  promise,
  new Promise((resolve) => {
    window.setTimeout(() => resolve(fallbackValue), timeoutMs);
  }),
]);
