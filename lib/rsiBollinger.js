// استراتژی ۲: RSI + Bollinger (بازگشت به میانگین)
// وقتی قیمت به لبه‌ی باند بولینگر می‌رسد و RSI اشباع را تأیید می‌کند، خلاف حرکت وارد می‌شود.
// برعکس استراتژی ۱ که دنبال روند می‌رود.

import { computeATR } from "./strategy";

export const BB_SL_ATR = 1.5;
export const BB_MIN_TP_ATR = 1.5;

function rsiValue(avgGain, avgLoss) {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export function computeRSI(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = rsiValue(avgGain, avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    out[i] = rsiValue(avgGain, avgLoss);
  }
  return out;
}

export function computeBollinger(closes, period = 20, mult = 2) {
  const mid = [];
  const upper = [];
  const lower = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      mid.push(null);
      upper.push(null);
      lower.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    const m = sum / period;
    let v = 0;
    for (let j = i - period + 1; j <= i; j++) v += (closes[j] - m) ** 2;
    const sd = Math.sqrt(v / period);
    mid.push(m);
    upper.push(m + mult * sd);
    lower.push(m - mult * sd);
  }
  return { mid, upper, lower };
}

export function runRsiBollinger(candles, opts = {}) {
  const bbPeriod = opts.bbPeriod || 20;
  const bbMult = opts.bbMult || 2;
  const rsiPeriod = opts.rsiPeriod || 14;
  const atrPeriod = opts.atrPeriod || 14;
  const rsiBuy = opts.rsiBuy ?? 35;
  const rsiSell = opts.rsiSell ?? 65;
  const edge = opts.edge ?? 0.05; // نزدیکی به لبه‌ی باند (کسری از پهنای باند)

  const base = {
    decision: "NO_SIGNAL",
    lastPrice: candles?.length ? candles[candles.length - 1].close : null,
    lastATR: null,
    mid: null,
    info: "",
  };

  if (!candles || candles.length < Math.max(bbPeriod, rsiPeriod) + 5) {
    return { ...base, reason: "داده‌ی کافی برای محاسبه نیست." };
  }

  const closes = candles.map((c) => c.close);
  const n = closes.length;
  const rsi = computeRSI(closes, rsiPeriod)[n - 1];
  const bb = computeBollinger(closes, bbPeriod, bbMult);
  const upper = bb.upper[n - 1];
  const lower = bb.lower[n - 1];
  const mid = bb.mid[n - 1];
  const atr = computeATR(candles, atrPeriod)[n - 1];
  const lastPrice = closes[n - 1];

  if (!(upper - lower > 0) || !(atr > 0) || rsi === null) {
    return { ...base, lastPrice, reason: "نوسان قیمت برای محاسبه کافی نیست." };
  }

  const pctB = (lastPrice - lower) / (upper - lower); // ۰ = کف باند، ۱ = سقف باند
  const info = `RSI: ${rsi.toFixed(0)} · موقعیت در باند: ${(pctB * 100).toFixed(0)}٪`;

  let decision = "NO_SIGNAL";
  let reason = "قیمت وسط باند است؛ نه اشباع خرید داریم نه اشباع فروش.";

  if (pctB <= edge && rsi <= rsiBuy) {
    decision = "BUY";
    reason = `قیمت به کف باند بولینگر رسیده و RSI (${rsi.toFixed(0)}) اشباع فروش را تأیید می‌کند.`;
  } else if (pctB >= 1 - edge && rsi >= rsiSell) {
    decision = "SELL";
    reason = `قیمت به سقف باند بولینگر رسیده و RSI (${rsi.toFixed(0)}) اشباع خرید را تأیید می‌کند.`;
  } else if (pctB <= edge) {
    reason = `قیمت به کف باند رسیده ولی RSI (${rsi.toFixed(0)}) تأیید نمی‌کند.`;
  } else if (pctB >= 1 - edge) {
    reason = `قیمت به سقف باند رسیده ولی RSI (${rsi.toFixed(0)}) تأیید نمی‌کند.`;
  }

  return { decision, reason, lastPrice, lastATR: atr, mid, info };
}

// حد سود: میانگین باند (اگر دورتر از حداقل باشد)، وگرنه حداقل مضرب ATR
export function rsiBollingerLevels(result, action, price) {
  const atr = result?.lastATR;
  const mid = result?.mid;
  if (!(atr > 0) || typeof price !== "number") return null;
  const dir = action === "BUY" ? 1 : -1;
  const sl = price - dir * atr * BB_SL_ATR;
  const minTp = atr * BB_MIN_TP_ATR;
  const tp =
    typeof mid === "number" && (mid - price) * dir > minTp ? mid : price + dir * minTp;
  return { sl, tp };
}