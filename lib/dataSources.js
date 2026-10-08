const CG = "https://api.coingecko.com/api/v3";

export async function fetchPrices(ids) {
  const res = await fetch(`${CG}/simple/price?ids=${ids.join(",")}&vs_currencies=usd`);
  if (!res.ok) throw new Error(`خطای دریافت قیمت (${res.status})`);
  const data = await res.json();
  const out = {};
  ids.forEach((id) => {
    if (data[id] && typeof data[id].usd === "number") out[id] = data[id].usd;
  });
  return out;
}

export async function fetchCandles(id) {
  const res = await fetch(`${CG}/coins/${id}/ohlc?vs_currency=usd&days=1`);
  if (!res.ok) throw new Error(`خطای دریافت کندل (${res.status})`);
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("داده‌ی کندل خالی بود.");
  }
  return rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
}