"""Cash allocation and holdings-analysis math.

Pure functions: no I/O, no FastAPI. Routes in main.py call these after
fetching the latest prices. All money figures are raw floats; the frontend
formats them per region.
"""
from __future__ import annotations

import math

# Estimated one-way trading cost, as a fraction of traded value.
# US: $0 commission at major brokerages — the remaining cost is the bid-ask spread.
# India: discount brokers charge Rs.0 brokerage on equity delivery — the cost is
#   STT (0.1% each side) + exchange + SEBI + GST + stamp duty.
# Estimates only; shown to the user next to every number that uses them.
COST_RATES = {
    "US": {
        "rate": 0.0002,
        "currency": "USD",
        "symbol": "$",
        "assumption": "US estimate: ~0.02% of traded value (bid-ask spread; $0 commission)",
    },
    "IN": {
        "rate": 0.0015,
        "currency": "INR",
        "symbol": "₹",
        "assumption": (
            "India estimate: ~0.15% of traded value "
            "(STT 0.1% + exchange/SEBI + GST + stamp duty; Rs.0 brokerage on delivery)"
        ),
    },
}

# Rebalance trigger: any holding further than this (in percentage points)
# from its target weight counts as drifted.
DRIFT_THRESHOLD = 0.05


def allocate_cash(tickers, weights, amount, latest_prices):
    """Split `amount` across `weights`: dollars, whole shares, fractional shares."""
    rows = []
    whole_cost_total = 0.0
    for t in tickers:
        w = weights[t]
        price = latest_prices[t]
        dollars = amount * w
        whole = int(math.floor(dollars / price + 1e-9))
        whole_cost = whole * price
        whole_cost_total += whole_cost
        rows.append(
            {
                "ticker": t,
                "weight": round(w, 6),
                "dollars": round(dollars, 2),
                "price": round(price, 2),
                "wholeShares": whole,
                "wholeCost": round(whole_cost, 2),
                "fractionalShares": round(dollars / price, 4),
            }
        )
    return {
        "amount": round(amount, 2),
        "allocations": rows,
        "leftoverCash": round(amount - whole_cost_total, 2),
        "explanation": (
            "Weights come from the max-Sharpe mean-variance optimization: each weight is "
            "the fraction of your money the optimizer assigns to that asset, estimated "
            "from historical returns and covariances. Dollar amounts are proportional "
            "splits of your investment. Whole shares round down, because you can't buy "
            "part of a share without fractional-share support — the remainder stays as "
            "cash. Fractional shares show the exact split if your broker supports them."
        ),
    }


def analyze_holdings(holdings, target_weights, region, latest_prices):
    """Holdings health check: P&L, drift vs target, rebalance trades + cost verdict."""
    spec = COST_RATES[region]
    rate = spec["rate"]

    items = []
    total_value = 0.0
    total_cost = 0.0
    for h in holdings:
        t = h["ticker"]
        price = latest_prices[t]
        value = h["shares"] * price
        cost = h["shares"] * h["avg_price"]
        pnl = value - cost
        total_value += value
        total_cost += cost
        items.append(
            {
                "ticker": t,
                "shares": h["shares"],
                "avgPrice": round(h["avg_price"], 2),
                "price": round(price, 2),
                "value": round(value, 2),
                "costBasis": round(cost, 2),
                "pnl": round(pnl, 2),
                "pnlPct": round(pnl / cost * 100, 2) if cost else 0.0,
            }
        )

    # Target weights, renormalized over the tickers actually held.
    held = [h["ticker"] for h in holdings]
    tw = {t: float(target_weights.get(t, 0.0) or 0.0) for t in held}
    s = sum(tw.values())
    tw = {t: (w / s if s > 0 else 1.0 / len(tw)) for t, w in tw.items()}

    max_drift = 0.0
    trades = []
    for it in items:
        t = it["ticker"]
        cur_w = it["value"] / total_value if total_value else 0.0
        tgt_w = tw[t]
        drift = cur_w - tgt_w
        max_drift = max(max_drift, abs(drift))
        target_value = total_value * tgt_w
        delta_value = target_value - it["value"]
        delta_shares = delta_value / it["price"] if it["price"] else 0.0
        it["currentWeight"] = round(cur_w, 4)
        it["targetWeight"] = round(tgt_w, 4)
        it["drift"] = round(drift, 4)
        if abs(delta_value) >= 0.01:
            trades.append(
                {
                    "ticker": t,
                    "side": "BUY" if delta_value > 0 else "SELL",
                    "deltaShares": round(abs(delta_shares), 4),
                    "deltaValue": round(abs(delta_value), 2),
                }
            )

    traded_value = sum(t["deltaValue"] for t in trades) / 2.0
    cost = traded_value * rate
    total_pnl = total_value - total_cost

    # Verdict: is the rebalance worth its cost?
    symbol = spec["symbol"]
    if max_drift <= DRIFT_THRESHOLD:
        recommend = False
        verdict = (
            "No rebalance needed — every holding is within "
            f"{DRIFT_THRESHOLD:.0%} of its target weight."
        )
    elif total_pnl <= 0:
        recommend = True
        verdict = (
            "Rebalance recommended on drift, but you're sitting on an overall loss "
            f"({symbol}{total_pnl:,.2f}) — the {symbol}{cost:,.2f} estimated cost would "
            "deepen it. Rebalance only if the drift bothers you more than the cost."
        )
    elif cost >= total_pnl:
        recommend = False
        verdict = (
            f"Not worth it: the {symbol}{cost:,.2f} estimated cost would wipe out your "
            f"{symbol}{total_pnl:,.2f} total gains."
        )
    elif cost >= 0.25 * total_pnl:
        recommend = True
        verdict = (
            f"Rebalance recommended — but note the {symbol}{cost:,.2f} estimated cost "
            f"eats {cost / total_pnl:.0%} of your {symbol}{total_pnl:,.2f} gains."
        )
    else:
        recommend = True
        verdict = (
            f"Rebalance recommended — the {symbol}{cost:,.2f} estimated cost is only "
            f"{cost / total_pnl:.0%} of your {symbol}{total_pnl:,.2f} gains."
        )

    return {
        "region": region,
        "currency": spec["currency"],
        "symbol": symbol,
        "costAssumption": spec["assumption"],
        "driftThreshold": DRIFT_THRESHOLD,
        "totalValue": round(total_value, 2),
        "totalCostBasis": round(total_cost, 2),
        "totalPnl": round(total_pnl, 2),
        "totalPnlPct": round(total_pnl / total_cost * 100, 2) if total_cost else 0.0,
        "maxDrift": round(max_drift, 4),
        "items": items,
        "trades": trades,
        "tradedValue": round(traded_value, 2),
        "estimatedCost": round(cost, 2),
        "recommendRebalance": recommend,
        "verdict": verdict,
    }
