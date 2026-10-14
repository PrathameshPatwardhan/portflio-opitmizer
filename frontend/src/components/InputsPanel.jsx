export default function InputsPanel({
                                        inputs,
                                        setInputs,
                                        onRun,
                                        loading,
                                        universeData,
                                        onRefresh,
                                        refreshing,
                                        refreshMsg,
                                    }) {
    const set = (key) => (e) => {
        const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        setInputs({ ...inputs, [key]: v });
    };

    const lastIngest = universeData?.lastIngest;

    return (
        <aside className="panel">
            <h2>Inputs</h2>

            <label className="field">
                <span>Tickers (comma separated)</span>
                <input
                    type="text"
                    value={inputs.tickers}
                    onChange={set("tickers")}
                    placeholder="SPY, QQQ, GLD, TLT, EEM"
                />
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

            <div className="market-data">
                <h3>Market data</h3>
                <p className="muted">
                    {universeData
                        ? `${universeData.companies.length} tickers stored in MySQL`
                        : "MySQL status unknown"}
                </p>
                {lastIngest && (
                    <p className="muted">
                        Last refresh: {new Date(lastIngest.startedAt).toLocaleString()} (
                        {Number(lastIngest.rowsUpserted).toLocaleString()} rows)
                    </p>
                )}
                <button className="secondary" onClick={onRefresh} disabled={refreshing}>
                    {refreshing ? "Refreshing… (takes 1–2 min)" : "Refresh market data"}
                </button>
                {refreshMsg && <p className="muted">{refreshMsg}</p>}
            </div>
        </aside>
    );
}
