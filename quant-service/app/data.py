"""Market data helpers.

fetch_prices() pulls adjusted closes via yfinance. If the network is
unavailable it falls back to synthetic geometric-Brownian-motion prices so
the service still responds (useful for demos and offline dev).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

try:
    import yfinance as yf

    _HAS_YF = True
except ImportError:  # pragma: no cover
    _HAS_YF = False


def _synthetic_prices(tickers: list[str], periods: int = 1260, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range(end=pd.Timestamp.today().normalize(), periods=periods)
    frames = {}
    for i, t in enumerate(tickers):
        drift = 0.0004 + 0.0002 * i
        vol = 0.012 + 0.004 * (i % 3)
        rets = rng.normal(drift, vol, size=periods)
        frames[t] = 100.0 * np.exp(np.cumsum(rets))
    return pd.DataFrame(frames, index=dates)


def fetch_prices(tickers: list[str], period: str = "5y") -> pd.DataFrame:
    """Return a DataFrame of adjusted-close prices, one column per ticker."""
    tickers = [t.strip().upper() for t in tickers if t.strip()]
    if not tickers:
        raise ValueError("Provide at least one ticker.")

    if _HAS_YF:
        try:
            df = yf.download(
                tickers, period=period, auto_adjust=True, progress=False
            )["Close"]
            if isinstance(df, pd.Series):
                df = df.to_frame(tickers[0])
            df = df.dropna(how="all").dropna(axis=1, how="all")
            if not df.empty:
                return df
        except Exception:
            pass  # fall through to synthetic data

    return _synthetic_prices(tickers)


def log_returns(prices: pd.DataFrame) -> pd.DataFrame:
    return np.log(prices / prices.shift(1)).dropna()


def annualize(rets: pd.DataFrame, trading_days: int = 252) -> tuple[pd.Series, pd.DataFrame]:
    """Annualized mean returns and covariance matrix from daily log returns."""
    mu = rets.mean() * trading_days
    cov = rets.cov() * trading_days
    return mu, cov

def fetch_bars(ticker: str, period: str = "5y") -> pd.DataFrame:
    """Daily OHLCV bars for ONE ticker via yfinance (auto-adjusted).

    Returns a DataFrame indexed by date with columns
    open/high/low/close/adj_close/volume. Empty DataFrame on failure.
    """
    if not _HAS_YF:
        return pd.DataFrame()
    try:
        df = yf.download(ticker, period=period, auto_adjust=True, progress=False)
        if df.empty:
            return pd.DataFrame()
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        df = df.rename(columns=str.lower)
        df["adj_close"] = df["close"]  # auto_adjust=True already adjusts OHLC
        return df[["open", "high", "low", "close", "adj_close", "volume"]].dropna()
    except Exception:
        return pd.DataFrame()

