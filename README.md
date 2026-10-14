# Portfolio Optimizer

Interactive Markowitz mean-variance portfolio optimizer on real market data.
Type tickers → efficient frontier, max-Sharpe / min-volatility / target-return
portfolios, and a buy-and-hold vs rebalanced backtest. Built as three
services to mirror a real production stack.

> **Origin:** this started as a single-file Streamlit prototype (`prototype/`,
> kept as reference). The math was then ported verbatim into the Python
> quant-service below — no new math was invented in the rewrite.

## Architecture

```
┌──────────────┐      ┌──────────────┐      ┌──────────────────┐
│   frontend   │─────▶│   backend    │─────▶│  quant-service   │
│ React + Vite │ /api │ Spring Boot  │ JSON │ FastAPI + scipy  │
│ plotly.js    │      │  (Java 17)   │      │  (Python)        │
│   :3000      │      │    :8080     │      │    :8000         │
└──────────────┘      └──────────────┘      └──────────────────┘
        ▲                                          │ yfinance
        │ nginx proxies /api/*                     ▼ (or synthetic
        │ to backend in Docker               market-data fallback)
```

| Service | Role | Showcases |
|---|---|---|
| `quant-service/` | The quant engine. Owns **all** the math: data fetch, SLSQP optimization (efficient frontier, max-Sharpe, min-vol, target-return), random-portfolio cloud, rebalance simulation with turnover. Stateless JSON API. | Python, numpy/pandas/scipy, FastAPI, API design, quantitative finance |
| `backend/` | Thin API/orchestration layer. Forwards `/api/*` to the quant-service via `WebClient`, maps quant errors (e.g. 422 infeasible constraints) back to the client, exposes `/api/health` with quant liveness. | Java 17, Spring Boot 3, WebClient, Jackson DTOs, CORS |
| `frontend/` | The UI. Inputs panel, frontier chart (cloud + frontier + max-Sharpe ★ + min-vol ◆ + asset labels), portfolio weights with CSV download, rebalance comparison with equity curves and turnover. | React, Vite, plotly.js, data viz, UX |

## Run it

### Option A — Docker Compose (recommended, one command)

```bash
docker compose up --build
```

- UI: http://localhost:3000
- Backend: http://localhost:8080/api/health
- Quant service: http://localhost:8000/health

Nginx serves the built frontend and proxies `/api/*` to the backend, so the
browser never needs CORS in the composed stack.

### Option B — local dev (three terminals)

```bash
# 1. quant-service
cd quant-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000

# 2. backend (needs Java 17 + Maven)
cd backend
QUANT_SERVICE_URL=http://localhost:8000 mvn spring-boot:run

# 3. frontend (needs Node 20)
cd frontend
npm install
npm run dev          # http://localhost:5173, /api proxied to :8080
```

Market data comes from Yahoo Finance via `yfinance`. If the network is
unavailable, the quant-service falls back to synthetic data so the app still
works (useful for demos).

## API summary

Base URLs: quant-service direct (`:8000`) or through the backend (`:8080/api`).

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/health` | — | `{"status":"ok"}` (backend: also `"quant":"up\|down"`) |
| `POST` | `/optimize` | `{tickers, period, riskFreeRate, longOnly, maxWeight, frontierPoints, cloudSize}` | `assets`, `frontier`, `cloud{vol,ret,sharpe}`, `maxSharpe`, `minVol` |
| `POST` | `/optimize/target` | `/optimize` body + `targetReturn` | `{weights, ret, vol, sharpe}` or **422** if infeasible |
| `POST` | `/rebalance` | `{tickers, period, riskFreeRate, longOnly, maxWeight, frequency:"Q"\|"M"}` | `dates`, `buyHold{values,final,cagr,sharpe,maxDrawdown}`, `rebalanced{...}`, `turnover`, `rebalances` |

Validation: ≥2 tickers required; `maxWeight` must be ≥ 1/nTickers — otherwise
**422** with `{"detail": "..."}`. The random cloud is downsampled to ≤3000
points in the response.

Example:

```bash
curl -s localhost:8000/optimize -H 'Content-Type: application/json' -d \
 '{"tickers":["SPY","QQQ","TLT"],"period":"5y","riskFreeRate":0.04,
   "longOnly":true,"maxWeight":1.0,"frontierPoints":40,"cloudSize":3000}' \
 | python -m json.tool | head -30
```

## Repo layout

```
portfolio-project/
├── quant-service/      # FastAPI quant engine (app/main.py, app/quant.py, app/data.py)
├── backend/            # Spring Boot 3 / Java 17 (pom.xml, src/..., Dockerfile)
├── frontend/           # React + Vite + plotly.js (src/..., Dockerfile, nginx.conf)
├── prototype/          # Original Streamlit prototype — reference only
├── SCOPES.md           # Decision record: why the optimizer won
├── docker-compose.yml
└── README.md
```

## Notes & honesty

- The optimizer maximizes Sharpe against a user-set risk-free rate and uses
  **historical** mean returns — fine for a demo, not investment advice.
- Rebalance turnover is reported as a cost proxy; real trading costs would eat
  into the rebalanced line.

## Resume / LinkedIn angle

One project, three talking points: a Python quant engine with real
optimization math (numpy/scipy, FastAPI), a Spring Boot orchestration layer
(WebClient, typed DTOs, error mapping), and a React data-viz frontend
(plotly.js) — all wired together with Docker Compose. The live demo URL goes
on the profile; the architecture goes in the interview.
