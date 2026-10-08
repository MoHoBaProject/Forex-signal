// Client-side data fetchers. No backend, no API keys.
// Gold + Bitcoin both served by gold-api.com (free, no key, CORS-enabled).
// CoinGecko used as a fallback for Bitcoin if gold-api is unreachable.

const GOLD_API_BASE = "https://api.gold-api.com";

// Fetch current spot price for a symbol ("XAU" for gold, "BTC" for bitcoin)
export async function fetchCurrentPrice(symbol) {
  const res = await fetch(`${GOLD_API_BASE}/price/${symbol}`);
  if (!res.ok) throw new Error(`gold-api price fetch failed: ${res.status}`);
  const data = await res.json();
  return {
    price: data.price,
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

// Fallback: CoinGecko simple price (Bitcoin only)
export async function fetchBitcoinPriceFallback() {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
  );
  if (!res.ok) throw new Error(`coingecko fetch failed: ${res.status}`);
  const data = await res.json();
  return { price: data.bitcoin.usd, updatedAt: new Date().toISOString() };
}

// Builds a synthetic recent candle series from repeated polling data stored
// locally, OR, if history isn't built up yet, synthesizes candles around the
// current price so the strategy has something to compute on day one.
// This keeps the app 100% client-side with no historical-data API dependency.
export function synthesizeCandles(priceHistory, fallbackPrice) {
  // priceHistory: array of { time, price } saved locally over time (oldest first)
  if (priceHistory && priceHistory.length >= 30) {
    return priceHistory.map((p, i) => {
      const prev = priceHistory[Math.max(0, i - 1)].price;
      const high = Math.max(p.price, prev) * 1.0005;
      const low = Math.min(p.price, prev) * 0.9995;
      return {
        time: p.time,
        open: prev,
        high,
        low,
        close: p.price,
      };
    });
  }

  // Not enough real history yet: synthesize a plausible short series so the
  // EMA/ATR math can run. This is clearly labeled in the UI as "warming up".
  const candles = [];
  let price = fallbackPrice;
  const now = Date.now();
  for (let i = 40; i >= 0; i--) {
    const drift = (Math.sin(i / 3) + (Math.random() - 0.5)) * (fallbackPrice * 0.0015);
    price = price + drift;
    const open = price - drift;
    const high = Math.max(price, open) * 1.0006;
    const low = Math.min(price, open) * 0.9994;
    candles.push({
      time: now - i * 60 * 60 * 1000,
      open,
      high,
      low,
      close: price,
    });
  }
  // Force the last candle to the real fallback price for accuracy
  candles[candles.length - 1].close = fallbackPrice;
  return candles;
}
