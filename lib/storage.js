const KEY = "signal_lab_trades_v2";
export const STAKE = 100;

export function loadTrades() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function write(all) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch (e) {}
}

export function addTrade(trade) {
  const all = loadTrades();
  all.unshift(trade);
  write(all);
  return all;
}

export function closeTrade(id, exitPrice) {
  const all = loadTrades().map((t) =>
    t.id === id ? { ...t, closed: true, exitPrice, closedAt: Date.now() } : t
  );
  write(all);
  return all;
}

export function clearTrades() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (e) {}
}

// سود/زیان یک معامله (روی STAKE دلار). برای "رد کردن" null برمی‌گرداند.
export function calcPnl(trade, currentPrice) {
  if (trade.action === "SKIP") return null;
  const price = trade.closed ? trade.exitPrice : currentPrice;
  if (typeof price !== "number") return null;
  const dir = trade.action === "BUY" ? 1 : -1;
  const pct = ((price - trade.entryPrice) / trade.entryPrice) * 100 * dir;
  return { pct, usd: (pct / 100) * STAKE, price };
}

export function computeStats(trades, prices) {
  const real = trades.filter((t) => t.action !== "SKIP");
  let wins = 0;
  let totalUsd = 0;
  let counted = 0;
  real.forEach((t) => {
    const p = calcPnl(t, prices[t.assetId]);
    if (p) {
      counted += 1;
      totalUsd += p.usd;
      if (p.usd > 0) wins += 1;
    }
  });
  return {
    tradeCount: real.length,
    skipCount: trades.length - real.length,
    counted,
    wins,
    winRate: counted ? (wins / counted) * 100 : null,
    totalUsd,
  };
}