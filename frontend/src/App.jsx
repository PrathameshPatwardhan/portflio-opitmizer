import { useEffect, useState, useCallback, useRef } from "react";
import InputsPanel from "./components/InputsPanel.jsx";
import FrontierView from "./components/FrontierView.jsx";
import PortfolioView from "./components/PortfolioView.jsx";
import RebalanceView from "./components/RebalanceView.jsx";
import CvarView from "./components/CvarView.jsx";
import DashboardView from "./components/DashboardView.jsx";
import GlossaryView from "./components/GlossaryView.jsx";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import AuthScreen from "./AuthScreen.jsx";
import SavedPortfolios from "./SavedPortfolios.jsx";
import { buildOptimizeBody, optimize, optimizeCvar, rebalance, universe, ingest, savePortfolio } from "./api.js";
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
  ["tailrisk", "Tail Risk"],
  ["glossary", "Glossary"],
];

function App() {
  const { user, logout } = useAuth();
  const [inputs, setInputs] = useState(DEFAULTS);
  const [tab, setTab] = useState("frontier");
  const [optResult, setOptResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rebFreq, setRebFreq] = useState("Q");
  const [rebResult, setRebResult] = useState(null);
  const [rebLoading, setRebLoading] = useState(false);
  const [cvarResult, setCvarResult] = useState(null);
  const [cvarLoading, setCvarLoading] = useState(false);
  const [cvarAlpha, setCvarAlpha] = useState(0.95);
  const [universeData, setUniverseData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");
  const [authView, setAuthView] = useState(false); // true -> show the login/signup screen
  const [saveMsg, setSaveMsg] = useState("");

  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("po-theme");
      if (saved === "dark" || saved === "light") return saved;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("po-theme", theme); } catch {}
  }, [theme]);


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

  async function runCvar() {
    const body = buildOptimizeBody(inputs);
    if (body.tickers.length < 2) {
      setError("Select at least two tickers to run an optimization.");
      return;
    }
    setCvarLoading(true);
    setError("");
    try {
      setCvarResult(await optimizeCvar(inputs, cvarAlpha));
    } catch (e) {
      setError(e.message);
    } finally {
      setCvarLoading(false);
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

  /** Save the current max-Sharpe result to the user's account. */
  async function handleSavePortfolio() {
    setSaveMsg("");
    if (!user) {
      setAuthView(true); // logged out -> prompt login first
      return;
    }
    const best = optResult && optResult.maxSharpe;
    if (!best) {
      setError("Run an optimization first, then save it.");
      return;
    }
    const name = window.prompt("Name this portfolio:", inputs.tickers.join(" + "));
    if (!name || !name.trim()) return;
    try {
      await savePortfolio(name.trim(), {
        inputs,
        weights: best.weights,
        metrics: { ret: best.ret, vol: best.vol, sharpe: best.sharpe, dataSource: best.dataSource },
        savedAt: new Date().toISOString(),
      });
      setSaveMsg("Saved — find it under the Saved tab.");
    } catch (e) {
      setError(e.message);
    }
  }

  /** Load a saved portfolio: restore its tickers + settings into the panel. */
  function handleLoadPortfolio(payload) {
    setInputs({ ...DEFAULTS, ...(payload && payload.inputs ? payload.inputs : {}) });
    setOptResult(null);
    setRebResult(null);
    setTab("frontier");
    setSaveMsg("");
    setError("");
  }

  // The Saved tab only exists for logged-in users.
  const tabs = user ? [...TABS, ["dashboard", "Dashboard"], ["saved", "Saved"]] : TABS;
  // Logging out while on the Saved tab falls back to Frontier.
  const visibleTab = (tab === "saved" || tab === "dashboard") && !user ? "frontier" : tab;

  // Full-screen auth view (login/signup); everything else stays public.
  if (authView && !user) {
    return (
        <div className="app">
          <AuthScreen onBack={() => setAuthView(false)} />
        </div>
    );
  }

  return (
      <div className="app">
        <header className="header">
          <div className="header-row">
            <div>
              <h1>Portfolio Optimizer</h1>
              <p className="subtitle">
                Markowitz mean-variance optimization on real market data.
              </p>
            </div>
            <div className="header-actions">
              {user ? (
                  <div className="auth-area">
                    <span className="auth-email" title="Signed in">{user.email}</span>
                    <button type="button" className="secondary auth-btn" onClick={logout}>
                      Log out
                    </button>
                  </div>
              ) : (
                  <button
                      type="button"
                      className="secondary auth-btn"
                      onClick={() => setAuthView(true)}
                  >
                    Log in
                  </button>
              )}
              <button
                  type="button"
                  className="theme-toggle"
                  onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                  aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                  title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              >
                {theme === "dark" ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                )}
              </button>
            </div>
          </div>
          <div className="intro-card">
            <p className="intro-text">
              Pick a few tickers — the app finds the mix with the best return
              for its risk, from real market prices. Then it turns the answer
              into dollar amounts, a tail-risk check, and a dashboard for
              your holdings.
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
                <span><strong>Explore the tabs</strong> — Frontier, Portfolio, Rebalance, Tail Risk, Glossary</span>
              </li>
              <li>
                <span className="step-num">4</span>
                <span><strong>Log in</strong> to save portfolios and track real holdings on the Dashboard</span>
              </li>
            </ol>
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
              {tabs.map(([key, label]) => (
                  <button
                      key={key}
                      className={visibleTab === key ? "tab active" : "tab"}
                      onClick={() => setTab(key)}
                  >
                    {label}
                  </button>
              ))}
            </nav>

            <section className="card">
              {visibleTab === "frontier" && <FrontierView data={optResult} theme={theme} />}
              {visibleTab === "portfolio" && (
                  <>
                    <PortfolioView
                        optResult={optResult}
                        inputs={inputs}
                        onError={setError}
                    />
                    {optResult && (
                        <div style={{ marginTop: 16 }}>
                          <button
                              type="button"
                              className="secondary"
                              style={{ marginTop: 0 }}
                              onClick={handleSavePortfolio}
                          >
                            {user ? "Save this portfolio" : "Log in to save portfolios"}
                          </button>
                          {saveMsg && <p className="hint" style={{ marginTop: 8 }}>{saveMsg}</p>}
                        </div>
                    )}
                  </>
              )}
              {visibleTab === "rebalance" && (
                  <RebalanceView
                      result={rebResult}
                      frequency={rebFreq}
                      setFrequency={setRebFreq}
                      onRun={runRebalance}
                      loading={rebLoading}
                      hasInputs={inputs.tickers.length > 0}
                  />
              )}
              {visibleTab === "tailrisk" && (
                  <CvarView
                      result={cvarResult}
                      alpha={cvarAlpha}
                      setAlpha={setCvarAlpha}
                      onRun={runCvar}
                      loading={cvarLoading}
                      hasInputs={inputs.tickers.length > 1}
                  />
              )}
              {visibleTab === "dashboard" && user && (
                  <DashboardView optResult={optResult} />
              )}
              {visibleTab === "glossary" && <GlossaryView />}
              {visibleTab === "saved" && user && (
                  <SavedPortfolios onLoad={handleLoadPortfolio} />
              )}
            </section>
          </main>
        </div>

        <footer className="footer">
          Passion Project
        </footer>
      </div>
  );
}

/** Root: provides auth state to the whole app. main.jsx's default import
 *  keeps working because the default export is still named for it. */
export default function AppRoot() {
  return (
      <AuthProvider>
        <App />
      </AuthProvider>
  );
}
