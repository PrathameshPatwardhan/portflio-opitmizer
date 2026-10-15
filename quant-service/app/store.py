"""MySQL persistence for market data (quant-service).

Tables:
  companies   - curated universe: ticker, name, sector, exchange, added_at
  prices      - daily bars: (ticker, date) PK, OHLC, adj_close, volume
  ingest_runs - one row per manual ingest: when, tickers, rows, status

Writes happen ONLY from POST /ingest (the manual Refresh button).
Reads never write. If MySQL is unreachable, helpers raise StoreUnavailable
and the API layer turns that into a 503 / live fallback.
"""
from __future__ import annotations

import os
from datetime import datetime

import pandas as pd
from sqlalchemy import (
    BigInteger, Column, Date, DateTime, Float, Integer, String, Text,
    create_engine, func, select, text,
)
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "mysql+pymysql://root:@localhost:3306/portfolio"
)


class Base(DeclarativeBase):
    pass


class Company(Base):
    __tablename__ = "companies"
    ticker = Column(String(20), primary_key=True)
    name = Column(String(200), nullable=False)
    sector = Column(String(100), default="—")
    exchange = Column(String(50), default="")
    added_at = Column(DateTime, default=datetime.utcnow)


class Price(Base):
    __tablename__ = "prices"
    ticker = Column(String(20), primary_key=True)
    date = Column(Date, primary_key=True)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    adj_close = Column(Float)
    volume = Column(BigInteger)


class IngestRun(Base):
    __tablename__ = "ingest_runs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    tickers = Column(Text)
    rows_upserted = Column(Integer, default=0)
    status = Column(String(20), default="ok")


class StoreUnavailable(Exception):
    """MySQL can't be reached."""


_ENGINE = None


def _engine():
    global _ENGINE
    if _ENGINE is None:
        try:
            eng = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=3600)
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            _ENGINE = eng
        except SQLAlchemyError as e:
            raise StoreUnavailable(f"MySQL unreachable ({DATABASE_URL}): {e}")
    return _ENGINE


def _session():
    return sessionmaker(bind=_engine())()


def db_available() -> bool:
    try:
        _session().close()
        return True
    except StoreUnavailable:
        return False


def init_db() -> None:
    """Create tables if they don't exist. Safe to call on every startup."""
    Base.metadata.create_all(_engine())


def upsert_company(ticker: str, name: str, sector: str = "—", exchange: str = "") -> None:
    sess = _session()
    try:
        stmt = mysql_insert(Company).values(
            ticker=ticker, name=name, sector=sector, exchange=exchange,
            added_at=datetime.utcnow(),
        )
        stmt = stmt.on_duplicate_key_update(
            name=stmt.inserted.name, sector=stmt.inserted.sector,
            exchange=stmt.inserted.exchange,
        )
        sess.execute(stmt)
        sess.commit()
    finally:
        sess.close()


def upsert_prices(ticker: str, bars: pd.DataFrame) -> int:
    """Upsert daily bars for one ticker. bars indexed by date with columns
    open/high/low/close/adj_close/volume. Idempotent: re-ingesting the same
    dates overwrites them. Returns rows written."""
    bars = bars.dropna()
    rows = [
        {
            "ticker": ticker,
            "date": idx.date(),
            "open": float(r["open"]),
            "high": float(r["high"]),
            "low": float(r["low"]),
            "close": float(r["close"]),
            "adj_close": float(r["adj_close"]),
            "volume": int(r["volume"]),
        }
        for idx, r in bars.iterrows()
    ]
    if not rows:
        return 0
    sess = _session()
    try:
        stmt = mysql_insert(Price).values(rows)
        stmt = stmt.on_duplicate_key_update(
            open=stmt.inserted.open, high=stmt.inserted.high,
            low=stmt.inserted.low, close=stmt.inserted.close,
            adj_close=stmt.inserted.adj_close, volume=stmt.inserted.volume,
        )
        sess.execute(stmt)
        sess.commit()
    finally:
        sess.close()
    return len(rows)


def get_prices(tickers: list[str]) -> pd.DataFrame:
    """Adjusted-close prices from MySQL, same shape as fetch_prices():
    date index, one column per ticker. Tickers with no rows are absent."""
    sess = _session()
    try:
        stmt = (
            select(Price.ticker, Price.date, Price.adj_close)
            .where(Price.ticker.in_(tickers))
            .order_by(Price.date)
        )
        frames: dict[str, list] = {}
        for t, d, adj in sess.execute(stmt):
            frames.setdefault(t, []).append((d, adj))
    finally:
        sess.close()
    out = {}
    for t, pairs in frames.items():
        s = pd.Series({d: v for d, v in pairs})
        s.index = pd.to_datetime(s.index)
        out[t] = s.sort_index()
    if not out:
        return pd.DataFrame()
    return pd.DataFrame(out).sort_index()

def get_universe() -> list[dict]:
    """Per-ticker coverage: rows, first/last date (None when no rows)."""
    sess = _session()
    try:
        result = []
        for c in sess.query(Company).order_by(Company.ticker).all():
            rows, start, end = sess.query(
                func.count(Price.date), func.min(Price.date), func.max(Price.date)
            ).filter(Price.ticker == c.ticker).one()
            result.append({
                "ticker": c.ticker, "name": c.name, "sector": c.sector,
                "rows": int(rows),
                "startDate": start.isoformat() if start else None,
                "endDate": end.isoformat() if end else None,
            })
        return result
    finally:
        sess.close()

def search_universe(query: str, limit: int = 50) -> list[dict]:
    """Per-ticker coverage filtered by ticker/name substring (case-insensitive)."""
    sess = _session()
    try:
        q = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        like = f"%{q}%"
        companies = (
            sess.query(Company)
            .filter((Company.ticker.ilike(like, escape="\\")) |
                    (Company.name.ilike(like, escape="\\")))
            .order_by(Company.ticker)
            .limit(limit)
            .all()
        )
        result = []
        for c in companies:
            rows, start, end = sess.query(
                func.count(Price.date), func.min(Price.date), func.max(Price.date)
            ).filter(Price.ticker == c.ticker).one()
            result.append({
                "ticker": c.ticker, "name": c.name, "sector": c.sector,
                "rows": int(rows),
                "startDate": start.isoformat() if start else None,
                "endDate": end.isoformat() if end else None,
            })
        return result
    finally:
        sess.close()

def log_ingest_run(tickers: list[str], rows_upserted: int, status: str = "ok") -> None:
    sess = _session()
    try:
        sess.add(IngestRun(tickers=",".join(tickers),
                           rows_upserted=rows_upserted, status=status))
        sess.commit()
    finally:
        sess.close()


def get_last_ingest() -> dict | None:
    sess = _session()
    try:
        run = sess.query(IngestRun).order_by(IngestRun.id.desc()).first()
        if run is None:
            return None
        return {
            "startedAt": run.started_at.isoformat() if run.started_at else None,
            "tickers": run.tickers, "rowsUpserted": run.rows_upserted,
            "status": run.status,
        }
    finally:
        sess.close()
