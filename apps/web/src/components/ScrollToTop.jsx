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

// A new page starts where it starts — instantly. The storefront sets `scroll-behavior: smooth` on <html> (for
// "back to top" and in-page links), and that made window.scrollTo ANIMATE here: a tap on a card near the bottom
// of the home page opened the catalogue at the bottom and slid it up over a second. On an iPhone the slide was cut
// short while the page was still loading and the buyer was left halfway down (Dekito, 26 Nov 2026: "pada saat saya
// klik kartu ini dia mengarahnya turun ke bawah"). The smooth setting is lifted for this one jump and put back.
//
// The style has to be READ before the jump: set-and-restore with nothing in between let the browser skip the
// 'auto' entirely (no style recalc happened), and the slide stayed — measured on production, 26 Nov 2026. So the
// override is flushed (getComputedStyle), and the jump also asks for 'instant' itself, which modern browsers honour
// over the stylesheet.
const jumpWindowTo = (top) => {
    const root = document.documentElement;
    const before = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    void window.getComputedStyle(root).scrollBehavior;
    try {
        window.scrollTo({ top, left: 0, behavior: 'instant' });
    } catch {
        window.scrollTo(0, top);
    }
    root.style.scrollBehavior = before;
};

const scrollToTop = (scroller, top) => {
    if (scroller === window) {
        jumpWindowTo(top);
        return;
    }

    scroller.scrollTo({ top, left: 0, behavior: 'auto' });
};

// Back to a page that is still building itself. The home renders its bottle grid a moment after it mounts; the
// position was restored into the short page, then the grid appeared ABOVE it and the browser's scroll anchoring
// carried the buyer 1,800px further down (Back from a product on the home: 2400 -> 4188, measured on production,
// 26 Nov 2026). The saved number is a position in the finished page, so: anchoring off, and every time the page
// grows the target is applied again — for a short while, and never once the buyer touches, scrolls or types.
const SETTLE_MS = 2500;
const keepPositionWhileSettling = (target) => {
    if (!(target > 0) || typeof window.ResizeObserver !== 'function') return () => {};
    const root = document.documentElement;
    const anchorBefore = root.style.overflowAnchor;
    root.style.overflowAnchor = 'none';
    let done = false;
    const stopEvents = ['touchstart', 'wheel', 'keydown', 'pointerdown'];
    const reapply = () => {
        if (done) return;
        const scroller = getActiveScroller();
        if (Math.abs(getScrollTop(scroller) - target) > 2) scrollToTop(scroller, target);
    };
    const observer = new window.ResizeObserver(reapply);
    observer.observe(document.body);
    const shell = document.querySelector('[data-mobile-primary-scroller="true"]');
    if (shell?.firstElementChild) observer.observe(shell.firstElementChild);
    const stop = () => {
        if (done) return;
        done = true;
        observer.disconnect();
        window.clearTimeout(timer);
        stopEvents.forEach((name) => window.removeEventListener(name, stop, true));
        root.style.overflowAnchor = anchorBefore;
    };
    const timer = window.setTimeout(stop, SETTLE_MS);
    stopEvents.forEach((name) => window.addEventListener(name, stop, { capture: true, passive: true }));
    return stop;
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
        let stopSettling = () => {};

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
            stopSettling = keepPositionWhileSettling(explicitPosition);
        } else if (shouldRestore && savedPosition !== null) {
            restoreScrollPosition(Number(savedPosition));
            stopSettling = keepPositionWhileSettling(Number(savedPosition));
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
            stopSettling();
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [navigationType, pathname, state?.restoreScroll, state?.scrollTop, storageKey, storageLockKey]);

    return null;
};

export default ScrollToTop;
