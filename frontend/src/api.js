// Tiny API client. In dev, requests go to the Vite proxy (/api -> :8080).
// Set VITE_API_URL to call the backend directly (e.g. a deployed backend URL).
const BASE = import.meta.env.VITE_API_URL || "";

async function postJson(path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

/** Shape the sidebar inputs into the /optimize request body. */
export function buildOptimizeBody(inputs) {
  return {
    tickers: inputs.tickers
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean),
    period: inputs.period,
    riskFreeRate: inputs.riskFreeRate / 100,
    longOnly: inputs.longOnly,
    maxWeight: inputs.maxWeight / 100,
    frontierPoints: 40,
    cloudSize: 3000,
  };
}

export const optimize = (body) => postJson("/optimize", body);
export const optimizeTarget = (body) => postJson("/optimize/target", body);

export function rebalance(inputs, frequency) {
  const b = buildOptimizeBody(inputs);
  return postJson("/rebalance", {
    tickers: b.tickers,
    period: b.period,
    riskFreeRate: b.riskFreeRate,
    longOnly: b.longOnly,
    maxWeight: b.maxWeight,
    frequency,
  });
}

export async function health() {
  const res = await fetch(`${BASE}/api/health`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
