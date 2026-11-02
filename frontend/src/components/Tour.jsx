import { useEffect, useMemo, useState } from "react";

const STEPS_BASE = [
    {
        target: "intro",
        title: "Welcome to Portfolio Optimizer",
        body: "This app finds the mix of stocks with the best return for its risk, from real market prices — then turns it into dollars, a tail-risk check, and a holdings dashboard.",
    },
    {
        target: "panel",
        title: "Pick your tickers",
        body: "Choose two or more tickers from the dropdown, or add any custom ticker. History, risk-free rate, and max weight per asset live here too.",
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
        body: "Per-asset weights, plus 'Turn this into real money' — enter an amount and see whole and fractional shares side by side.",
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

/** The step-by-step tour. Switches tabs as it goes; Escape skips. */
export default function Tour({ user, setTab, onClose }) {
    const steps = useMemo(
        () => [...STEPS_BASE, user ? LOGGED_IN_LAST_STEP : LOGGED_OUT_LAST_STEP],
        [user]
    );
    const [index, setIndex] = useState(0);
    const step = steps[index];
    const last = index === steps.length - 1;

    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    useEffect(() => {
        if (step.tab) setTab(step.tab);
        const el = document.querySelector(`[data-tour="${step.target}"]`);
        if (!el) return undefined;
        el.classList.add("tour-highlight");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return () => el.classList.remove("tour-highlight");
    }, [step, setTab]);

    return (
        <div className="tour-overlay tour-stepper-overlay" role="dialog" aria-modal="true" aria-label="Website tour">
            <div className="tour-card">
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
        </div>
    );
}
