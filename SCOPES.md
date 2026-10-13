# Candidate scopes

Shared foundation (`app.py`, `src/data.py`, deploy path) is done. Pick one;
the chosen page gets built out, the others are removed. Effort estimates are
for a working, deployable v1 — an afternoon each.

## 1. Portfolio optimizer (recommended pick)

**What it becomes:** type tickers → interactive efficient frontier, max-Sharpe
portfolio, per-asset weights, rebalancing view.

**Build-out on top of the stub:**
- Constraints: long-only toggle, max single-asset weight, target-return mode
  (minimize vol for a given return) via `scipy.optimize`
- Efficient frontier traced by optimization, not just random portfolios
- Rebalance comparison: static weights vs quarterly-rebalanced, with turnover
- Export: download weights CSV, "copy LinkedIn chart" PNG button

**Why it wins:** most visual, maps straight to interview topics (Sharpe,
frontier, diversification), and doubles as LinkedIn post #1's artifact.
**Skills showcased:** portfolio optimization, numpy/pandas, interactive viz.

## 2. Backtesting dashboard

**What it becomes:** pick a strategy template (MA crossover, momentum,
mean-reversion) → equity curves, drawdown chart, trade log, parameter sweep.

**Build-out on top of the stub:**
- Strategy registry: each strategy = one function in `src/strategies/`
- Metrics panel: CAGR, Sharpe, Sortino, max drawdown, win rate, turnover
- Parameter heatmap: sweep fast/slow windows, show the overfitting danger zone
- Honest reporting: always show buy-and-hold alongside, transaction costs toggle

**Skills showcased:** backtesting rigor, performance analytics, intellectual
honesty with results. Pairs with LinkedIn post #2.

## 3. Volatility tracker

**What it becomes:** realized-vs-implied volatility explorer across tickers,
with regime shading and term-structure view.

**Build-out on top of the stub:**
- Ticker comparison: realized vol for N assets on one chart
- Regime detector: simple vol-regime classification (low/elevated/stressed)
  with shaded background bands
- Options angle: pull an option chain via yfinance, compute IV smile for the
  nearest expiry (Topic 8/9 bridge)
- Alert view: "vol spike" table — assets where realized vol jumped >2σ

**Skills showcased:** volatility analysis, options intuition, data wrangling.
Pairs with LinkedIn post #5.

## Decision aid

| | Visual punch | Interview relevance | Build risk |
|---|---|---|---|
| Optimizer | ★★★ | ★★★ (Sharpe/frontier come up constantly) | Low |
| Backtester | ★★★ | ★★☆ | Medium (easy to over-scope) |
| Vol tracker | ★★☆ | ★★☆ | Medium (option-chain data is fiddly) |
