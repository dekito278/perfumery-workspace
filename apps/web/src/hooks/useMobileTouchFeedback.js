import { useEffect } from 'react';

const isAndroidDevice = () => (
  typeof navigator !== 'undefined'
  && /Android/i.test(navigator.userAgent || '')
);

const canVibrate = () => (
  typeof navigator !== 'undefined'
  && typeof navigator.vibrate === 'function'
);

const hasActiveUserGesture = () => {
  if (typeof navigator === 'undefined' || !navigator.userActivation) return true;
  return navigator.userActivation.isActive === true;
};

const vibrate = (pattern) => {
  if (!isAndroidDevice() || !canVibrate()) return;
  if (!hasActiveUserGesture()) return;

  try {
    navigator.vibrate(pattern);
  } catch {
    // Some embedded/devtool mobile frames expose vibrate but reject it before a real tap.
  }
};

export const triggerMobileHaptic = (tone = 'light') => {
  if (tone === 'success') vibrate([10, 28, 14]);
  else if (tone === 'warning') vibrate([18, 24, 18]);
  else if (tone === 'medium') vibrate(14);
  else vibrate(8);
};

const resolveTone = (target) => {
  if (!target) return '';
  if (target.closest('[data-haptic="none"]')) return '';
  if (target.closest('[data-haptic="success"], .mobile-success-action')) return 'success';
  if (target.closest('[data-haptic="warning"], .mobile-delete-action')) return 'warning';
  if (target.closest('[data-haptic="medium"], .mobile-add-action')) return 'medium';
  if (target.closest('[data-haptic="light"], .mobile-pressable, .mobile-bottom-nav a, .mobile-bottom-nav button')) return 'light';
  return '';
};

export const useMobileTouchFeedback = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handlePointerDown = (event) => {
      if (event.pointerType && event.pointerType !== 'touch') return;
      const tone = resolveTone(event.target);
      if (tone) triggerMobileHaptic(tone);
    };

    document.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);
};
