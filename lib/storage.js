import { fmtPrice } from "./assets";

const KEY = "signal_lab_trades_v4";

// ---------- تنظیمات (قابل‌ویرایش) ----------
export const START_BALANCE = 100; // سرمایه‌ی فرضی هر استراتژی (دلار)
export const RISK_PCT = 2; // ریسک هر معامله (درصد موجودی)
export const MAX_POSITION_PCT = 25; // سقف حجم هر معامله (درصد موجودی)
export const MAX_OPEN_TRADES = 4; // حداکثر معامله‌ی باز برای هر استراتژی
export const MIN_TRADE_USD = 1; // حداقل حجم معامله
export const FEE_PCT = 0.1; // کارمزد هر طرف (درصد)
export const SPREAD_PCT = 0.05; // اسپرد/لغزش هر طرف (درصد)

const FEE = FEE_PCT / 100;
const SPREAD = SPREAD_PCT / 100;
const ACTION_FA = { BUY: "خرید", SELL: "فروش", SKIP: "رد کردن" };

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

export function updateTrade(id, patch) {
  const all = loadTrades().map((t) => (t.id === id ? { ...t, ...patch } : t));
  write(all);
  return all;
}

export function closeTrade(id, exitPrice, reason = "MANUAL") {
  return updateTrade(id, {
    closed: true,
    exitPrice,
    closeReason: reason,
    closedAt: Date.now(),
  });
}

export function clearTrades() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (e) {}
}

// سود/زیان خالص یک معامله (با اسپرد و کارمزد دو طرف). برای "رد کردن" null.
export function calcPnl(trade, currentPrice) {
  if (trade.action === "SKIP" || !trade.size) return null;
  const mkt = trade.closed ? trade.exitPrice : currentPrice;
  if (typeof mkt !== "number") return null;
  const dir = trade.action === "BUY" ? 1 : -1;
  const exitFill = mkt * (1 - dir * SPREAD);
  const ratio = exitFill / trade.entryFill;
  const gross = trade.size * dir * (ratio - 1);
  const fees = trade.size * FEE * (1 + ratio);
  const net = gross - fees;
  return { net, gross, fees, pct: (net / trade.size) * 100, price: mkt };
}

// حساب فرضیِ یک استراتژی (هر استراتژی ۱۰۰ دلار جدا دارد)
export function getAccount(trades, prices = {}, strategyId) {
  const list = strategyId ? trades.filter((t) => t.strategyId === strategyId) : trades;
  let realized = 0;
  let fees = 0;
  let used = 0;
  let unrealized = 0;
  let open = 0;
  let closed = 0;
  let wins = 0;
  let skipped = 0;

  list.forEach((t) => {
    if (t.action === "SKIP") {
      skipped += 1;
      return;
    }
    const p = calcPnl(t, prices[t.assetId]);
    if (t.closed) {
      closed += 1;
      if (p) {
        realized += p.net;
        fees += p.fees;
        if (p.net > 0) wins += 1;
      }
    } else {
      open += 1;
      used += t.size || 0;
      if (p) unrealized += p.net;
    }
  });

  const balance = START_BALANCE + realized;
  return {
    balance,
    free: balance - used,
    used,
    equity: balance + unrealized,
    realized,
    unrealized,
    fees,
    open,
    closed,
    wins,
    skipped,
    winRate: closed ? (wins / closed) * 100 : null,
  };
}

// باز کردن معامله با مدیریت ریسک. خروجی: { ok, message }
export function openTrade({ asset, strategyId, action, price, sl, tp, decision }) {
  const trades = loadTrades();
  const base = {
    id: `${strategyId}_${asset.id}_${Date.now()}`,
    strategyId,
    assetId: asset.id,
    label: asset.label,
    symbol: asset.symbol,
    action,
    entryPrice: price,
    strategyDecision: decision,
    createdAt: Date.now(),
    closed: false,
  };

  if (typeof price !== "number" || !(price > 0)) {
    return { ok: false, message: "قیمت نامعتبر است." };
  }

  if (action === "SKIP") {
    addTrade(base);
    return { ok: true, message: `ثبت شد: رد کردن در قیمت $${fmtPrice(price)}` };
  }

  const dir = action === "BUY" ? 1 : -1;
  if (
    typeof sl !== "number" ||
    typeof tp !== "number" ||
    !(dir * (price - sl) > 0) ||
    !(dir * (tp - price) > 0)
  ) {
    return { ok: false, message: "حد ضرر/سود قابل محاسبه نیست (داده‌ی ATR نامعتبر)." };
  }

  const acc = getAccount(trades, {}, strategyId);

  if (acc.open >= MAX_OPEN_TRADES) {
    return {
      ok: false,
      message: `این استراتژی حداکثر ${MAX_OPEN_TRADES} معامله‌ی باز دارد. اول یکی را ببند.`,
    };
  }
  if (
    trades.some(
      (t) =>
        !t.closed && t.action !== "SKIP" && t.assetId === asset.id && t.strategyId === strategyId
    )
  ) {
    return { ok: false, message: "برای این ارز و این استراتژی از قبل یک معامله‌ی باز داری." };
  }

  const slPct = Math.abs(price - sl) / price;
  const tpPct = (Math.abs(tp - price) / price) * 100;

  const riskUsd = (acc.balance * RISK_PCT) / 100;
  let size = riskUsd / slPct;
  size = Math.min(size, (acc.balance * MAX_POSITION_PCT) / 100, acc.free);
  size = Math.floor(size * 100) / 100;

  if (size < MIN_TRADE_USD) {
    return { ok: false, message: `موجودی آزاد کافی نیست (آزاد: $${acc.free.toFixed(2)}).` };
  }

  const entryFill = price * (1 + dir * SPREAD);

  addTrade({
    ...base,
    size,
    entryFill,
    sl,
    tp,
    riskUsd: size * slPct,
    checkedAt: null,
  });

  const roundTripPct = 2 * (FEE_PCT + SPREAD_PCT);
  const warn =
    tpPct < 2 * roundTripPct
      ? " ⚠️ حد سود نسبت به کارمزد کوچک است و بخش بزرگی از سود را هزینه می‌خورد."
      : "";

  return {
    ok: true,
    message: `ثبت شد: ${ACTION_FA[action]} حجم $${size.toFixed(2)} در $${fmtPrice(price)} · حد ضرر $${fmtPrice(sl)} · حد سود $${fmtPrice(tp)} · ریسک ≈ $${(size * slPct).toFixed(2)}.${warn}`,
  };
}