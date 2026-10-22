"""Quant engine: Markowitz mean-variance math ported from the Streamlit prototype.

All functions here are pure numpy/pandas — no web framework code — so the
math can be unit-tested without spinning up the API.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.optimize import linprog, minimize

TRADING_DAYS = 252


@dataclass
class MarketInputs:
    """Annualized expected returns and covariance for one optimization run."""
    tickers: list[str]
    mu: np.ndarray      # shape (n,)
    cov: np.ndarray     # shape (n, n)
    long_only: bool
    max_weight: float


def _bounds(m: MarketInputs) -> list[tuple[float, float]]:
    n = len(m.tickers)
    return [(0.0, m.max_weight)] * n if m.long_only else [(-m.max_weight, m.max_weight)] * n


def _sum_to_one(n: int) -> dict:
    return {"type": "eq", "fun": lambda w: float(np.sum(w) - 1.0)}


def min_vol_portfolio(m: MarketInputs, target_return: float | None = None) -> np.ndarray | None:
    """Minimum-volatility portfolio, optionally pinned to a target return.

    Returns None when the constraints are infeasible / solver fails.
    """
    n = len(m.tickers)
    constraints = [_sum_to_one(n)]
    if target_return is not None:
        constraints.append(
            {"type": "eq",
             "fun": lambda w, t=target_return: float(w @ m.mu - t)}
        )
    res = minimize(
        lambda w: float(w @ m.cov @ w),
        np.ones(n) / n,
        bounds=_bounds(m),
        constraints=constraints,
        method="SLSQP",
        options={"maxiter": 500},
    )
    return res.x if res.success else None


def max_sharpe_portfolio(m: MarketInputs, risk_free: float) -> np.ndarray | None:
    """Tangency portfolio: maximizes (return - rf) / volatility."""
    n = len(m.tickers)

    def neg_sharpe(w: np.ndarray) -> float:
        vol = float(np.sqrt(w @ m.cov @ w))
        return -(float(w @ m.mu) - risk_free) / vol if vol > 1e-12 else 0.0

    res = minimize(
        neg_sharpe,
        np.ones(n) / n,
        bounds=_bounds(m),
        constraints=[_sum_to_one(n)],
        method="SLSQP",
        options={"maxiter": 500},
    )
    return res.x if res.success else None


def portfolio_stats(m: MarketInputs, w: np.ndarray, risk_free: float) -> tuple[float, float, float]:
    """(annualized return, annualized vol, Sharpe) for weights w."""
    ret = float(w @ m.mu)
    vol = float(np.sqrt(w @ m.cov @ w))
    sharpe = (ret - risk_free) / vol if vol > 1e-12 else 0.0
    return ret, vol, sharpe


def efficient_frontier(m: MarketInputs, n_points: int = 40) -> list[tuple[float, float]]:
    """Trace the frontier: min-vol portfolio for a sweep of target returns.

    The min-vol-for-target curve is a parabola: targets below the global
    minimum-volatility portfolio's return trace the INEFFICIENT lower branch
    (more risk for less return). Only targets at/above that return belong on
    the efficient frontier, so the sweep starts there. Points whose solved
    return misses the target (infeasible region, e.g. a binding max-weight
    cap) are dropped, and the result is filtered to the upper envelope
    (return strictly increasing in volatility) as a safety net against
    solver noise — otherwise the plotted line zigzags.
    """
    w_gmv = min_vol_portfolio(m)
    if w_gmv is None:
        return []
    gmv_ret = float(w_gmv @ m.mu)

    points: list[tuple[float, float]] = []
    for target in np.linspace(max(gmv_ret, m.mu.min()), m.mu.max(), n_points):
        w = min_vol_portfolio(m, float(target))
        if w is None:
            continue
        ret, vol, _ = portfolio_stats(m, w, risk_free=0.0)
        if abs(ret - target) < 0.01:  # constraint actually bound
            points.append((vol, ret))
    points.sort(key=lambda p: p[0])
    frontier: list[tuple[float, float]] = []
    best = -float("inf")
    for vol, ret in points:
        if ret > best + 1e-9:
            frontier.append((vol, ret))
            best = ret
    return frontier



def random_cloud(m: MarketInputs, risk_free: float, size: int, seed: int = 42
                 ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Random long-only (or long/short) portfolios for the background scatter."""
    n = len(m.tickers)
    rng = np.random.default_rng(seed)
    w = rng.random((size, n))
    w = w / w.sum(axis=1, keepdims=True)
    if not m.long_only:
        w = w * 2 - (1.0 / n)
    rets = w @ m.mu
    vols = np.sqrt(np.einsum("ij,jk,ik->i", w, m.cov, w))
    sharpe = (rets - risk_free) / np.where(vols < 1e-12, np.nan, vols)
    return vols, rets, np.nan_to_num(sharpe, nan=0.0)


def simulate_rebalance(
    daily_rets: pd.DataFrame,
    target_w: np.ndarray,
    freq: str | None = None,
) -> tuple[pd.Series, float, int]:
    """Walk-forward simulation of a fixed target-weight strategy.

    Weights drift with returns day to day (buy-and-hold behavior). When freq
    is given ("Q"/"M"), weights reset to target_w on the first trading day of
    each new quarter/month and turnover accumulates as sum(|dw|)/2 (each
    rebalance moves that fraction of portfolio value, counted once).
    With freq=None the portfolio is never rebalanced (pure buy-and-hold).

    Returns (equity curve starting at 1.0, total turnover, rebalance count).
    """
    w = target_w.copy()
    values = [1.0]
    turnover, n_rebal = 0.0, 0
    prev_period = None
    for date, row in daily_rets.iterrows():
        period = date.to_period(freq) if freq else None
        if freq and prev_period is not None and period != prev_period:
            turnover += float(np.abs(target_w - w).sum()) / 2.0
            w = target_w.copy()
            n_rebal += 1
        prev_period = period
        r = row.values.astype(float)
        port_r = float(w @ r)
        values.append(values[-1] * (1.0 + port_r))
        # drift: winners become a bigger slice of the portfolio
        w = w * (1.0 + r) / (1.0 + port_r) if abs(1.0 + port_r) > 1e-12 else w
    return pd.Series(values[1:], index=daily_rets.index), turnover, n_rebal


def track_record(equity: pd.Series, risk_free: float) -> dict[str, float]:
    """CAGR / Sharpe / max-drawdown summary of an equity curve."""
    total = float(equity.iloc[-1] / equity.iloc[0] - 1.0)
    years = len(equity) / TRADING_DAYS
    cagr = (1.0 + total) ** (1.0 / years) - 1.0 if years > 0 else 0.0
    dr = equity.pct_change().dropna()
    vol = float(dr.std() * np.sqrt(TRADING_DAYS))
    sharpe = (float(dr.mean()) * TRADING_DAYS - risk_free) / vol if vol > 0 else 0.0
    max_dd = float((equity / equity.cummax() - 1.0).min())
    return {
        "final": float(equity.iloc[-1]),
        "cagr": cagr,
        "sharpe": sharpe,
        "maxDrawdown": max_dd,
    }

def empirical_cvar(scenario_rets: np.ndarray, w: np.ndarray, alpha: float) -> float:
    """Historical CVaR_alpha of the portfolio LOSS for weights w.

    Mean loss over the worst (1 - alpha) fraction of scenarios.
    Used for reporting/comparison; the optimizer below finds the true minimum.
    """
    losses = -(np.asarray(scenario_rets, dtype=float) @ np.asarray(w, dtype=float))
    k = max(1, int(np.ceil((1.0 - alpha) * len(losses))))
    return float(np.sort(losses)[-k:].mean())


def cvar_portfolio(scenario_rets: np.ndarray, m: MarketInputs, alpha: float = 0.95,
                   target_return: float | None = None) -> tuple[np.ndarray | None, float | None]:
    """Minimum-CVaR portfolio via the Rockafellar-Uryasev (2000) LP.

    scenario_rets: (T, n) historical returns, columns in m.tickers order.
    Minimizes CVaR_alpha of the portfolio loss = mean loss in the worst
    (1 - alpha) tail of scenarios. Unlike variance, this penalizes exactly the
    outcomes investors fear: large left-tail losses.

    Returns (weights, daily CVaR of loss), or (None, None) when infeasible.
    """
    R = np.asarray(scenario_rets, dtype=float)
    T, n = R.shape
    if T == 0 or n != len(m.tickers):
        return None, None
    # Decision variables: w_1..w_n, zeta (VaR proxy), u_1..u_T (tail excesses).
    #   min  zeta + 1/((1-alpha)*T) * sum(u_t)
    #   s.t. u_t >= -R_t.w - zeta   (loss beyond VaR)
    #        u_t >= 0,  sum(w) = 1,  bounds on w,  optional w.mu >= target_return
    nvar = n + 1 + T
    c = np.zeros(nvar)
    c[n] = 1.0
    c[n + 1:] = 1.0 / ((1.0 - alpha) * T)
    A_ub = np.zeros((T, nvar))
    A_ub[:, :n] = -R
    A_ub[:, n] = -1.0
    A_ub[np.arange(T), n + 1 + np.arange(T)] = -1.0
    b_ub = np.zeros(T)
    if target_return is not None:
        row = np.zeros(nvar)
        row[:n] = -m.mu
        A_ub = np.vstack([A_ub, row])
        b_ub = np.append(b_ub, -target_return)
    A_eq = np.zeros((1, nvar))
    A_eq[0, :n] = 1.0
    b_eq = np.ones(1)
    bounds = _bounds(m) + [(None, None)] + [(0.0, None)] * T
    res = linprog(c, A_ub=A_ub, b_ub=b_ub, A_eq=A_eq, b_eq=b_eq,
                  bounds=bounds, method="highs")
    if not res.success:
        return None, None
    return res.x[:n], float(res.fun)

