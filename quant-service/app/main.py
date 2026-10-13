"""Quant service — FastAPI wrapper around the quant engine.

Stateless JSON API; all heavy math lives in app/quant.py.
"""
from __future__ import annotations

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .data import annualize, fetch_prices, log_returns
from .quant import (
    MarketInputs,
    efficient_frontier,
    max_sharpe_portfolio,
    min_vol_portfolio,
    portfolio_stats,
    random_cloud,
    simulate_rebalance,
    track_record,
)

app = FastAPI(title="Portfolio Optimizer — quant service", version="1.0.0")

MAX_CLOUD_POINTS = 3000


# ----------------------------------------------------------------------------
# Request / response models
# ----------------------------------------------------------------------------
class OptimizeRequest(BaseModel):
    tickers: list[str]
    period: str = "5y"
    riskFreeRate: float = 0.04
    longOnly: bool = True
    maxWeight: float = 1.0
    frontierPoints: int = Field(default=40, ge=2, le=200)
    cloudSize: int = Field(default=3000, ge=100, le=20000)


class TargetRequest(OptimizeRequest):
    targetReturn: float


class RebalanceRequest(BaseModel):
    tickers: list[str]
    period: str = "5y"
    riskFreeRate: float = 0.04
    longOnly: bool = True
    maxWeight: float = 1.0
    frequency: str = "Q"  # "Q" quarterly or "M" monthly


# ----------------------------------------------------------------------------
# Shared helpers
# ----------------------------------------------------------------------------
def _clean_tickers(tickers: list[str]) -> list[str]:
    seen: list[str] = []
    for t in tickers:
        t = t.strip().upper()
        if t and t not in seen:
            seen.append(t)
    return seen


def _market_inputs(
    tickers: list[str], period: str, long_only: bool, max_weight: float
) -> tuple[MarketInputs, "pd.DataFrame"]:
    """Fetch data and build MarketInputs; raises HTTPException(422) if unusable."""
    import pandas as pd  # local import keeps module import light

    tickers = _clean_tickers(tickers)
    if len(tickers) < 2:
        raise HTTPException(422, detail="Provide at least two tickers.")
    if max_weight < 1.0 / len(tickers) - 1e-9:
        raise HTTPException(
            422,
            detail=f"maxWeight {max_weight:.0%} is infeasible with "
                   f"{len(tickers)} tickers (needs at least {1.0 / len(tickers):.0%} each).",
        )
    prices = fetch_prices(tickers, period=period)
    if prices.shape[1] < 2:
        raise HTTPException(
            422, detail="Could not fetch data for at least two tickers."
        )
    mu, cov = annualize(log_returns(prices))
    m = MarketInputs(
        tickers=list(mu.index),
        mu=mu.values,
        cov=cov.values,
        long_only=long_only,
        max_weight=max_weight,
    )
    return m, prices


def _weights_dict(m: MarketInputs, w: np.ndarray) -> dict[str, float]:
    return {t: float(x) for t, x in zip(m.tickers, w)}


def _portfolio_block(m: MarketInputs, w: np.ndarray, risk_free: float) -> dict:
    ret, vol, sharpe = portfolio_stats(m, w, risk_free)
    return {"weights": _weights_dict(m, w), "ret": ret, "vol": vol, "sharpe": sharpe}


# ----------------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/optimize")
def optimize(req: OptimizeRequest) -> dict:
    m, _ = _market_inputs(req.tickers, req.period, req.longOnly, req.maxWeight)

    w_sharpe = max_sharpe_portfolio(m, req.riskFreeRate)
    w_minvol = min_vol_portfolio(m)
    if w_sharpe is None or w_minvol is None:
        raise HTTPException(
            422, detail="Optimization failed to converge — loosen the constraints."
        )

    frontier = [
        {"vol": float(v), "ret": float(r)}
        for v, r in efficient_frontier(m, n_points=req.frontierPoints)
    ]

    # Random cloud, downsampled to <= MAX_CLOUD_POINTS for the response.
    gen_size = min(req.cloudSize, 20000)
    vols, rets, sharpes = random_cloud(m, req.riskFreeRate, size=gen_size)
    if len(vols) > MAX_CLOUD_POINTS:
        idx = np.linspace(0, len(vols) - 1, MAX_CLOUD_POINTS).astype(int)
        vols, rets, sharpes = vols[idx], rets[idx], sharpes[idx]

    asset_vols = np.sqrt(np.diag(m.cov))
    return {
        "assets": [
            {"ticker": t, "ret": float(r), "vol": float(v)}
            for t, r, v in zip(m.tickers, m.mu, asset_vols)
        ],
        "frontier": frontier,
        "cloud": {
            "vol": [float(x) for x in vols],
            "ret": [float(x) for x in rets],
            "sharpe": [float(x) for x in sharpes],
        },
        "maxSharpe": _portfolio_block(m, w_sharpe, req.riskFreeRate),
        "minVol": _portfolio_block(m, w_minvol, req.riskFreeRate),
    }


@app.post("/optimize/target")
def optimize_target(req: TargetRequest) -> dict:
    m, _ = _market_inputs(req.tickers, req.period, req.longOnly, req.maxWeight)
    w = min_vol_portfolio(m, target_return=req.targetReturn)
    if w is None:
        raise HTTPException(
            422,
            detail=f"No feasible portfolio at target return {req.targetReturn:.1%} "
                   "with the current constraints.",
        )
    return _portfolio_block(m, w, req.riskFreeRate)


@app.post("/rebalance")
def rebalance(req: RebalanceRequest) -> dict:
    if req.frequency not in ("Q", "M"):
        raise HTTPException(422, detail='frequency must be "Q" or "M".')
    m, prices = _market_inputs(
        req.tickers, req.period, req.longOnly, req.maxWeight
    )

    w_sharpe = max_sharpe_portfolio(m, req.riskFreeRate)
    if w_sharpe is None:
        raise HTTPException(
            422, detail="Optimization failed to converge — loosen the constraints."
        )

    daily = prices.pct_change().dropna()
    eq_bh, _, _ = simulate_rebalance(daily, w_sharpe)  # freq=None: never rebalance
    eq_rb, turnover, n_rebal = simulate_rebalance(daily, w_sharpe, freq=req.frequency)

    bh_stats = track_record(eq_bh, req.riskFreeRate)
    rb_stats = track_record(eq_rb, req.riskFreeRate)
    bh_stats["values"] = [float(x) for x in eq_bh]
    rb_stats["values"] = [float(x) for x in eq_rb]

    return {
        "dates": [d.strftime("%Y-%m-%d") for d in daily.index],
        "buyHold": bh_stats,
        "rebalanced": rb_stats,
        "turnover": turnover,
        "rebalances": n_rebal,
    }
