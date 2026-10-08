// Rule-based technical strategy: EMA crossover confirmed by ATR volatility filter.
// No training, no prediction model - pure math over historical candles.

export function computeEMA(values, period) {
  const k = 2 / (period + 1);
  const ema = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    const v = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    ema.push(v);
    prev = v;
  }
  return ema;
}

// True Range based ATR (simplified: uses close-to-close since we often only have close prices)
export function computeATR(candles, period) {
  const trs = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trs.push(candles[i].high - candles[i].low);
      continue;
    }
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trs.push(tr);
  }
  // Simple moving average of TR (Wilder smoothing approximated with SMA for simplicity)
  const atr = [];
  let sum = 0;
  for (let i = 0; i < trs.length; i++) {
    sum += trs[i];
    if (i >= period) sum -= trs[i - period];
    const divisor = Math.min(i + 1, period);
    atr.push(sum / divisor);
  }
  return atr;
}

// candles: [{ time, open, high, low, close }], oldest first
export function runStrategy(candles, opts = {}) {
  const fastPeriod = opts.fastPeriod || 12;
  const slowPeriod = opts.slowPeriod || 26;
  const atrPeriod = opts.atrPeriod || 14;
  const atrMultiplier = opts.atrMultiplier || 1.5;

  if (!candles || candles.length < slowPeriod + 2) {
    return {
      decision: "NO_SIGNAL",
      reason: "Not enough data points to compute the strategy yet.",
      fastEMA: [],
      slowEMA: [],
      atr: [],
      lastPrice: candles?.length ? candles[candles.length - 1].close : null,
    };
  }

  const closes = candles.map((c) => c.close);
  const fastEMA = computeEMA(closes, fastPeriod);
  const slowEMA = computeEMA(closes, slowPeriod);
  const atr = computeATR(candles, atrPeriod);

  const n = closes.length;
  const lastFast = fastEMA[n - 1];
  const lastSlow = slowEMA[n - 1];
  const prevFast = fastEMA[n - 2];
  const prevSlow = slowEMA[n - 2];
  const lastPrice = closes[n - 1];
  const lastATR = atr[n - 1];

  const crossedUp = prevFast <= prevSlow && lastFast > lastSlow;
  const crossedDown = prevFast >= prevSlow && lastFast < lastSlow;

  // Volatility filter: only trust a crossover if the gap between EMAs is
  // meaningful relative to ATR, to avoid acting on flat/noisy chop.
  const gap = Math.abs(lastFast - lastSlow);
  const meaningfulMove = gap > lastATR * (atrMultiplier / 10);

  let decision = "NO_SIGNAL";
  let reason = "No EMA crossover detected on the latest candle.";

  if (crossedUp && meaningfulMove) {
    decision = "BUY";
    reason = `Fast EMA(${fastPeriod}) crossed above Slow EMA(${slowPeriod}), confirmed by ATR volatility filter.`;
  } else if (crossedDown && meaningfulMove) {
    decision = "SELL";
    reason = `Fast EMA(${fastPeriod}) crossed below Slow EMA(${slowPeriod}), confirmed by ATR volatility filter.`;
  } else if (crossedUp || crossedDown) {
    reason = "Crossover detected but volatility (ATR) too low to confirm - treated as noise.";
  }

  const stopLossDist = lastATR * atrMultiplier;
  const takeProfitDist = lastATR * atrMultiplier * 1.5;

  const stopLoss =
    decision === "BUY" ? lastPrice - stopLossDist : decision === "SELL" ? lastPrice + stopLossDist : null;
  const takeProfit =
    decision === "BUY" ? lastPrice + takeProfitDist : decision === "SELL" ? lastPrice - takeProfitDist : null;

  return {
    decision,
    reason,
    fastEMA,
    slowEMA,
    atr,
    lastPrice,
    lastATR,
    stopLoss,
    takeProfit,
  };
}
