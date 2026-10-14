import { useState } from "react";
import InputsPanel from "./components/InputsPanel.jsx";
import FrontierView from "./components/FrontierView.jsx";
import PortfolioView from "./components/PortfolioView.jsx";
import RebalanceView from "./components/RebalanceView.jsx";
import { buildOptimizeBody, optimize, rebalance } from "./api.js";

const DEFAULTS = {
  tickers: "SPY, QQQ, GLD, TLT, EEM",
  period: "5y",
  riskFreeRate: 4.0,
  longOnly: true,
  maxWeight: 100,
};

const TABS = [
  ["frontier", "Frontier"],
  ["portfolio", "Portfolio"],
  ["rebalance", "Rebalance"],
];

export default function App() {
  const [inputs, setInputs] = useState(DEFAULTS);
  const [tab, setTab] = useState("frontier");
  const [optResult, setOptResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rebFreq, setRebFreq] = useState("Q");
  const [rebResult, setRebResult] = useState(null);
  const [rebLoading, setRebLoading] = useState(false);

  async function runOptimize() {
    setLoading(true);
    setError("");
    try {
      setOptResult(await optimize(buildOptimizeBody(inputs)));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function runRebalance() {
    setRebLoading(true);
    setError("");
    try {
      setRebResult(await rebalance(inputs, rebFreq));
    } catch (e) {
      setError(e.message);
    } finally {
      setRebLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Portfolio Optimizer</h1>
          <p className="subtitle">
            Markowitz mean-variance optimization on real market data.
          </p>

          <p className="intro">
            Pick a few tickers, and this app finds the mix of them with the best
            return for its risk — the mean-variance math from portfolio theory,
            run on real market prices. <strong>How to use it:</strong> 1) type
            tickers on the left, 2) click Run optimization, 3) explore the three
            tabs — Frontier for the big picture, Portfolio for the exact mix,
            Rebalance for whether rebalancing actually helps.
          </p>

        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <div className="layout">
        <InputsPanel
          inputs={inputs}
          setInputs={setInputs}
          onRun={runOptimize}
          loading={loading}
        />

        <main className="main">
          <nav className="tabs">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                className={tab === key ? "tab active" : "tab"}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>

          <section className="card">
            {tab === "frontier" && <FrontierView data={optResult} />}
            {tab === "portfolio" && (
              <PortfolioView
                optResult={optResult}
                inputs={inputs}
                onError={setError}
              />
            )}
            {tab === "rebalance" && (
              <RebalanceView
                result={rebResult}
                frequency={rebFreq}
                setFrequency={setRebFreq}
                onRun={runRebalance}
                loading={rebLoading}
                hasInputs={inputs.tickers.trim().length > 0}
              />
            )}
          </section>
        </main>
      </div>

      <footer className="footer">
        React + Spring Boot + Python quant service · data: Yahoo Finance
      </footer>
    </div>
  );
}
