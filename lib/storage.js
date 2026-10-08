// All persistence is local to the browser. Nothing leaves the device.

const KEY = "signal_lab_history_v1";

export function loadSignals() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveSignal(signal) {
  const all = loadSignals();
  all.unshift(signal); // newest first
  window.localStorage.setItem(KEY, JSON.stringify(all));
  return all;
}

export function updateSignal(id, patch) {
  const all = loadSignals();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return all;
  all[idx] = { ...all[idx], ...patch };
  window.localStorage.setItem(KEY, JSON.stringify(all));
  return all;
}

export function clearSignals() {
  window.localStorage.removeItem(KEY);
}

// Also keep a rolling raw price history per asset, used to build real candles
// over time instead of only synthetic ones.
function priceHistoryKey(asset) {
  return `signal_lab_price_history_${asset}`;
}

export function loadPriceHistory(asset) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(priceHistoryKey(asset));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function appendPriceHistory(asset, point) {
  const hist = loadPriceHistory(asset);
  hist.push(point);
  // keep last 500 points max
  const trimmed = hist.slice(-500);
  window.localStorage.setItem(priceHistoryKey(asset), JSON.stringify(trimmed));
  return trimmed;
}

export function computeStats(signals, assetFilter) {
  const relevant = signals.filter(
    (s) => (!assetFilter || s.asset === assetFilter) && s.decision !== "NO_SIGNAL"
  );
  const evaluated = relevant.filter((s) => s.outcomePct !== undefined && s.outcomePct !== null);
  const wins = evaluated.filter((s) => s.outcomePct > 0);
  const totalPnlOn100 = evaluated.reduce((sum, s) => sum + (s.outcomePct / 100) * 100, 0);

  return {
    totalSignals: relevant.length,
    evaluatedCount: evaluated.length,
    pendingCount: relevant.length - evaluated.length,
    winCount: wins.length,
    winRate: evaluated.length ? (wins.length / evaluated.length) * 100 : null,
    totalPnlOn100,
  };
}
