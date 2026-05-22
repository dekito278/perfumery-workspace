import { useLocation, useNavigate } from 'react-router-dom';

export const getMobileScrollTop = () => (
  typeof window === 'undefined'
    ? 0
    : window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
);

export const getMobileFromState = (location, scrollTop = getMobileScrollTop()) => {
  const from = `${location.pathname}${location.search}${location.hash}`;
  const safeScrollTop = Number.isFinite(Number(scrollTop)) ? Number(scrollTop) : 0;

  if (typeof window !== 'undefined' && from.startsWith('/mobile/')) {
    window.sessionStorage.setItem(`scroll:${from}`, String(safeScrollTop));
    window.sessionStorage.setItem(`scroll-lock:${from}`, String(safeScrollTop));
  }

  return {
    from,
    fromScrollTop: safeScrollTop,
  };
};

export const useMobileBackNavigation = (fallback) => {
  const location = useLocation();
  const navigate = useNavigate();

  return () => {
    const hasMobileOrigin = typeof location.state?.from === 'string' && location.state.from.startsWith('/mobile/');

    if (hasMobileOrigin) {
      const scrollTop = Number(location.state?.fromScrollTop);
      navigate(location.state.from, {
        replace: true,
        state: {
          restoreScroll: true,
          scrollTop: Number.isFinite(scrollTop) ? scrollTop : 0,
        },
      });
      return;
    }

    navigate(fallback, { replace: true, state: { restoreScroll: true } });
  };
};
