import { useMemo } from "react";
import Plot from "./Plot.jsx";

const pctFmt = { tickformat: ".0%", dtick: 0.02 };

export default function FrontierView({ data, theme }) {
  const dark = theme === "dark";
  const accentLine = dark ? "#a5b4fc" : "#2563eb";
  const { traces, layout } = useMemo(() => {
    if (!data) return { traces: [], layout: {} };
    const { cloud, frontier, maxSharpe, minVol, assets } = data;

    const traces = [
      {
        x: cloud.vol,
        y: cloud.ret,
        mode: "markers",
        type: "scatter",
        name: "Random portfolios",
        marker: {
          color: cloud.sharpe,
          colorscale: "Viridis",
          size: 3,
          opacity: 0.8,
          showscale: true,
          colorbar: { title: "Sharpe" },
        },
        hovertemplate: "Vol %{x:.1%} · Ret %{y:.1%}<extra></extra>",
      },
      {
        x: frontier.map((p) => p.vol),
        y: frontier.map((p) => p.ret),
        mode: "lines",
        type: "scatter",
        name: "Efficient frontier",
        line: { color: accentLine, width: 9 },
        opacity: 0.16,
        hoverinfo: "skip",
        showlegend: false,
      },
      {
        x: frontier.map((p) => p.vol),
        y: frontier.map((p) => p.ret),
        mode: "lines",
        type: "scatter",
        name: "Efficient frontier",
        line: { color: accentLine, width: 2.5 },
        hovertemplate: "Vol %{x:.1%} · Ret %{y:.1%}<extra></extra>",
      },
      {
        x: [maxSharpe.vol],
        y: [maxSharpe.ret],
        mode: "markers",
        type: "scatter",
        name: "Max Sharpe",
        marker: { color: "red", size: 13, symbol: "star" },
        hovertemplate: "Max Sharpe<br>Vol %{x:.1%} · Ret %{y:.1%}<extra></extra>",
      },
      {
        x: [minVol.vol],
        y: [minVol.ret],
        mode: "markers",
        type: "scatter",
        name: "Min volatility",
        marker: { color: "#0aa", size: 11, symbol: "diamond" },
        hovertemplate: "Min vol<br>Vol %{x:.1%} · Ret %{y:.1%}<extra></extra>",
      },
      {
        x: assets.map((a) => a.vol),
        y: assets.map((a) => a.ret),
        text: assets.map((a) => a.ticker),
        mode: "markers+text",
        type: "scatter",
        name: "Assets",
        textposition: "top center",
        marker: { color: "orange", size: 8 },
        hovertemplate: "%{text}<br>Vol %{x:.1%} · Ret %{y:.1%}<extra></extra>",
      },
    ];

    const grid = dark ? "#22304d" : "#e5e7eb";
    const layout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: dark ? "#e9eef8" : "#1a1d21", family: "'Inter', sans-serif" },
      hovermode: "closest",
      hoverlabel: {
        bgcolor: dark ? "#1a2540" : "#ffffff",
        bordercolor: dark ? "#2a3a5f" : "#e5e7eb",
        font: { color: dark ? "#e9eef8" : "#1a1d21", size: 12, family: "'Inter', sans-serif" },
      },
      xaxis: { title: "Annualized volatility", ...pctFmt, gridcolor: grid, zeroline: false, linecolor: grid },
      yaxis: { title: "Annualized return", ...pctFmt, gridcolor: grid, zeroline: false, linecolor: grid },
      legend: { orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "right", x: 1 },
      margin: { t: 40, r: 20, b: 50, l: 60 },
      height: 520,
    };
    return { traces, layout };
  }, [data, dark]);

  if (!data) {
    return <p className="hint">Run an optimization to see the frontier.</p>;
  }

  const { maxSharpe, minVol } = data;
  return (
      <div>
        <Plot data={traces} layout={layout} style={{ width: "100%" }} />
        <div className="metrics">
          <div className="metric">
            <div className="metric-label">Max-Sharpe return</div>
            <div className="metric-value">{(maxSharpe.ret * 100).toFixed(1)}%</div>
            <div className="metric-sub">Sharpe {maxSharpe.sharpe.toFixed(2)}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Max-Sharpe volatility</div>
            <div className="metric-value">{(maxSharpe.vol * 100).toFixed(1)}%</div>
          </div>
          <div className="metric">
            <div className="metric-label">Min-vol portfolio</div>
            <div className="metric-value">
              {(minVol.ret * 100).toFixed(1)}% / {(minVol.vol * 100).toFixed(1)}%
            </div>
            <div className="metric-sub">Sharpe {minVol.sharpe.toFixed(2)}</div>
          </div>
        </div>
        <div className="howto">
          <h3>How to read this chart</h3>
          <ul>
            <li>
              <strong>Horizontal axis — Volatility:</strong> how much the
              portfolio&rsquo;s value swings up and down in a year. Further
              right means a bumpier ride.
            </li>
            <li>
              <strong>Vertical axis — Return:</strong> average yearly gain over
              the chosen period. Higher means more growth.
            </li>
            <li>
              <strong>Each dot:</strong> one random mix of the tickers. Its
              color is the Sharpe ratio &mdash; how much return you get per
              unit of bumpiness. Yellow means more return for the risk, purple
              means less.
            </li>
            <li>
              <strong>Frontier line &mdash; Efficient frontier:</strong> the best
              return achievable at each risk level. Any dot below the line is a
              worse deal: same risk, less return.
            </li>
            <li>
              <strong>Red star &mdash; Max Sharpe:</strong> the mix with the
              best return per unit of risk. The sweet spot if you want
              efficiency.
            </li>
            <li>
              <strong>Teal diamond &mdash; Min volatility:</strong> the calmest
              possible mix. Smallest swings, but usually lower return too.
            </li>
            <li>
              <strong>Orange dots:</strong> holding one asset all on its own,
              with no mixing. Notice how most of them sit below the line
              &mdash; that gap is the payoff from diversification.
            </li>
          </ul>
        </div>
      </div>
  );
}