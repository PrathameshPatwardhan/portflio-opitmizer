import { useEffect, useState, useCallback, useRef } from "react";
import InputsPanel from "./components/InputsPanel.jsx";
import FrontierView from "./components/FrontierView.jsx";
import PortfolioView from "./components/PortfolioView.jsx";
import RebalanceView from "./components/RebalanceView.jsx";
import { buildOptimizeBody, optimize, rebalance, universe } from "./api.js";
const DEFAULTS = {
  tickers: [],
  period: "5y",
  riskFreeRate: 4.0,
  longOnly: true,
  maxWeight: 100,
  source: "auto",
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
  const [universeData, setUniverseData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");


  const universeSeq = useRef(0);
  const searchUniverse = useCallback((q) => {
    const seq = ++universeSeq.current;
    universe(q)
        .then((d) => { if (seq === universeSeq.current) setUniverseData(d); })
        .catch(() => {});
  }, []);

  async function runOptimize() {
    const body = buildOptimizeBody(inputs);
    if (body.tickers.length < 2) {
      setError("Select at least two tickers to run an optimization.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setOptResult(await optimize(body));
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

  async function runRefresh() {
    setRefreshing(true);
    setRefreshMsg("");
    try {
      const r = await ingest({});
      const n = r.tickers.length;
      setRefreshMsg(
          `Refreshed ${n} ticker${n === 1 ? "" : "s"} (${r.rowsUpserted.toLocaleString()} rows).`
      );
      setUniverseData(await universe());
    } catch (e) {
      setRefreshMsg(e.message);
    } finally {
      setRefreshing(false);
    }
  }

  const activeSource =
      tab === "rebalance" ? rebResult?.dataSource : optResult?.dataSource;

  return (
      <div className="app">
        <header className="header">
          <div>
            <h1>Portfolio Optimizer</h1>
            <p className="subtitle">
              Markowitz mean-variance optimization on real market data.
            </p>
            <div className="intro-card">
              <p className="intro-text">
                Pick a few tickers, and this app finds the mix of them with the
                best return for its risk — the mean-variance math from portfolio
                theory, run on real market prices.
              </p>
              <ol className="intro-steps">
                <li>
                  <span className="step-num">1</span>
                  <span><strong>Type tickers</strong> in the panel on the left</span>
                </li>
                <li>
                  <span className="step-num">2</span>
                  <span><strong>Run optimization</strong> to compute the frontier</span>
                </li>
                <li>
                  <span className="step-num">3</span>
                  <span><strong>Explore the tabs</strong> — Frontier, Portfolio, Rebalance</span>
                </li>
              </ol>
            </div>
          </div>
        </header>

        {error && <div className="error">{error}</div>}

        <div className="layout">
          <InputsPanel
              inputs={inputs}
              setInputs={setInputs}
              onRun={runOptimize}
              loading={loading}
              universeData={universeData}
              onSearchUniverse={searchUniverse}
              onRefresh={runRefresh}
              refreshing={refreshing}
              refreshMsg={refreshMsg}
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
              {activeSource && (
                  <span className="datasrc-badge" title="Where the numbers came from">
                Data: {activeSource === "mysql" ? "MySQL" : "live prices"}
              </span>
              )}
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
                      hasInputs={inputs.tickers.length > 0}
                  />
              )}
            </section>
          </main>
        </div>

        <footer className="footer">
          React + Spring Boot + Python quant service · data: Yahoo Finance, cached in MySQL
        </footer>
      </div>
  );
}
