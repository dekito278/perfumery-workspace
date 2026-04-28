import { useLocation, useNavigationType } from 'react-router-dom';
import { useLayoutEffect, useRef } from 'react';

const ScrollToTop = () => {
    const location = useLocation();
    const { pathname, search, state } = location;
    const navigationType = useNavigationType();
    const storageKey = `scroll:${pathname}${search}`;
    const previousPathnameRef = useRef(null);

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
        const shouldRestore = navigationType === 'POP' || Boolean(state?.restoreScroll);
        const isSamePathNavigation = previousPathnameRef.current === pathname;
        const savedPosition = sessionStorage.getItem(storageKey);
        let timeoutId = null;
        let cancelled = false;

        const restoreScrollPosition = (targetPosition, attempt = 0) => {
            if (cancelled) {
                return;
            }

            window.scrollTo(0, targetPosition);

            const maxScrollableTop = Math.max(
                document.documentElement.scrollHeight,
                document.body.scrollHeight
            ) - window.innerHeight;

            if (
                attempt >= 10
                || targetPosition <= 0
                || maxScrollableTop >= targetPosition
                || Math.abs(window.scrollY - targetPosition) <= 2
            ) {
                return;
            }

            timeoutId = window.setTimeout(() => {
                restoreScrollPosition(targetPosition, attempt + 1);
            }, 140);
        }

        if (shouldRestore && savedPosition !== null) {
            restoreScrollPosition(Number(savedPosition));
        } else if (isSamePathNavigation) {
            previousPathnameRef.current = pathname;
            return () => {
                cancelled = true;
                if (timeoutId) {
                    window.clearTimeout(timeoutId);
                }
            };
        } else {
            window.scrollTo(0, 0);
        }

        previousPathnameRef.current = pathname;

        return () => {
            cancelled = true;
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [navigationType, state?.restoreScroll, storageKey]);

    return null;
}

export default ScrollToTop;
