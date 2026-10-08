// استراتژی قاعده‌محور: کراس EMA سریع/کند + فیلتر نوسان ATR
// کراس در چند کندل اخیر (lookback) هم پذیرفته می‌شود، نه فقط آخرین کندل.

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
    trs.push(
      Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    );
  }
  const atr = [];
  let sum = 0;
  for (let i = 0; i < trs.length; i++) {
    sum += trs[i];
    if (i >= period) sum -= trs[i - period];
    atr.push(sum / Math.min(i + 1, period));
  }
  return atr;
}

export function runStrategy(candles, opts = {}) {
  const fastPeriod = opts.fastPeriod || 12;
  const slowPeriod = opts.slowPeriod || 26;
  const atrPeriod = opts.atrPeriod || 14;
  const atrMultiplier = opts.atrMultiplier || 1.5;
  const lookback = opts.lookback || 6;

  if (!candles || candles.length < slowPeriod + 2) {
    return {
      decision: "NO_SIGNAL",
      reason: "داده‌ی کافی برای محاسبه نیست.",
      fastEMA: [],
      slowEMA: [],
      atr: [],
      lastPrice: candles?.length ? candles[candles.length - 1].close : null,
      stopLoss: null,
      takeProfit: null,
    };
  }

  const closes = candles.map((c) => c.close);
  const fastEMA = computeEMA(closes, fastPeriod);
  const slowEMA = computeEMA(closes, slowPeriod);
  const atr = computeATR(candles, atrPeriod);

  const n = closes.length;
  const lastPrice = closes[n - 1];
  const lastATR = atr[n - 1];
  const lastFast = fastEMA[n - 1];
  const lastSlow = slowEMA[n - 1];

  // آخرین کراس را در lookback کندل اخیر پیدا کن (از جدید به قدیم)
  let crossType = null;
  let crossAgo = null;
  for (let i = n - 1; i >= Math.max(1, n - lookback); i--) {
    if (fastEMA[i - 1] <= slowEMA[i - 1] && fastEMA[i] > slowEMA[i]) {
      crossType = "UP";
      crossAgo = n - 1 - i;
      break;
    }
    if (fastEMA[i - 1] >= slowEMA[i - 1] && fastEMA[i] < slowEMA[i]) {
      crossType = "DOWN";
      crossAgo = n - 1 - i;
      break;
    }
  }

  // فیلتر نوسان: فاصله‌ی EMAها باید نسبت به ATR معنی‌دار باشد
  const gap = Math.abs(lastFast - lastSlow);
  const meaningfulMove = gap > lastATR * (atrMultiplier / 10);

  // کراس باید هنوز معتبر باشد (جهت EMAها برنگشته باشد)
  const stillUp = lastFast > lastSlow;
  const stillDown = lastFast < lastSlow;

  const agoText = crossAgo === 0 ? "در آخرین کندل" : `${crossAgo} کندل پیش`;

  let decision = "NO_SIGNAL";
  let reason = `در ${lookback} کندل اخیر کراسی رخ نداده است.`;

  if (crossType === "UP" && stillUp && meaningfulMove) {
    decision = "BUY";
    reason = `EMA سریع (${fastPeriod}) ${agoText} از EMA کند (${slowPeriod}) به بالا عبور کرد و فیلتر ATR تأیید کرد.`;
  } else if (crossType === "DOWN" && stillDown && meaningfulMove) {
    decision = "SELL";
    reason = `EMA سریع (${fastPeriod}) ${agoText} از EMA کند (${slowPeriod}) به پایین عبور کرد و فیلتر ATR تأیید کرد.`;
  } else if (crossType) {
    reason = `کراسی ${agoText} رخ داد ولی یا برگشته یا نوسان (ATR) برای تأیید کافی نیست.`;
  }

  const stopLossDist = lastATR * atrMultiplier;
  const takeProfitDist = lastATR * atrMultiplier * 1.5;

  const stopLoss =
    decision === "BUY"
      ? lastPrice - stopLossDist
      : decision === "SELL"
      ? lastPrice + stopLossDist
      : null;
  const takeProfit =
    decision === "BUY"
      ? lastPrice + takeProfitDist
      : decision === "SELL"
      ? lastPrice - takeProfitDist
      : null;

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