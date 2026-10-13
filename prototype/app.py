"""Portfolio Optimizer — interactive Markowitz mean-variance app.

Type tickers -> efficient frontier traced by optimization (not just random
portfolios), max-Sharpe and minimum-volatility portfolios, a target-return
mode, and a buy-and-hold vs rebalanced comparison. Market data comes from
yfinance; src/data.py falls back to synthetic data offline.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from scipy.optimize import minimize

from src.data import annualize, fetch_prices, log_returns

st.set_page_config(page_title="Portfolio Optimizer", layout="wide")
st.title("Portfolio Optimizer")
st.caption(
    "Markowitz mean-variance optimization on real market data. "
    "Pick tickers, explore the efficient frontier, compare rebalancing."
)

TRADING_DAYS = 252


# ----------------------------------------------------------------------------
# Sidebar inputs
# ----------------------------------------------------------------------------
def _ticker_list(raw: str) -> list[str]:
    return [t.strip().upper() for t in raw.split(",") if t.strip()]


with st.sidebar:
    st.header("Inputs")
    tickers = _ticker_list(
        st.text_input("Tickers (comma separated)", "SPY, QQQ, GLD, TLT, EEM")
    )
    period = st.selectbox("History", ["1y", "2y", "5y", "10y", "max"], index=2)
    rf = st.number_input("Risk-free rate (%)", 0.0, 20.0, 4.0, 0.25) / 100.0
    long_only = st.checkbox("Long only", value=True)
    max_w = st.slider("Max weight per asset", 0.05, 1.0, 1.0, 0.05)
    n_cloud = st.slider("Random portfolios (background)", 500, 10_000, 3_000, 500)
    rebal_freq = st.selectbox("Rebalance frequency", ["Quarterly", "Monthly"], index=0)


if len(tickers) < 2:
    st.warning("Add at least two tickers to build a frontier.")
    st.stop()
if max_w < 1.0 / len(tickers) - 1e-9:
    st.error(
        f"Max weight {max_w:.0%} is infeasible with {len(tickers)} assets "
        f"(needs at least {1.0 / len(tickers):.0%} each)."
    )
    st.stop()


@st.cache_data(ttl=3600)
def _prices(tickers: tuple[str, ...], period: str) -> pd.DataFrame:
    return fetch_prices(list(tickers), period=period)


prices = _prices(tuple(tickers), period)
if prices.shape[1] < 2:
    st.error("Could not fetch data for at least two tickers. Check the symbols.")
    st.stop()

rets = log_returns(prices)
mu, cov = annualize(rets)
mu_v, cov_m = mu.values, cov.values
names = list(mu.index)
n = len(mu_v)


# ----------------------------------------------------------------------------
# Optimization core
# ----------------------------------------------------------------------------
def _bounds() -> list[tuple[float, float]]:
    return [(0.0, max_w)] * n if long_only else [(-max_w, max_w)] * n


def _min_vol(target: float | None = None) -> np.ndarray | None:
    cons = [{"type": "eq", "fun": lambda w: float(np.sum(w) - 1.0)}]
    if target is not None:
        cons.append({"type": "eq", "fun": lambda w, t=target: float(w @ mu_v - t)})
    res = minimize(
        lambda w: float(w @ cov_m @ w),
        np.ones(n) / n,
        bounds=_bounds(),
        constraints=cons,
        method="SLSQP",
        options={"maxiter": 500},
    )
    return res.x if res.success else None


def _max_sharpe() -> np.ndarray | None:
    cons = [{"type": "eq", "fun": lambda w: float(np.sum(w) - 1.0)}]

    def neg_sharpe(w: np.ndarray) -> float:
        vol = float(np.sqrt(w @ cov_m @ w))
        return -(float(w @ mu_v) - rf) / vol if vol > 1e-12 else 0.0

    res = minimize(
        neg_sharpe, np.ones(n) / n, bounds=_bounds(), constraints=cons,
        method="SLSQP", options={"maxiter": 500},
    )
    return res.x if res.success else None


def _stats(w: np.ndarray) -> tuple[float, float, float]:
    ret = float(w @ mu_v)
    vol = float(np.sqrt(w @ cov_m @ w))
    sharpe = (ret - rf) / vol if vol > 1e-12 else 0.0
    return ret, vol, sharpe


w_sharpe = _max_sharpe()
w_minvol = _min_vol()
if w_sharpe is None or w_minvol is None:
    st.error("Optimization failed to converge — try fewer tickers or looser constraints.")
    st.stop()

# Efficient frontier: min-vol portfolio for a sweep of target returns.
targets = np.linspace(mu_v.min(), mu_v.max(), 40)
frontier, f_rets = [], []
for t in targets:
    w = _min_vol(float(t))
    if w is not None:
        r, v, _ = _stats(w)
        # keep points that actually hit the target (binding constraint)
        if abs(r - t) < 0.01:
            frontier.append((v, r))
frontier = np.array(frontier)

# Random cloud for context.
rng = np.random.default_rng(42)
rw = rng.random((n_cloud, n))
rw = rw / rw.sum(axis=1, keepdims=True)
if not long_only:
    rw = rw * 2 - (1.0 / n)  # allow shorts in the cloud too
cloud_ret = rw @ mu_v
cloud_vol = np.sqrt(np.einsum("ij,jk,ik->i", rw, cov_m, rw))
cloud_sharpe = (cloud_ret - rf) / np.where(cloud_vol < 1e-12, np.nan, cloud_vol)

# Individual assets.
asset_vol = np.sqrt(np.diag(cov_m))

# ----------------------------------------------------------------------------
# Section 1 — frontier chart
# ----------------------------------------------------------------------------
st.header("Efficient frontier")

fig = go.Figure()
fig.add_trace(
    go.Scatter(
        x=cloud_vol, y=cloud_ret, mode="markers",
        marker=dict(color=cloud_sharpe, colorscale="Viridis", size=3,
                    showscale=True, colorbar=dict(title="Sharpe")),
        name="Random portfolios",
        hovertemplate="Vol %{x:.1%} · Ret %{y:.1%}<extra></extra>",
    )
)
if len(frontier):
    order = np.argsort(frontier[:, 0])
    fig.add_trace(
        go.Scatter(
            x=frontier[order, 0], y=frontier[order, 1], mode="lines",
            line=dict(color="white", width=2), name="Efficient frontier",
            hovertemplate="Vol %{x:.1%} · Ret %{y:.1%}<extra></extra>",
        )
    )
rs, vs, ss = _stats(w_sharpe)
rm, vm, sm = _stats(w_minvol)
fig.add_trace(
    go.Scatter(x=[vs], y=[rs], mode="markers",
               marker=dict(color="red", size=13, symbol="star"),
               name="Max Sharpe",
               hovertemplate="Max Sharpe<br>Vol %{x:.1%} · Ret %{y:.1%}<extra></extra>")
)
fig.add_trace(
    go.Scatter(x=[vm], y=[rm], mode="markers",
               marker=dict(color="cyan", size=11, symbol="diamond"),
               name="Min volatility",
               hovertemplate="Min vol<br>Vol %{x:.1%} · Ret %{y:.1%}<extra></extra>")
)
fig.add_trace(
    go.Scatter(x=asset_vol, y=mu_v, mode="markers+text", text=names,
               textposition="top center",
               marker=dict(color="orange", size=8),
               name="Assets",
               hovertemplate="%{text}<br>Vol %{x:.1%} · Ret %{y:.1%}<extra></extra>")
)
fig.update_layout(
    xaxis_title="Annualized volatility", yaxis_title="Annualized return",
    xaxis_tickformat=".0%", yaxis_tickformat=".0%",
    legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    height=520,
)
st.plotly_chart(fig, use_container_width=True)

m1, m2, m3 = st.columns(3)
m1.metric("Max-Sharpe return", f"{rs:.1%}", f"Sharpe {ss:.2f}")
m2.metric("Max-Sharpe volatility", f"{vs:.1%}")
m3.metric("Min-vol portfolio", f"{rm:.1%} ret · {vm:.1%} vol", f"Sharpe {sm:.2f}")

# ----------------------------------------------------------------------------
# Section 2 — portfolio weights (picker + target-return mode)
# ----------------------------------------------------------------------------
st.header("Portfolio weights")

portfolios = {
    "Max Sharpe": w_sharpe,
    "Min volatility": w_minvol,
}
choice = st.radio("Portfolio", list(portfolios) + ["Target return"], horizontal=True)

if choice == "Target return" and len(frontier):
    t_lo, t_hi = float(frontier[:, 1].min()), float(frontier[:, 1].max())
    t_target = st.slider("Target annualized return", t_lo, t_hi, (t_lo + t_hi) / 2,
                         format="%.1%%")
    w_target = _min_vol(float(t_target))
    if w_target is None:
        st.warning("No feasible portfolio at that target with current constraints.")
        w_show, title = w_sharpe, "Max Sharpe (fallback)"
    else:
        w_show, title = w_target, f"Min-vol at {t_target:.1%} target"
else:
    w_show, title = portfolios[choice], choice

r_s, v_s, s_s = _stats(w_show)
c1, c2, c3 = st.columns(3)
c1.metric(f"{title} — return", f"{r_s:.1%}")
c2.metric(f"{title} — volatility", f"{v_s:.1%}")
c3.metric(f"{title} — Sharpe", f"{s_s:.2f}")

wdf = pd.DataFrame({"weight": w_show}, index=names).sort_values("weight", ascending=True)
wdf = wdf[wdf["weight"].abs() > 1e-4]
figw = go.Figure(go.Bar(x=wdf["weight"], y=wdf.index, orientation="h",
                        marker_color="steelblue",
                        hovertemplate="%{y}: %{x:.1%}<extra></extra>"))
figw.update_layout(xaxis_title="Weight", xaxis_tickformat=".0%", height=300,
                   margin=dict(l=60, r=20, t=20, b=40))
st.plotly_chart(figw, use_container_width=True)
st.dataframe(wdf.style.format({"weight": "{:.1%}"}), use_container_width=True)
st.download_button("Download weights (CSV)",
                   wdf.to_csv().encode(), file_name="portfolio_weights.csv",
                   mime="text/csv")

# ----------------------------------------------------------------------------
# Section 3 — rebalance comparison
# ----------------------------------------------------------------------------
st.header("Rebalance comparison")
st.caption(
    f"Max-Sharpe portfolio held two ways: buy-and-hold vs "
    f"{rebal_freq.lower()} rebalanced back to target weights."
)

daily = prices.pct_change().dropna()
freq_code = "Q" if rebal_freq == "Quarterly" else "M"


def _simulate(rebalance: bool) -> tuple[pd.Series, float, int]:
    w = w_sharpe.copy()
    values = [1.0]
    turnover, n_rebal = 0.0, 0
    prev_per = None
    for date, row in daily.iterrows():
        per = date.to_period(freq_code)
        if rebalance and prev_per is not None and per != prev_per:
            turnover += float(np.abs(w_sharpe - w).sum()) / 2.0
            w = w_sharpe.copy()
            n_rebal += 1
        prev_per = per
        pr = float(w @ row.values)
        values.append(values[-1] * (1.0 + pr))
        w = w * (1.0 + row.values) / (1.0 + pr) if abs(1.0 + pr) > 1e-12 else w
    return pd.Series(values[1:], index=daily.index), turnover, n_rebal


eq_bh, _, _ = _simulate(False)
eq_rb, turnover, n_rebal = _simulate(True)


def _perf(eq: pd.Series) -> dict[str, str]:
    total = eq.iloc[-1] / eq.iloc[0] - 1
    yrs = len(eq) / TRADING_DAYS
    cagr = (1 + total) ** (1 / yrs) - 1 if yrs > 0 else 0.0
    dr = eq.pct_change().dropna()
    sharpe = (dr.mean() * TRADING_DAYS - rf) / (dr.std() * np.sqrt(TRADING_DAYS)) \
        if dr.std() > 0 else 0.0
    dd = float((eq / eq.cummax() - 1).min())
    return {"Final $1": f"${eq.iloc[-1]:.2f}", "CAGR": f"{cagr:.1%}",
            "Sharpe": f"{sharpe:.2f}", "Max drawdown": f"{dd:.1%}"}


figr = go.Figure()
figr.add_trace(go.Scatter(x=eq_bh.index, y=eq_bh, name="Buy & hold"))
figr.add_trace(go.Scatter(x=eq_rb.index, y=eq_rb, name=f"{rebal_freq} rebalanced"))
figr.update_layout(xaxis_title="Date", yaxis_title="Growth of $1", height=380,
                   legend=dict(orientation="h", yanchor="bottom", y=1.02,
                               xanchor="right", x=1))
st.plotly_chart(figr, use_container_width=True)

perf = pd.DataFrame({"Buy & hold": _perf(eq_bh), f"{rebal_freq} rebalanced": _perf(eq_rb)})
st.dataframe(perf, use_container_width=True)
st.caption(f"Rebalanced turnover: {turnover:.1%} of portfolio value across "
           f"{n_rebal} rebalances. Turnover is a cost proxy — real trading would "
           f"eat into the rebalanced line.")
