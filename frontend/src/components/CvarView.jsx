import { useMemo } from "react";

import Plot from "./Plot.jsx";
import InfoTip from "./InfoTip.jsx"

function downloadCsv(weights) {
    const rows = ["ticker,weight"];
    for (const [t, w] of Object.entries(weights)) {
        rows.push(`${t},${w.toFixed(6)}`);
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "min_cvar_weights.csv";
    a.click();
    URL.revokeObjectURL(a.href);
}

export default function CvarView({ result, alpha, setAlpha, onRun, loading, hasInputs }) {
    const bar = useMemo(() => {
        if (!result) return { data: [], layout: {} };
        const entries = Object.entries(result.minCvar.weights)
            .filter(([, w]) => Math.abs(w) > 1e-4)
            .sort((a, b) => a[1] - b[1]);
        return {
            data: [
                {
                    x: entries.map(([, w]) => w),
                    y: entries.map(([t]) => t),
                    type: "bar",
                    orientation: "h",
                    marker: { color: "steelblue" },
                    hovertemplate: "%{y}: %{x:.1%}<extra></extra>",
                },
            ],
            layout: {
                xaxis: { title: "Weight", tickformat: ".0%" },
                margin: { l: 70, r: 20, t: 20, b: 40 },
                height: Math.max(220, entries.length * 40 + 80),
            },
        };
    }, [result]);

    const pct = (x) => `${(x * 100).toFixed(1)}%`;
    const shown = result?.minCvar;
    const improvement =
        result && result.maxSharpe.cvar > 1e-9
            ? (1 - result.minCvar.cvar / result.maxSharpe.cvar) * 100
            : null;

    return (
        <div>
            <div className="row">
                <div className="radio-row" role="radiogroup" aria-label="Tail level" style={{ marginBottom: 0 }}>
                    {[
                        [0.95, "Worst 5% of days"],
                        [0.99, "Worst 1% of days"],
                    ].map(([value, label]) => (
                        <label key={value} className="radio">
                            <input
                                type="radio"
                                name="cvar-alpha"
                                checked={alpha === value}
                                onChange={() => setAlpha(value)}
                            />
                            <span>{label}</span>
                        </label>
                    ))}
                </div>

                <button
                    className="primary"
                    onClick={onRun}
                    disabled={loading || !hasInputs}
                >
                    {loading ? "Solving…" : "Minimize tail risk"}
                </button>
                <InfoTip text="Minimizes the average loss on the worst days — the tail risk that volatility-based optimization ignores." />
            </div>

            {!hasInputs && (
                <p className="hint">Select at least two tickers.</p>
            )}

            {hasInputs && !result && !loading && (
                <p className="hint">Pick a tail level and run.</p>
            )}

            {shown && (
                <>
                    <div className="metrics">
                        <div className="metric">
                            <div className="metric-label">CVaR {Math.round(alpha * 100)}%</div>
                            <div className="metric-value">{pct(shown.cvar)}</div>
                        </div>
                        <div className="metric">
                            <div className="metric-label">Return</div>
                            <div className="metric-value">{pct(shown.ret)}</div>
                        </div>
                        <div className="metric">
                            <div className="metric-label">Volatility</div>
                            <div className="metric-value">{pct(shown.vol)}</div>
                        </div>
                        <div className="metric">
                            <div className="metric-label">Sharpe</div>
                            <div className="metric-value">{shown.sharpe.toFixed(2)}</div>
                        </div>
                    </div>

                    {improvement !== null && improvement > 0.5 && (
                        <p className="hint">
                            The max-Sharpe mix would have lost{" "}{pct(result.maxSharpe.cvar)}{" "}on average in the tail — this mix cuts that to{" "}{pct(shown.cvar)}{" "}({improvement.toFixed(0)}% smaller worst-case).
                        </p>
                    )}

                    <Plot data={bar.data} layout={bar.layout} style={{ width: "100%" }} />

                    <table className="weights-table">
                        <thead>
                        <tr>
                            <th>Ticker</th>
                            <th>Weight</th>
                        </tr>
                        </thead>
                        <tbody>
                        {Object.entries(shown.weights)
                            .sort((a, b) => b[1] - a[1])
                            .map(([t, w]) => (
                                <tr key={t}>
                                    <td>{t}</td>
                                    <td>{(w * 100).toFixed(1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <button
                        type="button"
                        className="secondary"
                        onClick={() => downloadCsv(shown.weights)}
                    >
                        Download weights (CSV)
                    </button>

                    <div className="howto">
                        <h3>What you&rsquo;re looking at</h3>
                        <ul>
                            <li>
                                <strong>CVaR:</strong> the average loss on the worst days —
                                worst 5% (or 1%) of daily returns, annualized. Lower means a
                                milder crash, not a calmer everyday ride.
                            </li>
                            <li>
                                <strong>Why not just min-volatility:</strong> volatility
                                punishes upside jumps as much as crashes. CVaR only cares about
                                the left tail — the outcomes you actually fear.
                            </li>
                            <li>
                                <strong>The tradeoff:</strong> the safest tail usually gives up
                                some expected return versus max-Sharpe. That&rsquo;s the price
                                of crash protection, shown honestly in the numbers above.
                            </li>
                            <li>
                                <strong>Keep in mind:</strong> the &ldquo;worst days&rdquo; are
                                the ones already in your data. History is the input, not a
                                promise.
                            </li>
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
}
