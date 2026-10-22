// Tiny API client. In dev, requests go to the Vite proxy (/api -> :8080).
// Set VITE_API_URL to call the backend directly (e.g. a deployed backend URL).
const BASE = import.meta.env.VITE_API_URL || "";

const TOKEN_KEY = "po-token";

/** Authorization header when logged in; empty object when logged out. */
function authHeaders() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function postJson(path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function getJson(path) {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function deleteJson(path) {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}
async function toAuthError(res, fallback) {
  let detail = '';
  try {
    const body = await res.json();
    detail = body.message || '';
  } catch { /* non-JSON body */ }
  const err = new Error(detail || fallback);
  err.status = res.status;
  return err;
}

export async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw await toAuthError(res, 'Login failed');
  const data = await res.json();
  localStorage.setItem('token', data.token);
  return data;
}


/** Shape the sidebar inputs into the /optimize request body. */
export function buildOptimizeBody(inputs) {
  return {
    tickers: (Array.isArray(inputs.tickers)
            ? inputs.tickers
            : inputs.tickers.split(",")
    ).map((t) => t.trim().toUpperCase()).filter(Boolean),
    period: inputs.period,
    riskFreeRate: inputs.riskFreeRate / 100,
    longOnly: inputs.longOnly,
    maxWeight: inputs.maxWeight / 100,
    frontierPoints: 40,
    cloudSize: 3000,
    source: inputs.source || "live",
  };
}

export const optimize = (body) => postJson("/optimize", body);
export const optimizeTarget = (body) => postJson("/optimize/target", body);
export function optimizeCvar(inputs, alpha = 0.95) {
  return postJson("/optimize/cvar", { ...buildOptimizeBody(inputs), alpha });
}
export const validateUniverseTicker = (ticker) =>
    getJson(`/universe/validate?ticker=${encodeURIComponent(ticker)}`);
export const addUniverseTicker = (ticker, name) => postJson("/universe", { ticker, name });

// NOTE: App.jsx's refresh button calls ingest() but this export was missing —
// that made the Refresh button crash with a ReferenceError. Added here.
export const ingest = (body) => postJson("/ingest", body);

export function rebalance(inputs, frequency) {
  const b = buildOptimizeBody(inputs);
  return postJson("/rebalance", {
    tickers: b.tickers,
    period: b.period,
    riskFreeRate: b.riskFreeRate,
    longOnly: b.longOnly,
    maxWeight: b.maxWeight,
    source: b.source,
    frequency,
  });
}

export const universe = (q) => getJson(q ? `/universe?q=${encodeURIComponent(q)}` : "/universe");

export async function health() {
  const res = await fetch(`${BASE}/api/health`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const signup = (email, password) => postJson("/auth/signup", { email, password });
export const me = () => getJson("/auth/me");

export const listPortfolios = () => getJson("/portfolios");
export const savePortfolio = (name, payload) => postJson("/portfolios", { name, payload });
export const deletePortfolio = (id) => deleteJson(`/portfolios/${id}`);
