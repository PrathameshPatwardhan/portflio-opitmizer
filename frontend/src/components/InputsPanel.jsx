import { useEffect, useState } from "react";
import { validateUniverseTicker, addUniverseTicker } from "../api.js";

export default function InputsPanel({ inputs, setInputs, onRun, loading, universeData, onSearchUniverse }) {
    const set = (key) => (e) => {
        const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        setInputs({ ...inputs, [key]: v });
    };

    const [tickerQuery, setTickerQuery] = useState("");
    const [tickersOpen, setTickersOpen] = useState(false);
    const [customTicker, setCustomTicker] = useState("");
    const [customTickers, setCustomTickers] = useState([]);
    const [customError, setCustomError] = useState("");
    const [validating, setValidating] = useState(false);
    const companies = universeData?.companies || [];
    const selected = Array.isArray(inputs.tickers) ? inputs.tickers : [];

    useEffect(() => {
        const q = tickerQuery.trim();
        const t = setTimeout(() => onSearchUniverse(q || undefined), q ? 250 : 0);
        return () => clearTimeout(t);
    }, [tickerQuery, onSearchUniverse]);

    const toggleTicker = (ticker) => {
        setInputs({
            ...inputs,
            tickers: selected.includes(ticker)
                ? selected.filter((t) => t !== ticker)
                : [...selected, ticker],
        });
    };

    const addCustomTicker = async () => {
        const t = customTicker.trim().toUpperCase();
        if (!t || selected.includes(t)) {
            setCustomTicker("");
            return;
        }
        setCustomError("");
        setValidating(true);
        try {
            const v = await validateUniverseTicker(t);
            if (v.status === "invalid") {
                setCustomError(v.message || `No market data for ${t} on Yahoo Finance.`);
                return;
            }
            setInputs({ ...inputs, tickers: [...selected, t] });
            setCustomTickers([...customTickers, t]);
            setCustomTicker("");
            addUniverseTicker(t, v.name)
                .then(() => onSearchUniverse(tickerQuery.trim() || undefined))
                .catch(() => {});
        } catch (e) {
            setCustomError("Couldn't verify the ticker right now — try again.");
        } finally {
            setValidating(false);
        }
    };

    const removeCustomTicker = (t) => {
        setInputs({ ...inputs, tickers: selected.filter((x) => x !== t) });
        setCustomTickers(customTickers.filter((x) => x !== t));
    };
    const clearTickers = () => {
        setInputs({ ...inputs, tickers: [] });
        setCustomTickers([]);
        setCustomTicker("");
        setCustomError("");
    };



    return (
        <aside className="panel" data-tour="panel">
            <h2>Inputs</h2>

            <div className="field">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Tickers</span>
                    {selected.length > 0 && (
                        <button
                            type="button"
                            onClick={clearTickers}
                            style={{
                                border: "none", background: "transparent", cursor: "pointer",
                                fontSize: "13px", color: "var(--muted)", textDecoration: "underline", padding: 0,
                            }}
                        >
                            Clear
                        </button>
                    )}
                </div>

                <div style={{ position: "relative" }}>
                    <button
                        type="button"
                        className="ticker-trigger"
                        onClick={() => {
                            setTickersOpen((o) => !o);
                            setTickerQuery("");
                        }}
                        style={{
                            width: "100%", textAlign: "left", padding: "8px 10px",
                            border: "1px solid var(--border)", borderRadius: "6px",
                            background: "var(--card)", cursor: "pointer", fontSize: "14px",
                            color: "var(--ink)",
                        }}
                    >
                        {selected.length === 0 ? "Select tickers…" : selected.join(", ")}
                    </button>
                    {tickersOpen && (
                        <>
                            <div
                                style={{ position: "fixed", inset: 0, zIndex: 5 }}
                                onClick={() => {
                                    setTickersOpen(false);
                                    setTickerQuery("");
                                }}
                            />
                            <div
                                className="dropdown-pop"
                                onKeyDown={(e) => {
                                    if (e.key === "Escape") { setTickersOpen(false); setTickerQuery(""); }
                                }}
                                style={{
                                    position: "absolute", zIndex: 10, left: 0, right: 0,
                                    maxHeight: "260px", overflowY: "auto", background: "var(--card)",
                                    border: "1px solid var(--border)", borderRadius: "6px",
                                    marginTop: "4px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                                }}
                            >

                                <div style={{ padding: "6px", position: "sticky", top: 0, background: "var(--card)" }}>
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Search tickers…"
                                        value={tickerQuery}
                                        onChange={(e) => setTickerQuery(e.target.value)}
                                        style={{
                                            width: "100%", padding: "7px 9px", fontSize: "14px",
                                            border: "1px solid var(--border)", borderRadius: "6px",
                                            boxSizing: "border-box",
                                            background: "var(--input-bg)", color: "var(--ink)",
                                        }}
                                    />
                                </div>
                                {companies.map((c) => (
                                    <label
                                        key={c.ticker}
                                        className="ticker-option"
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
                                        </span>
                                    </label>
                                ))}
                                {companies.length === 0 && (
                                    <div className="muted" style={{ padding: "8px 10px" }}>
                                        {tickerQuery.trim()
                                            ? `No tickers match "${tickerQuery.trim()}".`
                                            : "Loading tickers…"}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
                <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                    <input
                        type="text"
                        placeholder="Custom ticker…"
                        value={customTicker}
                        onChange={(e) => { setCustomTicker(e.target.value.toUpperCase()); setCustomError(""); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTicker(); } }}
                        style={{
                            flex: 1, padding: "7px 9px", fontSize: "14px",
                            background: "var(--input-bg)", color: "var(--ink)",
                            border: "1px solid var(--border)", borderRadius: "6px",
                        }}
                    />
                    <button
                        type="button"
                        onClick={addCustomTicker}
                        disabled={validating}
                        style={{
                            padding: "7px 12px", fontSize: "14px", border: "1px solid var(--border)",
                            borderRadius: "6px", background: "var(--surface-2)", cursor: "pointer",
                            color: "var(--ink)",
                        }}
                    >
                        {validating ? "Checking…" : "Add"}
                    </button>
                </div>
                {customError && (
                    <div style={{ color: "var(--error-text)", fontSize: "13px", marginTop: "6px" }}>
                        {customError}
                    </div>
                )}
                {customTickers.filter((t) => selected.includes(t)).length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                        {customTickers.filter((t) => selected.includes(t)).map((t) => (
                            <span
                                key={t}
                                className="chip"
                                style={{
                                    display: "inline-flex", alignItems: "center", gap: "4px",
                                    padding: "3px 8px", fontSize: "13px", background: "var(--chip-bg)",
                                    color: "var(--chip-ink)",
                                    borderRadius: "999px",
                                }}
                            >
                {t}
                                <button
                                    type="button"
                                    className="chip-remove"
                                    onClick={() => removeCustomTicker(t)}
                                    aria-label={`Remove ${t}`}
                                    style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "13px", padding: "0 2px" }}
                                >
                    ×
                </button>
            </span>
                        ))}
                    </div>
                )}
            </div>

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

            <button className="primary" data-tour="run" onClick={onRun} disabled={loading}>
                {loading ? "Optimizing…" : "Run optimization"}
            </button>
        </aside>
    );
}