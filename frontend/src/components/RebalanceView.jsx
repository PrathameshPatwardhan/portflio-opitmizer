import { useMemo } from "react";
import Plot from "./Plot.jsx";

function fmtPct(x) {
  return `${(x * 100).toFixed(1)}%`;
}

export default function RebalanceView({
  result,
  frequency,
  setFrequency,
  onRun,
  loading,
  hasInputs,
}) {
  const chart = useMemo(() => {
    if (!result) return { data: [], layout: {} };
    return {
      data: [
        {
          x: result.dates,
          y: result.buyHold.values,
          type: "scatter",
          mode: "lines",
          name: "Buy & hold",
        },
        {
          x: result.dates,
          y: result.rebalanced.values,
          type: "scatter",
          mode: "lines",
          name: `${frequency === "Q" ? "Quarterly" : "Monthly"} rebalanced`,
        },
      ],
      layout: {
        xaxis: { title: "Date" },
        yaxis: { title: "Growth of $1" },
        legend: { orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "right", x: 1 },
        margin: { t: 40, r: 20, b: 50, l: 60 },
        height: 380,
      },
    };
  }, [result, frequency]);

  const rows = useMemo(() => {
    if (!result) return [];
    const bh = result.buyHold;
    const rb = result.rebalanced;
    return [
      ["Final $1", `$${bh.final.toFixed(2)}`, `$${rb.final.toFixed(2)}`],
      ["CAGR", fmtPct(bh.cagr), fmtPct(rb.cagr)],
      ["Sharpe", bh.sharpe.toFixed(2), rb.sharpe.toFixed(2)],
      ["Max drawdown", fmtPct(bh.maxDrawdown), fmtPct(rb.maxDrawdown)],
    ];
  }, [result]);

  return (
    <div>
      <p className="hint">
        Max-Sharpe portfolio held two ways: buy-and-hold (weights drift) vs
        rebalanced back to target weights.
      </p>

      <div className="row">
        <label className="field inline">
          <span>Frequency</span>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
          >
            <option value="Q">Quarterly</option>
            <option value="M">Monthly</option>
          </select>
        </label>
        <button
          className="primary"
          onClick={onRun}
          disabled={loading || !hasInputs}
        >
          {loading ? "Running…" : "Run comparison"}
        </button>
      </div>

      {result && (
        <>
          <Plot data={chart.data} layout={chart.layout} style={{ width: "100%" }} />
          <table className="weights-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Buy &amp; hold</th>
                <th>
                  {frequency === "Q" ? "Quarterly" : "Monthly"} rebalanced
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, a, b]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{a}</td>
                  <td>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="howto">
            <h3>What you&rsquo;re looking at</h3>
            <ul>
              <li>
                <strong>Buy &amp; hold:</strong> pick the mix once and never
                touch it. Winners grow into a bigger share, so the mix drifts
                over time.
              </li>
              <li>
                <strong>Rebalanced:</strong> every quarter (or month), trade
                back to the target mix — selling what went up, buying what
                went down.
              </li>
              <li>
                <strong>Why it can help:</strong> rebalancing keeps risk from
                drifting up, and systematically sells high and buys low.
                Sometimes that adds return; sometimes it just adds trading.
              </li>
              <li>
                <strong>Turnover:</strong> how much of the portfolio had to be
                traded to rebalance. Real trading costs would eat into the
                rebalanced line, so the gap you see is a best case.
              </li>
              <li>
                <strong>The table:</strong> Final $1 is what a dollar became;
                CAGR is the yearly growth rate; Sharpe is return per unit of
                risk; Max drawdown is the worst fall from a peak.
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
