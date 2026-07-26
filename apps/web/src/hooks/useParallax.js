import { useCallback, useEffect, useRef } from 'react';

/**
 * Shared pointer-driven micro-interaction handlers.
 * - magnetic: moves a radial glow toward the cursor (pair with `.magnetic-hover`)
 * - tilt/resetTilt: 3D card tilt toward the cursor (pair with `.card-tilt`)
 */
export function useMicroInteractions({ tiltStrength = 6 } = {}) {
  const magnetic = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty('--mouse-x', `${x}%`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}%`);
  }, []);

  const tilt = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    e.currentTarget.style.transform = `perspective(800px) rotateY(${x * tiltStrength}deg) rotateX(${-y * tiltStrength}deg) translateY(-4px)`;
  }, [tiltStrength]);

  const resetTilt = useCallback((e) => {
    e.currentTarget.style.transform = '';
  }, []);

  return { magnetic, tilt, resetTilt };
}

export function useScrollProgress() {
  const ref = useRef(null);

  useEffect(() => {
    const bar = ref.current;
    if (!bar) return;

    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? scrollTop / docHeight : 0;
      bar.style.transform = `scaleX(${progress})`;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return ref;
}
