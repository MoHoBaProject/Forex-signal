import { getAsset } from "./assets";

const CG = "https://api.coingecko.com/api/v3";
const BN_VISION = "https://data-api.binance.vision/api/v3";
const BN_MAIN = "https://api.binance.com/api/v3";
const OKX = "https://www.okx.com/api/v5";
const KUCOIN = "https://api.kucoin.com/api/v1";
const GATE = "https://api.gateio.ws/api/v4";

const CACHE_MS = 60 * 1000;
const CANDLE_COUNT = 120;
const candleCache = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (x) => (typeof x === "string" ? parseFloat(x) : x);

function netError(msg) {
  const e = new Error(msg);
  e.net = true;
  return e;
}

async function getJson(url, timeoutMs = 7000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      const e = new Error(`HTTP ${res.status}`);
      e.net = [403, 418, 429, 451].includes(res.status) || res.status >= 500;
      throw e;
    }
    return await res.json();
  } catch (e) {
    if (e.name === "AbortError") throw netError("زمان انتظار تمام شد");
    if (e instanceof TypeError) throw netError("اتصال برقرار نشد");
    if (e instanceof SyntaxError) throw netError("پاسخ نامعتبر");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry(fn, tries) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await sleep(500);
    }
  }
  throw lastErr;
}

/* ---------- زنجیره‌ی منابع: اگر یکی بسته بود، بعدی ---------- */

const health = {}; // name -> { fails, until }
const lastOk = {}; // chain -> name

function isDown(name) {
  const h = health[name];
  return !!h && h.until > Date.now();
}
function markFail(name) {
  const h = health[name] || { fails: 0, until: 0 };
  h.fails += 1;
  if (h.fails >= 2) {
    h.fails = 0;
    h.until = Date.now() + 60 * 1000; // ۶۰ ثانیه کنار گذاشته می‌شود
  }
  health[name] = h;
}
function markOk(name) {
  health[name] = { fails: 0, until: 0 };
}

async function runChain(chain, providers, call) {
  let list = providers.filter((p) => !isDown(p.name));
  if (list.length === 0) list = providers;
  list = [...list].sort((a, b) =>
    a.name === lastOk[chain] ? -1 : b.name === lastOk[chain] ? 1 : 0
  );
  const errors = providers
    .filter((p) => !list.includes(p))
    .map((p) => `${p.name}: موقتاً کنار گذاشته شد`);
  for (const p of list) {
    try {
      const data = await withRetry(() => call(p), p.tries || 1);
      markOk(p.name);
      lastOk[chain] = p.name;
      return data;
    } catch (e) {
      if (e.net) markFail(p.name);
      errors.push(`${p.name}: ${e.message}`);
    }
  }
  throw new Error(errors.join(" | "));
}

/* ---------- قیمت لحظه‌ای ---------- */

async function pricesBinance(base, ids) {
  const map = {};
  ids.forEach((id) => {
    const a = getAsset(id);
    if (a && a.bn) map[a.bn] = id;
  });
  const symbols = Object.keys(map);
  if (symbols.length === 0) throw new Error("نماد نامعتبر");
  const data = await getJson(
    `${base}/ticker/price?symbols=${encodeURIComponent(JSON.stringify(symbols))}`
  );
  if (!Array.isArray(data)) throw new Error("پاسخ نامعتبر");
  const out = {};
  data.forEach((row) => {
    const id = map[row.symbol];
    const p = parseFloat(row.price);
    if (id && !isNaN(p)) out[id] = p;
  });
  if (Object.keys(out).length === 0) throw new Error("پاسخ خالی");
  return out;
}

async function pricesCoinGecko(ids) {
  const data = await getJson(`${CG}/simple/price?ids=${ids.join(",")}&vs_currencies=usd`);
  const out = {};
  ids.forEach((id) => {
    if (data && data[id] && typeof data[id].usd === "number") out[id] = data[id].usd;
  });
  if (Object.keys(out).length === 0) throw new Error("پاسخ خالی");
  return out;
}

const PRICE_PROVIDERS = [
  { name: "Binance", tries: 2, fetch: (ids) => pricesBinance(BN_VISION, ids) },
  { name: "Binance2", tries: 1, fetch: (ids) => pricesBinance(BN_MAIN, ids) },
  { name: "CoinGecko", tries: 1, fetch: pricesCoinGecko },
];

export async function fetchPrices(ids) {
  try {
    return await runChain("price", PRICE_PROVIDERS, (p) => p.fetch(ids));
  } catch (e) {
    throw new Error("دریافت قیمت ناموفق بود (" + e.message + ")");
  }
}

/* ---------- کندل‌های ۳۰ دقیقه‌ای ---------- */

function inst(a, sep) {
  return a.bn.replace(/USDT$/, "") + sep + "USDT";
}

function mustArray(x) {
  if (!Array.isArray(x)) throw new Error("پاسخ نامعتبر");
  return x;
}

function validCandles(arr) {
  if (!Array.isArray(arr) || arr.length < 30) return false;
  return arr.every(
    (c) =>
      [c.time, c.open, c.high, c.low, c.close].every(Number.isFinite) &&
      c.high >= Math.max(c.open, c.close) * 0.9999 &&
      c.low <= Math.min(c.open, c.close) * 1.0001
  );
}

const binanceKlines = (base) => async (a) =>
  mustArray(await getJson(`${base}/klines?symbol=${a.bn}&interval=30m&limit=${CANDLE_COUNT}`)).map(
    (r) => ({ time: r[0], open: num(r[1]), high: num(r[2]), low: num(r[3]), close: num(r[4]) })
  );

const CANDLE_PROVIDERS = [
  { name: "Binance", tries: 2, fetch: binanceKlines(BN_VISION) },
  { name: "Binance2", tries: 1, fetch: binanceKlines(BN_MAIN) },
  {
    // پاسخ OKX: جدیدترین اول، ستون‌ها [ts, open, high, low, close, ...]
    name: "OKX",
    tries: 1,
    fetch: async (a) => {
      const j = await getJson(
        `${OKX}/market/candles?instId=${inst(a, "-")}&bar=30m&limit=${CANDLE_COUNT}`
      );
      return mustArray(j && j.data)
        .map((r) => ({ time: num(r[0]), open: num(r[1]), high: num(r[2]), low: num(r[3]), close: num(r[4]) }))
        .reverse();
    },
  },
  {
    // پاسخ KuCoin: جدیدترین اول، ستون‌ها [time(s), open, close, high, low, ...]
    name: "KuCoin",
    tries: 1,
    fetch: async (a) => {
      const end = Math.floor(Date.now() / 1000);
      const start = end - CANDLE_COUNT * 30 * 60;
      const j = await getJson(
        `${KUCOIN}/market/candles?type=30min&symbol=${inst(a, "-")}&startAt=${start}&endAt=${end}`
      );
      return mustArray(j && j.data)
        .map((r) => ({
          time: num(r[0]) * 1000,
          open: num(r[1]),
          close: num(r[2]),
          high: num(r[3]),
          low: num(r[4]),
        }))
        .reverse();
    },
  },
  {
    // پاسخ Gate: قدیمی‌ترین اول، ستون‌ها [t(s), quoteVol, close, high, low, open, ...]
    name: "Gate",
    tries: 1,
    fetch: async (a) =>
      mustArray(
        await getJson(
          `${GATE}/spot/candlesticks?currency_pair=${inst(a, "_")}&interval=30m&limit=${CANDLE_COUNT}`
        )
      ).map((r) => ({
        time: num(r[0]) * 1000,
        close: num(r[2]),
        high: num(r[3]),
        low: num(r[4]),
        open: num(r[5]),
      })),
  },
  {
    name: "CoinGecko",
    tries: 1,
    fetch: async (a) =>
      mustArray(await getJson(`${CG}/coins/${a.id}/ohlc?vs_currency=usd&days=1`)).map(
        ([time, open, high, low, close]) => ({ time, open, high, low, close })
      ),
  },
];

export async function fetchCandles(id) {
  const hit = candleCache.get(id);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const a = getAsset(id);
  if (!a) throw new Error("ارز نامعتبر");

  let data;
  try {
    data = await runChain("candle", CANDLE_PROVIDERS, async (p) => {
      const rows = await p.fetch(a);
      if (!validCandles(rows)) throw new Error("داده‌ی نامعتبر");
      return rows;
    });
  } catch (e) {
    throw new Error("دریافت کندل ناموفق بود (" + e.message + ")");
  }

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

  const providers = [
    { name: "Binance", tries: 2, base: BN_VISION },
    { name: "Binance2", tries: 1, base: BN_MAIN },
  ];
  const rows = await runChain("since", providers, async (p) =>
    mustArray(
      await getJson(
        `${p.base}/klines?symbol=${a.bn}&interval=${interval}&startTime=${Math.floor(since)}&limit=1000`
      )
    )
  );

  return rows
    .map((r) => ({
      time: r[0],
      open: num(r[1]),
      high: num(r[2]),
      low: num(r[3]),
      close: num(r[4]),
    }))
    .filter((c) => c.time > since);
}