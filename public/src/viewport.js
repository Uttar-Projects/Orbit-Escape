/**
 * viewport.js — mobile layout scale (desktop-like density on phones)
 * Reference width 480px — same visual scale as viewing desktop layout on mobile Chrome.
 */

export const DESIGN_WIDTH  = 480;
export const MOBILE_BREAK  = 520;

export function initViewportScale() {
    const root = document.documentElement;

    function update() {
        const w  = window.innerWidth;
        const vh = window.visualViewport?.height ?? window.innerHeight;

        if (w > MOBILE_BREAK) {
            root.style.setProperty('--app-scale', '1');
            root.style.setProperty('--app-design-w', '100%');
            root.style.setProperty('--app-design-h', `${vh}px`);
            root.classList.remove('mobile-scaled');
            return;
        }

        const scale = w / DESIGN_WIDTH;
        root.style.setProperty('--app-scale', String(scale));
        root.style.setProperty('--app-design-w', `${DESIGN_WIDTH}px`);
        root.style.setProperty('--app-design-h', `${vh / scale}px`);
        root.classList.add('mobile-scaled');
    }

    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
}

/** Layout size used by canvas / game engine (design pixels). */
export function getDesignSize() {
    const mobile = window.innerWidth <= MOBILE_BREAK;
    if (!mobile) {
        return {
            width:  window.innerWidth,
            height: window.innerHeight
        };
    }
    const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-design-h'));
    return {
        width:  DESIGN_WIDTH,
        height: Math.round(h) || window.innerHeight
    };
}
