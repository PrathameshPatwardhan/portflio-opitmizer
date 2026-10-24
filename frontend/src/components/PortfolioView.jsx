import { useEffect, useMemo, useState } from "react";
import Plot from "./Plot.jsx";
import { buildOptimizeBody, optimizeTarget, allocate } from "../api.js";

function downloadCsv(weights) {
  const rows = ["ticker,weight"];
  for (const [t, w] of Object.entries(weights)) {
    rows.push(`${t},${w.toFixed(6)}`);
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "portfolio_weights.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function PortfolioView({ optResult, inputs, onError }) {
  const [choice, setChoice] = useState("maxSharpe");
  const [targetReturn, setTargetReturn] = useState(null); // fraction
  const [targetResult, setTargetResult] = useState(null);
  const [targetLoading, setTargetLoading] = useState(false);
  const [amount, setAmount] = useState("2000");
  const [alloc, setAlloc] = useState(null);
  const [allocLoading, setAllocLoading] = useState(false);

  async function runAllocate() {
    const amt = Number(amount);
    if (!shown || !(amt > 0)) {
      onError("Enter an investment amount greater than 0.");
      return;
    }
    setAllocLoading(true);
    try {
      setAlloc(await allocate(Object.keys(shown.weights), shown.weights, amt));
    } catch (e) {
      onError(e.message);
    } finally {
      setAllocLoading(false);
    }
  }

  // Frontier return range for the target slider.
  const [lo, hi] = useMemo(() => {
    if (!optResult || !optResult.frontier.length) return [0, 1];
    const rets = optResult.frontier.map((p) => p.ret);
    return [Math.min(...rets), Math.max(...rets)];
  }, [optResult]);

  // Initialize the slider in the middle of the frontier.
  useEffect(() => {
    if (optResult && targetReturn === null) {
      setTargetReturn((lo + hi) / 2);
    }
  }, [optResult, lo, hi, targetReturn]);

  // Debounced target-return solve so dragging the slider doesn't spam the API.
  useEffect(() => {
    if (choice !== "target" || targetReturn === null) return;
    setTargetLoading(true);
    const t = setTimeout(async () => {
      try {
        const body = { ...buildOptimizeBody(inputs), targetReturn };
        setTargetResult(await optimizeTarget(body));
      } catch (e) {
        onError(e.message);
      } finally {
        setTargetLoading(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [choice, targetReturn, inputs, onError]);

  const shown = useMemo(() => {
    if (!optResult) return null;
    if (choice === "target") return targetResult;
    return optResult[choice];
  }, [optResult, choice, targetResult]);

  const bar = useMemo(() => {
    if (!shown) return { data: [], layout: {} };
    const entries = Object.entries(shown.weights)
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
  }, [shown]);

  if (!optResult) {
    return <p className="hint">Run an optimization to see portfolio weights.</p>;
  }

  return (
    <div>
      <div className="radio-row" role="radiogroup" aria-label="Portfolio">
        {[
          ["maxSharpe", "Max Sharpe"],
          ["minVol", "Min volatility"],
          ["target", "Target return"],
        ].map(([key, label]) => (
          <label key={key} className="radio">
            <input
              type="radio"
              name="portfolio"
              checked={choice === key}
              onChange={() => setChoice(key)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      {choice === "target" && targetReturn !== null && (
        <label className="field slider-field">
          <span>
            Target annualized return: {(targetReturn * 100).toFixed(1)}%
            {targetLoading ? " (solving…)" : ""}
          </span>
          <input
            type="range"
            min={lo}
            max={hi}
            step={(hi - lo) / 100 || 0.001}
            value={targetReturn}
            onChange={(e) => setTargetReturn(Number(e.target.value))}
          />
        </label>
      )}

      {!shown ? (
        <p className="hint">
          {choice === "target"
            ? "Move the slider to solve for a target return."
            : "No portfolio to show."}
        </p>
      ) : (
        <>
          <div className="metrics">
            <div className="metric">
              <div className="metric-label">Return</div>
              <div className="metric-value">{(shown.ret * 100).toFixed(1)}%</div>
            </div>
            <div className="metric">
              <div className="metric-label">Volatility</div>
              <div className="metric-value">{(shown.vol * 100).toFixed(1)}%</div>
            </div>
            <div className="metric">
              <div className="metric-label">Sharpe</div>
              <div className="metric-value">{shown.sharpe.toFixed(2)}</div>
            </div>
          </div>

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

          <div style={{ marginTop: 24 }}>
            <h3>Turn this into real money</h3>
            <p className="hint">
              Enter how much you want to invest and see exactly what to buy —
              dollar amounts plus share counts, whole and fractional side by side.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
              <label className="field" style={{ margin: 0 }}>
                <span>Investment amount ($)</span>
                <input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 140 }} />
              </label>
              <button type="button" className="secondary" onClick={runAllocate} disabled={allocLoading}>
                {allocLoading ? "Splitting…" : "Show me the split"}
              </button>
            </div>
            {alloc && (
                <>
                  <table className="weights-table" style={{ marginTop: 12 }}>
                    <thead>
                    <tr><th>Ticker</th><th>Weight</th><th>$</th><th>Whole shares</th><th>Fractional</th></tr>
                    </thead>
                    <tbody>
                    {[...alloc.allocations].sort((a, b) => b.weight - a.weight).map((r) => (
                        <tr key={r.ticker}>
                          <td>{r.ticker}</td>
                          <td>{(r.weight * 100).toFixed(1)}%</td>
                          <td>${r.dollars.toFixed(2)}</td>
                          <td>{r.wholeShares} (${r.wholeCost.toFixed(2)})</td>
                          <td>{r.fractionalShares}</td>
                        </tr>
                    ))}
                    </tbody>
                  </table>
                  <p className="hint">Leftover cash: ${alloc.leftoverCash.toFixed(2)}.</p>
                  <p className="hint">{alloc.explanation}</p>
                </>
            )}
          </div>

          <div className="howto">
            <h3>What you&rsquo;re looking at</h3>
            <ul>
              <li>
                <strong>Weights:</strong> what share of your money goes into
                each asset. They always add up to 100%.
              </li>
              <li>
                <strong>Max Sharpe:</strong> the mix with the best return for
                each unit of risk taken. The efficiency sweet spot.
              </li>
              <li>
                <strong>Min volatility:</strong> the calmest mix possible —
                smallest swings, usually lower return.
              </li>
              <li>
                <strong>Target return:</strong> you pick the return you want;
                the app finds the calmest mix that aims for it.
              </li>
              <li>
                <strong>The three numbers:</strong> Return is the expected
                yearly gain, estimated from history. Volatility is how bumpy
                the ride is. Sharpe is return per unit of risk above the
                risk-free rate — higher is better.
              </li>
              <li>
                <strong>Keep in mind:</strong> these estimates come from past
                prices. History is the input, not a promise.
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
