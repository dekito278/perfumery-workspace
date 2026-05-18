export const resetMobileCommerceScroll = () => {
  if (typeof window === 'undefined') return;

  const shell = document.querySelector('[data-mobile-primary-scroller="true"]');
  const scrollTargets = [
    document.scrollingElement,
    document.documentElement,
    document.body,
    shell,
  ].filter((target, index, targets) => target instanceof HTMLElement && targets.indexOf(target) === index);

  scrollTargets.forEach((target) => {
    target.scrollTop = 0;
    target.scrollLeft = 0;
  });

  if (shell instanceof HTMLElement) {
    shell.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
};

export const scheduleMobileCommerceScrollReset = () => {
  if (typeof window === 'undefined') return () => {};

  const frameIds = [];
  const timeoutIds = [];

  resetMobileCommerceScroll();
  const firstFrameId = window.requestAnimationFrame(() => {
    resetMobileCommerceScroll();
    const secondFrameId = window.requestAnimationFrame(resetMobileCommerceScroll);
    frameIds.push(secondFrameId);
    [40, 120, 260, 520].forEach((delay) => {
      timeoutIds.push(window.setTimeout(resetMobileCommerceScroll, delay));
    });
  });
  frameIds.push(firstFrameId);

  return () => {
    frameIds.forEach((id) => window.cancelAnimationFrame(id));
    timeoutIds.forEach((id) => window.clearTimeout(id));
  };
};
