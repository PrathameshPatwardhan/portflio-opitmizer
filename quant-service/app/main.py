"""Quant service — FastAPI wrapper around the quant engine.

Stateless JSON API; all heavy math lives in app/quant.py.
MySQL integration: POST /ingest (manual refresh), GET /universe,
and a `source` toggle (mysql | live | auto) on the optimize endpoints.
"""
from __future__ import annotations

import numpy as np
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .data import annualize, fetch_bars, fetch_prices, log_returns
from .quant import (
    MarketInputs,
    cvar_portfolio,
    efficient_frontier,
    empirical_cvar,
    max_sharpe_portfolio,
    min_vol_portfolio,
    portfolio_stats,
    random_cloud,
    simulate_rebalance,
    track_record,
)
from .store import (
    StoreUnavailable,
    db_available,
    get_last_ingest,
    get_prices as db_get_prices,
    log_ingest_run,
    search_universe,
    upsert_company,
    get_universe,
    init_db,
    log_ingest_run,
    upsert_company,
    upsert_prices,
)
from .universe import SEED_UNIVERSE
from .allocate import COST_RATES, allocate_cash, analyze_holdings

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
    source: str = "live"


class TargetRequest(OptimizeRequest):
    targetReturn: float

class CvarRequest(OptimizeRequest):
    alpha: float = Field(default=0.95, ge=0.5, le=0.995)

class RebalanceRequest(BaseModel):
    tickers: list[str]
    period: str = "5y"
    riskFreeRate: float = 0.04
    longOnly: bool = True
    maxWeight: float = 1.0
    frequency: str = "Q"  # "Q" quarterly or "M" monthly
    source: str = "live"


class IngestRequest(BaseModel):
    tickers: list[str] = Field(default_factory=list)  # empty = full universe
    period: str = "5y"

class UniverseAddRequest(BaseModel):
    ticker: str
    name: str | None = None

class AllocateRequest(BaseModel):
    tickers: list[str]
    weights: dict[str, float]
    amount: float


class HoldingInput(BaseModel):
    ticker: str
    shares: float = Field(gt=0)
    avg_price: float = Field(gt=0)


class HoldingsAnalyzeRequest(BaseModel):
    holdings: list[HoldingInput]
    target_weights: dict[str, float] = Field(default_factory=dict)
    region: str = "US"


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


def _prices_for(tickers: list[str], period: str, source: str) -> tuple["pd.DataFrame", str]:
    """Resolve prices per the requested source. Returns (prices, data_source)."""
    import pandas as pd

    if source not in ("mysql", "live", "auto"):
        raise HTTPException(422, detail='source must be "mysql", "live", or "auto".')
    if source == "live":
        return fetch_prices(tickers, period=period), "live"

    # mysql or auto: try the database first
    try:
        db = db_get_prices(tickers)
    except StoreUnavailable as e:
        if source == "mysql":
            raise HTTPException(503, detail=str(e))
        return fetch_prices(tickers, period=period), "live"  # auto falls back

    missing = [t for t in tickers if t not in db.columns]
    fresh = not db.empty and (
            pd.Timestamp.today().normalize() - db.index.max().normalize()
    ).days <= 7
    if not missing and fresh and db.shape[1] >= 2:
        return _slice_period(db, period), "mysql"

    if source == "mysql":
        problems = []
        if missing:
            problems.append(f"no MySQL data for: {', '.join(missing)}")
        if not fresh:
            problems.append("MySQL data is stale (older than 7 days)")
        raise HTTPException(
            422, detail="; ".join(problems) + ". Use source=live or refresh via POST /ingest."
        )
    return fetch_prices(tickers, period=period), "live"  # auto falls back


def _slice_period(prices: "pd.DataFrame", period: str) -> "pd.DataFrame":
    import pandas as pd

    months = {"1mo": 1, "3mo": 3, "6mo": 6, "1y": 12, "2y": 24, "5y": 60, "10y": 120}.get(period)
    if not months:
        return prices
    cutoff = prices.index.max() - pd.DateOffset(months=months)
    return prices[prices.index >= cutoff]


def _market_inputs(
        tickers: list[str], period: str, long_only: bool, max_weight: float, source: str = "live"
) -> tuple[MarketInputs, "pd.DataFrame", str]:
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
    prices, data_source = _prices_for(tickers, period, source)
    if prices.shape[1] < 2:
        raise HTTPException(
            422, detail="Could not get data for at least two tickers."
        )
    mu, cov = annualize(log_returns(prices))
    m = MarketInputs(
        tickers=list(mu.index),
        mu=mu.values,
        cov=cov.values,
        long_only=long_only,
        max_weight=max_weight,
    )
    return m, prices, data_source


def _weights_dict(m: MarketInputs, w: np.ndarray) -> dict[str, float]:
    return {t: float(x) for t, x in zip(m.tickers, w)}


def _portfolio_block(m: MarketInputs, w: np.ndarray, risk_free: float) -> dict:
    ret, vol, sharpe = portfolio_stats(m, w, risk_free)
    return {"weights": _weights_dict(m, w), "ret": ret, "vol": vol, "sharpe": sharpe}

def _latest_prices(tickers: list[str]) -> dict[str, float]:
    """Most recent close per ticker; 422 if any ticker has no recent price."""
    prices = fetch_prices(tickers, period="1mo")
    latest: dict[str, float] = {}
    for t in tickers:
        if t not in prices.columns:
            continue
        series = prices[t].dropna()
        if not series.empty:
            latest[t] = float(series.iloc[-1])
    missing = [t for t in tickers if t not in latest]
    if missing:
        raise HTTPException(422, detail=f"No recent price for: {', '.join(missing)}.")
    return latest


# ----------------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------------
@app.on_event("startup")
def _startup() -> None:
    try:
        init_db()  # create tables if missing; tolerate MySQL being down
    except StoreUnavailable:
        pass


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "db": "up" if db_available() else "down"}


@app.post("/ingest")
def ingest(req: IngestRequest) -> dict:
    """Manual refresh: fetch yfinance bars and store them in MySQL.

    Idempotent — re-ingesting overwrites the same (ticker, date) rows.
    """
    tickers = _clean_tickers(req.tickers) or [c["ticker"] for c in SEED_UNIVERSE]
    ok: list[str] = []
    failed: list[str] = []
    total = 0
    try:
        for t in tickers:
            bars = fetch_bars(t, period=req.period)
            if bars.empty:
                failed.append(t)
                continue
            total += upsert_prices(t, bars)
            ok.append(t)
        for t in ok:
            meta = next((c for c in SEED_UNIVERSE if c["ticker"] == t), None)
            if meta:
                upsert_company(t, meta["name"], meta["sector"], meta["exchange"])
            else:
                upsert_company(t, t, "—", "")

        log_ingest_run(ok, total, status="ok" if not failed else "partial")
    except StoreUnavailable as e:
        raise HTTPException(503, detail=str(e))
    return {"tickers": ok, "failed": failed, "rowsUpserted": total}


def _yahoo_reachable(timeout: int = 10) -> bool:
    """Lightweight Yahoo reachability probe (single chart request)."""
    try:
        r = requests.get(
            "https://query1.finance.yahoo.com/v8/finance/chart/SPY",
            params={"interval": "1d", "range": "5d"},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=timeout,
        )
        return r.status_code == 200
    except Exception:
        return False

def _yahoo_ticker_meta(ticker: str, timeout: int = 10) -> tuple[str | None, str | None]:
    """(display name, error_kind) via Yahoo's chart API.
    error_kind: None = data exists; 'not-found' = no such ticker;
    'unknown' = the check itself failed (rate-limit/timeout)."""
    try:
        r = requests.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}",
            params={"interval": "1d", "range": "5d"},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=timeout,
        )
        if r.status_code == 200:
            results = (r.json().get("chart") or {}).get("result")
            if not results:
                return None, "not-found"
            res = results[0]
            # Symbols like DJI return a meta shell with no price timestamps — not tradable
            if not res.get("timestamp"):
                return None, "not-found"
            meta = res.get("meta") or {}
            return meta.get("longName") or meta.get("shortName") or ticker, None
        if r.status_code in (429, 401, 403):
            return None, "unknown"
        return None, "not-found"
    except Exception:
        return None, "unknown"

def _safe_last_ingest() -> dict | None:
    try:
        return get_last_ingest()
    except StoreUnavailable:
        return None



@app.get("/universe")
def universe(q: str | None = None) -> dict:
    """Ticker list for the dropdown: Yahoo-first, SQL fallback. ?q= filters server-side."""
    if q and q.strip():
        try:
            return {"companies": search_universe(q.strip(), limit=50),
                    "lastIngest": _safe_last_ingest(), "source": "sql"}
        except StoreUnavailable as e:
            raise HTTPException(503, detail=str(e))
    seed = list(SEED_UNIVERSE)
    if _yahoo_reachable():
        for c in seed:
            try:
                upsert_company(c["ticker"], c["name"], c.get("sector", "—"), c.get("exchange", ""))
            except StoreUnavailable:
                break
        try:
            companies = get_universe()
        except StoreUnavailable:
            companies = [
                {"ticker": c["ticker"], "name": c["name"], "sector": c.get("sector", "—"),
                 "rows": 0, "startDate": None, "endDate": None}
                for c in seed
            ]
        return {"companies": companies, "lastIngest": _safe_last_ingest(), "source": "yahoo"}
    try:
        return {"companies": get_universe(), "lastIngest": get_last_ingest(), "source": "sql"}
    except StoreUnavailable as e:
        raise HTTPException(503, detail=str(e))

@app.get("/universe/validate")
def universe_validate(ticker: str) -> dict:
    """Pre-check a custom ticker against Yahoo Finance. Always 200:
    status is 'ok' | 'invalid' | 'unknown' (couldn't verify)."""
    t = ticker.strip().upper()
    if not t:
        raise HTTPException(422, detail="ticker is required")
    name, err = _yahoo_ticker_meta(t)
    if err == "not-found":
        return {"ticker": t, "status": "invalid",
                "message": f"No market data for {t} on Yahoo Finance. "
                           f"Check the symbol — non-US stocks need an exchange suffix "
                           f"(e.g. RELIANCE.NS), indices need a ^ prefix (e.g. ^DJI)."}
    if err == "unknown":
        return {"ticker": t, "status": "unknown"}
    return {"ticker": t, "status": "ok", "name": name}

@app.post("/universe", status_code=201)
def universe_add(req: UniverseAddRequest) -> dict:
    """Register a custom ticker in the companies table (no price fetch)."""
    ticker = req.ticker.strip().upper()
    if not ticker:
        raise HTTPException(422, detail="ticker is required")
    name = (req.name or "").strip() or ticker
    try:
        upsert_company(ticker, name, "—", "")
        return {"ticker": ticker, "name": name}
    except StoreUnavailable as e:
        raise HTTPException(503, detail=str(e))

@app.get("/ingest/last")
def ingest_last() -> dict:
    try:
        return {"lastIngest": get_last_ingest()}
    except StoreUnavailable as e:
        raise HTTPException(503, detail=str(e))


@app.post("/optimize")
def optimize(req: OptimizeRequest) -> dict:
    m, _, data_source = _market_inputs(req.tickers, req.period, req.longOnly, req.maxWeight, req.source)

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
        "dataSource": data_source,
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
    m, _, data_source = _market_inputs(req.tickers, req.period, req.longOnly, req.maxWeight, req.source)
    w = min_vol_portfolio(m, target_return=req.targetReturn)
    if w is None:
        raise HTTPException(
            422,
            detail=f"No feasible portfolio at target return {req.targetReturn:.1%} "
                   "with the current constraints.",
        )
    result = _portfolio_block(m, w, req.riskFreeRate)
    result["dataSource"] = data_source
    return result

@app.post("/optimize/cvar")
def optimize_cvar(req: CvarRequest) -> dict:
    """Minimum-tail-risk portfolio: minimizes CVaR_alpha of the loss.

    Scenarios are the historical daily log returns behind the current
    tickers/period/source selection, so the tail being minimized is the
    actual left tail this portfolio lived through.
    """
    m, prices, data_source = _market_inputs(req.tickers, req.period, req.longOnly, req.maxWeight, req.source)
    R = log_returns(prices).dropna()[m.tickers].to_numpy()
    w_cvar, _ = cvar_portfolio(R, m, alpha=req.alpha)
    w_sharpe = max_sharpe_portfolio(m, req.riskFreeRate)
    if w_cvar is None or w_sharpe is None:
        raise HTTPException(
            422, detail="Tail-risk optimization failed to converge — loosen the constraints."
        )
    # CVaR is positively homogeneous: annual CVaR = 252 x daily CVaR.
    daily_cvar = lambda w: empirical_cvar(R, w, req.alpha)
    min_cvar = _portfolio_block(m, w_cvar, req.riskFreeRate)
    min_cvar["cvar"] = daily_cvar(w_cvar)
    max_sharpe = _portfolio_block(m, w_sharpe, req.riskFreeRate)
    max_sharpe["cvar"] = daily_cvar(w_sharpe)

return {
        "dataSource": data_source,
        "alpha": req.alpha,
        "minCvar": min_cvar,
        "maxSharpe": max_sharpe,
    }


@app.post("/rebalance")
def rebalance(req: RebalanceRequest) -> dict:
    if req.frequency not in ("Q", "M"):
        raise HTTPException(422, detail='frequency must be "Q" or "M".')
    m, prices, data_source = _market_inputs(
        req.tickers, req.period, req.longOnly, req.maxWeight, req.source
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
        "dataSource": data_source,
        "dates": [d.strftime("%Y-%m-%d") for d in daily.index],
        "buyHold": bh_stats,
        "rebalanced": rb_stats,
        "turnover": turnover,
        "rebalances": n_rebal,
    }

@app.post("/allocate")
def allocate(req: AllocateRequest) -> dict:
    """Split a cash amount across optimized weights: dollars + whole/fractional shares."""
    tickers = _clean_tickers(req.tickers)
    if not tickers:
        raise HTTPException(422, detail="Provide at least one ticker.")
    if req.amount <= 0:
        raise HTTPException(422, detail="Amount must be greater than 0.")
    weights = {t: float(req.weights.get(t, 0.0) or 0.0) for t in tickers}
    if sum(weights.values()) <= 0:
        raise HTTPException(422, detail="Weights must sum to a positive value.")
    s = sum(weights.values())
    weights = {t: w / s for t, w in weights.items()}  # normalize defensively
    return allocate_cash(tickers, weights, req.amount, _latest_prices(tickers))


@app.post("/holdings/analyze")
def holdings_analyze(req: HoldingsAnalyzeRequest) -> dict:
    """Holdings health check: P&L, drift vs target weights, rebalance cost verdict."""
    region = req.region.strip().upper()
    if region not in COST_RATES:
        raise HTTPException(422, detail='region must be "US" or "IN".')
    if not req.holdings:
        raise HTTPException(422, detail="Provide at least one holding.")
    holdings = [
        {"ticker": h.ticker.strip().upper(), "shares": h.shares, "avg_price": h.avg_price}
        for h in req.holdings
    ]
    tickers = _clean_tickers([h["ticker"] for h in holdings])
    return analyze_holdings(holdings, req.target_weights, region, _latest_prices(tickers))
