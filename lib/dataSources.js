import { getAsset } from "./assets";

const CG = "https://api.coingecko.com/api/v3";
const BN = "https://data-api.binance.vision/api/v3";
const CACHE_MS = 60 * 1000;
const candleCache = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if (e.name === "AbortError") throw new Error("زمان انتظار تمام شد");
    if (e instanceof TypeError) throw new Error("اتصال برقرار نشد (فیلتر یا محدودیت نرخ)");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry(fn, tries = 2) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await sleep(700 * (i + 1));
    }
  }
  throw lastErr;
}

/* ---------- قیمت لحظه‌ای ---------- */

async function pricesBinance(ids) {
  const map = {};
  ids.forEach((id) => {
    const a = getAsset(id);
    if (a && a.bn) map[a.bn] = id;
  });
  const symbols = Object.keys(map);
  if (symbols.length === 0) throw new Error("نماد نامعتبر");
  const url = `${BN}/ticker/price?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
  const data = await withRetry(() => getJson(url));
  const out = {};
  (Array.isArray(data) ? data : []).forEach((row) => {
    const id = map[row.symbol];
    const p = parseFloat(row.price);
    if (id && !isNaN(p)) out[id] = p;
  });
  if (Object.keys(out).length === 0) throw new Error("پاسخ خالی");
  return out;
}

async function pricesCoinGecko(ids) {
  const url = `${CG}/simple/price?ids=${ids.join(",")}&vs_currencies=usd`;
  const data = await withRetry(() => getJson(url));
  const out = {};
  ids.forEach((id) => {
    if (data[id] && typeof data[id].usd === "number") out[id] = data[id].usd;
  });
  if (Object.keys(out).length === 0) throw new Error("پاسخ خالی");
  return out;
}

export async function fetchPrices(ids) {
  const errors = [];
  try {
    return await pricesBinance(ids);
  } catch (e) {
    errors.push("Binance: " + e.message);
  }
  try {
    return await pricesCoinGecko(ids);
  } catch (e) {
    errors.push("CoinGecko: " + e.message);
  }
  throw new Error("دریافت قیمت ناموفق بود (" + errors.join(" | ") + ")");
}

/* ---------- کندل‌ها (۳۰ دقیقه‌ای) ---------- */

async function candlesBinance(id) {
  const a = getAsset(id);
  if (!a || !a.bn) throw new Error("نماد نامعتبر");
  const url = `${BN}/klines?symbol=${a.bn}&interval=30m&limit=60`;
  const rows = await withRetry(() => getJson(url));
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("پاسخ خالی");
  return rows.map((r) => ({
    time: r[0],
    open: parseFloat(r[1]),
    high: parseFloat(r[2]),
    low: parseFloat(r[3]),
    close: parseFloat(r[4]),
  }));
}

async function candlesCoinGecko(id) {
  const url = `${CG}/coins/${id}/ohlc?vs_currency=usd&days=1`;
  const rows = await withRetry(() => getJson(url));
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("پاسخ خالی");
  return rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
}

export async function fetchCandles(id) {
  const hit = candleCache.get(id);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const errors = [];
  let data = null;
  try {
    data = await candlesBinance(id);
  } catch (e) {
    errors.push("Binance: " + e.message);
  }
  if (!data) {
    try {
      data = await candlesCoinGecko(id);
    } catch (e) {
      errors.push("CoinGecko: " + e.message);
    }
  }
  if (!data) throw new Error("دریافت کندل ناموفق بود (" + errors.join(" | ") + ")");

  candleCache.set(id, { at: Date.now(), data });
  return data;
}

/* ---------- کندل‌های بعد از یک زمان (برای بررسی حد ضرر/سود) ---------- */

export async function fetchCandlesSince(id, since) {
  const a = getAsset(id);
  if (!a || !a.bn) throw new Error("نماد نامعتبر");

  const H = 3600 * 1000;
  const age = Date.now() - since;
  let interval = "1m";
  if (age > 16 * H) interval = "5m";
  if (age > 80 * H) interval = "15m";
  if (age > 240 * H) interval = "1h";

  const url = `${BN}/klines?symbol=${a.bn}&interval=${interval}&startTime=${Math.floor(
    since
  )}&limit=1000`;
  const rows = await withRetry(() => getJson(url));
  if (!Array.isArray(rows)) throw new Error("پاسخ نامعتبر");

  return rows
    .map((r) => ({
      time: r[0],
      open: parseFloat(r[1]),
      high: parseFloat(r[2]),
      low: parseFloat(r[3]),
      close: parseFloat(r[4]),
    }))
    .filter((c) => c.time > since);
}