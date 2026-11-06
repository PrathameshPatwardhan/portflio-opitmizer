import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const STEPS_BASE = [
    {
        target: "intro",
        title: "Welcome to Portfolio Optimizer",
        body: "This short tour walks you through the app — from picking stocks to reading your results. You can skip it any time.",
    },
    {
        target: "panel",
        title: "Pick your stocks",
        body: "Choose two or more stocks from the dropdown, or add any custom stock. History, risk-free rate, and max weight per asset live here too.",
    },
    {
        target: "run",
        title: "Run the optimization",
        body: "One click computes the efficient frontier and the max-Sharpe portfolio. The first run can take a few seconds while the servers wake up.",
    },
    {
        target: "results",
        tab: "frontier",
        title: "Frontier: the big picture",
        body: "The efficient frontier chart plus the max-Sharpe portfolio — its return, volatility, and Sharpe ratio.",
    },
    {
        target: "results",
        tab: "portfolio",
        title: "Portfolio: weights into dollars",
        body: "Per-asset weights, plus 'Invest this portfolio' — enter an amount and see whole and fractional shares side by side.",
    },
    {
        target: "results",
        tab: "rebalance",
        title: "Rebalance: stay on target",
        body: "See how a portfolio drifts over time and what trades bring it back — quarterly or monthly.",
    },
    {
        target: "results",
        tab: "tailrisk",
        title: "Tail Risk: the bad days",
        body: "CVaR — the average loss on the worst days — so you see the downside, not just the average.",
    },
    {
        target: "results",
        tab: "glossary",
        title: "Glossary: no jargon left behind",
        body: "Plain-English definitions for Sharpe, frontier, CVaR, and the rest — tap any term to expand it.",
    },
];

const LOGGED_IN_LAST_STEP = {
    target: "tab-dashboard",
    title: "Dashboard: your real holdings",
    body: "Add holdings with buy prices and compare them against the max-Sharpe target — drift, P&L, and suggested trades. Saved portfolios live under the Saved tab.",
};

const LOGGED_OUT_LAST_STEP = {
    target: "login",
    title: "Log in for more",
    body: "Saving portfolios and tracking real holdings on the Dashboard need an account — but optimization itself stays open to everyone.",
};

/** The first-visit "Want a tour?" prompt. */
export function TourPrompt({ onYes, onNo }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") onNo(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onNo]);

    return (
        <div className="tour-overlay" role="dialog" aria-modal="true" aria-label="Website tour">
            <div className="tour-prompt">
                <h2>New here?</h2>
                <p>Want a quick tour of the website?</p>
                <div className="tour-actions">
                    <button type="button" className="primary" onClick={onYes}>
                        Yes, show me around
                    </button>
                    <button type="button" className="secondary" onClick={onNo}>
                        No thanks
                    </button>
                </div>
            </div>
        </div>
    );
}

const CARD_GAP = 12;
const VIEW_MARGIN = 16;
const MOBILE_BREAKPOINT = 640;

function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
}

/** The step-by-step tour. Card anchors to the highlighted target; Escape skips. */
export default function Tour({ user, setTab, onClose }) {
    const steps = useMemo(
        () => [...STEPS_BASE, user ? LOGGED_IN_LAST_STEP : LOGGED_OUT_LAST_STEP],
        [user]
    );
    const [index, setIndex] = useState(0);
    const step = steps[index];
    const last = index === steps.length - 1;
    const cardRef = useRef(null);
    // { style, side, arrow } — style is the card's inline position, side is which
    // edge the arrow sits on ("bottom" = card below target, etc.), arrow is the
    // target-center offset along that edge. null = let CSS place the card
    // (mobile bottom sheet, or the top-docked card on results steps).
    const [place, setPlace] = useState(null);

    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    useLayoutEffect(() => {
        if (step.tab) setTab(step.tab);
        const el = document.querySelector(`[data-tour="${step.target}"]`);
        if (!el) {
            // Target not on the page: fall back to a centered bottom card.
            setPlace({
                style: { left: "50%", bottom: 24, top: "auto", transform: "translateX(-50%)" },
                side: null,
                arrow: null,
            });
            return undefined;
        }
        el.classList.add("tour-highlight");
        // Narrow results steps ("tabs tour", frontier -> glossary): the last
        // fix scrolled the tab bar to the top, but that alone was not enough
        // — the bar stayed UNDER the tour overlay's dim layer (z-50) while
        // only the results panel is lifted above it (z-51), so on a phone the
        // tabs still read as invisible. So for these steps only: dock the
        // card at the TOP (see .tour-card--top), lift the tab bar above the
        // overlay with the same ring as the panel, and scroll the bar to sit
        // just below the card via scroll-padding. Other steps keep the bottom
        // sheet, and desktop behavior is untouched.
        const narrow = window.innerWidth <= MOBILE_BREAKPOINT;
        const tabsEl = document.querySelector('[data-tour="tabs"]');
        const tabsStep = narrow && step.tab && tabsEl;
        if (tabsStep) {
            tabsEl.classList.add("tour-tabs-visible");
            cardRef.current?.classList.add("tour-card--top");
        }
        const scrollEl = tabsStep ? tabsEl : el;
        const scrollInto = () => {
            if (tabsStep) {
                const ch = cardRef.current ? cardRef.current.offsetHeight : 220;
                document.documentElement.style.scrollPaddingTop = `${ch + 16}px`;
            }
            scrollEl.scrollIntoView({
                behavior: tabsStep ? "auto" : "smooth",
                block: narrow ? "start" : "center",
            });
        };
        scrollInto();

        const measure = () => {
            // Narrow screens: no anchoring, CSS takes over (bottom sheet, or
            // the top-docked card on results steps).
            if (window.innerWidth <= MOBILE_BREAKPOINT) {
                setPlace(null);
                return;
            }
            // Back on desktop widths: drop the phone-only top dock and padding.
            cardRef.current?.classList.remove("tour-card--top");
            document.documentElement.style.scrollPaddingTop = "";
            const rect = el.getBoundingClientRect();
            const card = cardRef.current;
            const cw = card ? card.offsetWidth : 380;
            const ch = card ? card.offsetHeight : 280;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            let next;
            if (rect.bottom + CARD_GAP + ch + VIEW_MARGIN <= vh) {
                // Below the target.
                const left = clamp(rect.left + rect.width / 2 - cw / 2, VIEW_MARGIN, vw - cw - VIEW_MARGIN);
                next = {
                    style: { top: rect.bottom + CARD_GAP, left },
                    side: "bottom",
                    arrow: clamp(rect.left + rect.width / 2 - left, 20, cw - 20),
                };
            } else if (rect.top - CARD_GAP - ch - VIEW_MARGIN >= 0) {
                // Above the target.
                const left = clamp(rect.left + rect.width / 2 - cw / 2, VIEW_MARGIN, vw - cw - VIEW_MARGIN);
                next = {
                    style: { top: rect.top - CARD_GAP - ch, left },
                    side: "top",
                    arrow: clamp(rect.left + rect.width / 2 - left, 20, cw - 20),
                };
            } else if (rect.right + CARD_GAP + cw + VIEW_MARGIN <= vw) {
                // Right of the target.
                const top = clamp(rect.top + rect.height / 2 - ch / 2, VIEW_MARGIN, vh - ch - VIEW_MARGIN);
                next = {
                    style: { top, left: rect.right + CARD_GAP },
                    side: "right",
                    arrow: clamp(rect.top + rect.height / 2 - top, 20, ch - 20),
                };
            } else if (rect.left - CARD_GAP - cw - VIEW_MARGIN >= 0) {
                // Left of the target.
                const top = clamp(rect.top + rect.height / 2 - ch / 2, VIEW_MARGIN, vh - ch - VIEW_MARGIN);
                next = {
                    style: { top, left: rect.left - CARD_GAP - cw },
                    side: "left",
                    arrow: clamp(rect.top + rect.height / 2 - top, 20, ch - 20),
                };
            } else {
                // Target too big for any side: full-width bottom sheet.
                next = {
                    style: { left: VIEW_MARGIN, right: VIEW_MARGIN, bottom: VIEW_MARGIN, top: "auto", width: "auto" },
                    side: null,
                    arrow: null,
                };
            }
            setPlace((prev) => {
                const same =
                    prev &&
                    prev.side === next.side &&
                    prev.arrow === next.arrow &&
                    prev.style.top === next.style.top &&
                    prev.style.left === next.style.left &&
                    prev.style.bottom === next.style.bottom &&
                    prev.style.right === next.style.right &&
                    prev.style.width === next.style.width &&
                    prev.style.transform === next.style.transform;
                return same ? prev : next;
            });
        };

        const raf = requestAnimationFrame(measure);
        const onResize = () => {
            measure();
            if (tabsStep) scrollInto();
        };
        window.addEventListener("resize", onResize);
        // Capture phase catches scrolls inside any scroll container, and
        // re-measuring during the smooth scrollIntoView keeps the card glued
        // to the target until it settles.
        window.addEventListener("scroll", measure, { capture: true, passive: true });
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", onResize);
            window.removeEventListener("scroll", measure, { capture: true });
            el.classList.remove("tour-highlight");
            tabsEl?.classList.remove("tour-tabs-visible");
            cardRef.current?.classList.remove("tour-card--top");
            document.documentElement.style.scrollPaddingTop = "";
        };
    }, [step, setTab]);

    return (
        <>
            <div className="tour-overlay tour-stepper-overlay" aria-hidden="true" />
            <div ref={cardRef} className="tour-card" role="dialog" aria-modal="true" aria-label="Website tour" style={place?.style}>
                {place?.side && (
                    <span
                        aria-hidden="true"
                        className={`tour-arrow tour-arrow-${place.side}`}
                        style={
                            place.side === "left" || place.side === "right"
                                ? { top: place.arrow - 7 }
                                : { left: place.arrow - 7 }
                        }
                    />
                )}
                <p className="tour-progress">Step {index + 1} of {steps.length}</p>
                <h2>{step.title}</h2>
                <p>{step.body}</p>
                <div className="tour-actions">
                    <button type="button" className="secondary" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
                        Back
                    </button>
                    <button type="button" className="secondary" onClick={onClose}>
                        Skip tour
                    </button>
                    {last ? (
                        <button type="button" className="primary" onClick={onClose}>
                            Finish
                        </button>
                    ) : (
                        <button type="button" className="primary" onClick={() => setIndex((i) => i + 1)}>
                            Next
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}
