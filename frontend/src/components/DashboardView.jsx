import { useEffect, useState } from "react";
import {
    listHoldings,
    saveHolding,
    deleteHolding,
    analyzeHoldings,
    validateUniverseTicker,
} from "../api.js";
import InfoTip from "./InfoTip.jsx"

const REGIONS = [
    ["US", "USA"],
    ["IN", "India"],
];

function money(n, symbol) {
    const v = Number(n);
    if (!isFinite(v)) return `${symbol}0.00`;
    return `${symbol}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DashboardView({ optResult }) {
    const [holdings, setHoldings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [ticker, setTicker] = useState("");
    const [shares, setShares] = useState("");
    const [avgPrice, setAvgPrice] = useState("");
    const [saving, setSaving] = useState(false);
    const [region, setRegion] = useState("US");
    const [analysis, setAnalysis] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);

    async function refresh() {
        setLoading(true);
        try {
            const r = await listHoldings();
            setHoldings(r.holdings || []);
            setError("");
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
    }, []);

    async function addHolding(e) {
        e.preventDefault();
        const t = ticker.trim().toUpperCase();
        const s = Number(shares);
        const p = Number(avgPrice);
        if (!t || !(s > 0) || !(p > 0)) {
            setError("Enter a ticker, share count and average buy price.");
            return;
        }
        setSaving(true);
        try {
            const v = await validateUniverseTicker(t);
            if (v.status === "invalid") {
                setError(v.message || `No market data for ${t}.`);
                return;
            }
            await saveHolding(t, s, p);
            setTicker("");
            setShares("");
            setAvgPrice("");
            setAnalysis(null);
            setError("");
            await refresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function removeHolding(id) {
        try {
            await deleteHolding(id);
            setAnalysis(null);
            await refresh();
        } catch (e) {
            setError(e.message);
        }
    }

    async function runAnalysis() {
        if (!optResult) return;
        setAnalyzing(true);
        try {
            const targetWeights = optResult.maxSharpe.weights;
            const body = holdings.map((h) => ({
                ticker: h.ticker,
                shares: Number(h.shares),
                avg_price: Number(h.avg_price),
            }));
            setAnalysis(await analyzeHoldings(body, targetWeights, region));
            setError("");
        } catch (e) {
            setError(e.message);
        } finally {
            setAnalyzing(false);
        }
    }

    if (loading) return <p className="hint">Loading your holdings…</p>;

    return (
        <div>
            <h3 style={{ marginTop: 0 }}>
                My holdings{" "}
                <InfoTip text="Your real-world positions, saved to your account. Analysis compares them against the Max Sharpe mix from your latest optimization." />
            </h3>

            {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}

            <form onSubmit={addHolding} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", marginBottom: 16 }}>
                <label className="field" style={{ margin: 0 }}>
                    <span>Ticker</span>
                    <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="AAPL" style={{ width: 110 }} />
                </label>
                <label className="field" style={{ margin: 0 }}>
                    <span>Shares</span>
                    <input type="number" min="0" step="any" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="10" style={{ width: 110 }} />
                </label>
                <label className="field" style={{ margin: 0 }}>
                    <span>Avg buy price</span>
                    <input type="number" min="0" step="any" value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)} placeholder="150.00" style={{ width: 130 }} />
                </label>
                <button type="submit" className="secondary" disabled={saving}>
                    {saving ? "Saving…" : "Add holding"}
                </button>
            </form>

            {holdings.length === 0 ? (
                <p className="hint">No holdings yet — add your first one above.</p>
            ) : (
                <table className="weights-table stack-table">
                <thead>
                <tr><th>Ticker</th><th>Shares</th><th>Avg price</th><th></th></tr>
                </thead>
                <tbody>
                    {holdings.map((h) => (
                        <tr key={h.id}>
                            <td data-label="Ticker">{h.ticker}</td>
                            <td data-label="Shares">{Number(h.shares).toLocaleString()}</td>
                            <td data-label="Avg price">{money(h.avg_price, region === "IN" ? "₹" : "$")}</td>
                            <td>
                                <button type="button" className="secondary" style={{ padding: "4px 10px" }} onClick={() => removeHolding(h.id)}>
                                    Remove
                                </button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}

            {holdings.length > 0 && (
                <div style={{ marginTop: 20 }}>
                    <div className="radio-row" role="radiogroup" aria-label="Region">
                        {REGIONS.map(([key, label]) => (
                            <label key={key} className="radio">
                                <input type="radio" name="region" checked={region === key} onChange={() => { setRegion(key); setAnalysis(null); }} />
                                <span>{label}</span>
                            </label>
                        ))}
                    </div>
                    {!optResult ? (
                        <p className="hint">Run an optimization first — the dashboard needs the Max Sharpe mix.</p>
                    ) : (
                        <button type="button" className="secondary" onClick={runAnalysis} disabled={analyzing}>
                            {analyzing ? "Analyzing…" : "Analyze my holdings"}
                        </button>
                    )}
                </div>
            )}

            {analysis && (
                <div style={{ marginTop: 20 }}>
                    <div className="metrics">
                        <div className="metric">
                            <div className="metric-label">Total value</div>
                            <div className="metric-value">{money(analysis.totalValue, analysis.symbol)}</div>
                        </div>
                        <div className="metric">
                            <div className="metric-label">Total gain/loss</div>
                            <div className="metric-value" style={{ color: analysis.totalPnl >= 0 ? "var(--ink)" : "#b91c1c" }}>
                                {money(analysis.totalPnl, analysis.symbol)}{" "}({analysis.totalPnlPct.toFixed(1)}%)
                            </div>
                        </div>
                        <div className="metric">
                            <div className="metric-label">Max drift from target</div>
                            <div className="metric-value">{(analysis.maxDrift * 100).toFixed(1)}%</div>
                        </div>
                        <div className="metric">
                            <div className="metric-label">Est. rebalance cost</div>
                            <div className="metric-value">{money(analysis.estimatedCost, analysis.symbol)}</div>
                        </div>
                    </div>

                    <div style={{ marginTop: 4, borderLeft: "3px solid var(--accent)", paddingLeft: 12 }}>
                        <strong>Verdict: </strong>{analysis.verdict}{" "}
                        <InfoTip text={`${analysis.costAssumption}. Drift threshold: ${(analysis.driftThreshold * 100).toFixed(0)} pp.`} />
                    </div>

                    <h3>Per-asset performance</h3>
                    <table className="weights-table stack-table">
                        <thead>
                        <tr><th>Ticker</th><th>Value</th><th>Gain/loss</th><th>Now</th><th>Target</th><th>Drift</th></tr>
                        </thead>
                        <tbody>
                        {analysis.items.map((it) => (
                            <tr key={it.ticker}>
                                <td data-label="Ticker">{it.ticker}</td>
                                <td data-label="Value">{money(it.value, analysis.symbol)}</td>
                                <td data-label="Gain/loss">{money(it.pnl, analysis.symbol)}{" "}({it.pnlPct.toFixed(1)}%)</td>
                                <td data-label="Now">{(it.currentWeight * 100).toFixed(1)}%</td>
                                <td data-label="Target">{(it.targetWeight * 100).toFixed(1)}%</td>
                                <td data-label="Drift">{it.drift >= 0 ? "+" : ""}{(it.drift * 100).toFixed(1)} pp</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>

                    {analysis.trades.length > 0 && (
                        <>
                            <h3>Rebalance trades</h3>
                            <table className="weights-table stack-table">
                                <thead>
                                <tr><th></th><th>Ticker</th><th>Shares</th><th>Value</th></tr>
                                </thead>
                                <tbody>
                                {analysis.trades.map((t) => (
                                    <tr key={t.ticker}>
                                        <td data-label="Action">{t.side}</td>
                                        <td data-label="Ticker">{t.ticker}</td>
                                        <td data-label="Shares">{t.deltaShares.toLocaleString()}</td>
                                        <td data-label="Value">{money(t.deltaValue, analysis.symbol)}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
