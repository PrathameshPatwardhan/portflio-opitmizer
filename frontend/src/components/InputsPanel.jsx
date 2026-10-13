export default function InputsPanel({ inputs, setInputs, onRun, loading }) {
  const set = (key) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setInputs({ ...inputs, [key]: v });
  };

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
