import { useState } from "react";

export default function InputsPanel({ inputs, setInputs, onRun, loading, universeData }) {
    const set = (key) => (e) => {
        const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        setInputs({ ...inputs, [key]: v });
    };

    const [tickersOpen, setTickersOpen] = useState(false);
    const companies = universeData?.companies || [];
    const selected = Array.isArray(inputs.tickers) ? inputs.tickers : [];

    const toggleTicker = (ticker) => {
        setInputs({
            ...inputs,
            tickers: selected.includes(ticker)
                ? selected.filter((t) => t !== ticker)
                : [...selected, ticker],
        });
    };

    return (
        <aside className="panel">
            <h2>Inputs</h2>

            <label className="field">
                <span>Tickers</span>
                <div style={{ position: "relative" }}>
                    <button
                        type="button"
                        onClick={() => setTickersOpen((o) => !o)}
                        style={{
                            width: "100%", textAlign: "left", padding: "8px 10px",
                            border: "1px solid #cbd5e1", borderRadius: "6px",
                            background: "#fff", cursor: "pointer", fontSize: "14px",
                        }}
                    >
                        {selected.length === 0 ? "Select tickers…" : selected.join(", ")}
                    </button>
                    {tickersOpen && (
                        <>
                            <div
                                style={{ position: "fixed", inset: 0, zIndex: 5 }}
                                onClick={() => setTickersOpen(false)}
                            />
                            <div
                                style={{
                                    position: "absolute", zIndex: 10, left: 0, right: 0,
                                    maxHeight: "260px", overflowY: "auto", background: "#fff",
                                    border: "1px solid #cbd5e1", borderRadius: "6px",
                                    marginTop: "4px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                                }}
                            >
                                {companies.map((c) => (
                                    <label
                                        key={c.ticker}
                                        style={{
                                            display: "flex", gap: "8px", padding: "7px 10px",
                                            cursor: "pointer", alignItems: "center", fontSize: "14px",
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected.includes(c.ticker)}
                                            onChange={() => toggleTicker(c.ticker)}
                                        />
                                        <span>
                                            <strong>{c.ticker}</strong>
                                            <span className="muted"> · {c.name}</span>
                                            {c.rows > 0 && (
                                                <span className="muted"> · {c.rows.toLocaleString()} rows</span>
                                            )}
                                        </span>
                                    </label>
                                ))}
                                {companies.length === 0 && (
                                    <div className="muted" style={{ padding: "8px 10px" }}>
                                        Loading tickers…
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
                {universeData?.source && (
                    <span className="muted" style={{ fontSize: "12px", marginTop: "4px" }}>
                        List via {universeData.source === "yahoo" ? "Yahoo Finance" : "MySQL fallback"}
                    </span>
                )}
            </label>

            <label className="field">
                <span>History</span>
                <select value={inputs.period} onChange={set("period")}>
                    <option value="1y">1 year</option>
                    <option value="2y">2 years</option>
                    <option value="5y">5 years</option>
                    <option value="10y">10 years</option>
                    <option value="max">Max</option>
                </select>
            </label>

            <label className="field">
                <span>Data source</span>
                <select value={inputs.source} onChange={set("source")}>
                    <option value="auto">Auto (MySQL when fresh, else live)</option>
                    <option value="mysql">MySQL only</option>
                    <option value="live">Live prices only</option>
                </select>
            </label>

            <label className="field">
                <span>Risk-free rate (%)</span>
                <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.25"
                    value={inputs.riskFreeRate}
                    onChange={set("riskFreeRate")}
                />
            </label>

            <label className="check">
                <input
                    type="checkbox"
                    checked={inputs.longOnly}
                    onChange={set("longOnly")}
                />
                <span>Long only</span>
            </label>

            <label className="field">
                <span>Max weight per asset: {inputs.maxWeight}%</span>
                <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={inputs.maxWeight}
                    onChange={(e) =>
                        setInputs({ ...inputs, maxWeight: Number(e.target.value) })
                    }
                />
            </label>

            <button className="primary" onClick={onRun} disabled={loading}>
                {loading ? "Optimizing…" : "Run optimization"}
            </button>
        </aside>
    );
}
