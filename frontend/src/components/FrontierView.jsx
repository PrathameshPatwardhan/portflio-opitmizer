import { useMemo } from "react";
import Plot from "./Plot.jsx";

const pctFmt = { tickformat: ".0%" };

export default function FrontierView({ data }) {
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
        line: { color: "#111", width: 2 },
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

    const layout = {
      xaxis: { title: "Annualized volatility", ...pctFmt },
      yaxis: { title: "Annualized return", ...pctFmt },
      legend: { orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "right", x: 1 },
      margin: { t: 40, r: 20, b: 50, l: 60 },
      height: 520,
    };
    return { traces, layout };
  }, [data]);

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
    </div>
  );
}
