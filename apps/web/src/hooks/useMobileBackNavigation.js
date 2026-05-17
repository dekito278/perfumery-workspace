import { useLocation, useNavigate } from 'react-router-dom';

export const getMobileFromState = (location) => ({
  from: `${location.pathname}${location.search}${location.hash}`,
});

export const useMobileBackNavigation = (fallback) => {
  const location = useLocation();
  const navigate = useNavigate();

  return () => {
    const target = typeof location.state?.from === 'string' && location.state.from.startsWith('/mobile/')
      ? location.state.from
      : fallback;

    navigate(target, { state: { restoreScroll: true } });
  };
};
