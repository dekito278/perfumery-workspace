import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const getMobilePrimaryScroller = () => {
    const shell = document.querySelector('[data-mobile-primary-scroller="true"]');

    if (!(shell instanceof HTMLElement)) {
        return null;
    }

    const { overflowY } = window.getComputedStyle(shell);
    const allowsScrolling = overflowY === 'auto' || overflowY === 'scroll';
    const hasScrollableContent = shell.scrollHeight > shell.clientHeight + 1;

    return allowsScrolling && hasScrollableContent ? shell : null;
};

const getActiveScroller = () => getMobilePrimaryScroller() || window;

const getScrollTop = (scroller) => (
    scroller === window ? window.scrollY : scroller.scrollTop
);

const getMaxScrollableTop = (scroller) => {
    if (scroller === window) {
        return Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight
        ) - window.innerHeight;
    }

    return scroller.scrollHeight - scroller.clientHeight;
};

const scrollToTop = (scroller, top) => {
    if (scroller === window) {
        window.scrollTo(0, top);
        return;
    }

    scroller.scrollTo({ top, left: 0, behavior: 'auto' });
};

const ScrollToTop = () => {
    const location = useLocation();
    const { pathname, search, state } = location;
    const navigationType = useNavigationType();
    const storageKey = `scroll:${pathname}${search}`;
    const storageLockKey = `scroll-lock:${pathname}${search}`;
    const previousPathnameRef = useRef(null);

    useLayoutEffect(() => {
        let activeScroller = getActiveScroller();

        const persistPosition = () => {
            const lockedPosition = sessionStorage.getItem(storageLockKey);
            if (lockedPosition !== null) {
                sessionStorage.setItem(storageKey, lockedPosition);
                return;
            }

            sessionStorage.setItem(storageKey, String(getScrollTop(activeScroller)));
        };

        const handleWindowResize = () => {
            const nextScroller = getActiveScroller();

            if (nextScroller === activeScroller) {
                return;
            }

            activeScroller.removeEventListener('scroll', persistPosition);
            activeScroller = nextScroller;
            activeScroller.addEventListener('scroll', persistPosition, { passive: true });
        };

        activeScroller.addEventListener('scroll', persistPosition, { passive: true });
        window.addEventListener('resize', handleWindowResize, { passive: true });

        return () => {
            persistPosition();
            activeScroller.removeEventListener('scroll', persistPosition);
            window.removeEventListener('resize', handleWindowResize);
        };
    }, [storageKey, storageLockKey]);

    useLayoutEffect(() => {
        const shouldRestore = navigationType === 'POP' || Boolean(state?.restoreScroll);
        const isSamePathNavigation = previousPathnameRef.current === pathname;
        const savedPosition = sessionStorage.getItem(storageKey);
        const explicitPosition = Number(state?.scrollTop);
        const hasExplicitPosition = Number.isFinite(explicitPosition);
        let timeoutId = null;
        let cancelled = false;

        const restoreScrollPosition = (targetPosition, attempt = 0) => {
            if (cancelled) {
                return;
            }

            const activeScroller = getActiveScroller();
            scrollToTop(activeScroller, targetPosition);

            const maxScrollableTop = getMaxScrollableTop(activeScroller);
            const currentPosition = getScrollTop(activeScroller);

            if (
                attempt >= 10
                || targetPosition <= 0
                || maxScrollableTop >= targetPosition
                || Math.abs(currentPosition - targetPosition) <= 2
            ) {
                return;
            }

            timeoutId = window.setTimeout(() => {
                restoreScrollPosition(targetPosition, attempt + 1);
            }, 140);
        };

        if (shouldRestore && hasExplicitPosition) {
            restoreScrollPosition(explicitPosition);
        } else if (shouldRestore && savedPosition !== null) {
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
            scrollToTop(getActiveScroller(), 0);
        }

        previousPathnameRef.current = pathname;
        sessionStorage.removeItem(storageLockKey);

        return () => {
            cancelled = true;
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [navigationType, pathname, state?.restoreScroll, state?.scrollTop, storageKey, storageLockKey]);

    return null;
};

export default ScrollToTop;
