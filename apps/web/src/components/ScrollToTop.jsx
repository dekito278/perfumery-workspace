import { useLocation, useNavigationType } from 'react-router-dom';
import { useLayoutEffect } from 'react';

const ScrollToTop = () => {
    const { pathname, search } = useLocation();
    const navigationType = useNavigationType();
    const storageKey = `scroll:${pathname}${search}`;

    useLayoutEffect(() => {
        const handleScroll = () => {
            sessionStorage.setItem(storageKey, String(window.scrollY));
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            handleScroll();
            window.removeEventListener('scroll', handleScroll);
        };
    }, [storageKey]);

    useLayoutEffect(() => {
        const savedPosition = sessionStorage.getItem(storageKey);

        if (navigationType === 'POP' && savedPosition !== null) {
            window.scrollTo({ top: Number(savedPosition), left: 0, behavior: 'instant' });
            return;
        }

        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, [navigationType, storageKey]);

    return null;
}

export default ScrollToTop;
