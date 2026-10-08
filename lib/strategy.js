// استراتژی ۱: EMA Trend
// روند را با دو EMA می‌سنجد. سیگنال فقط وقتی صادر می‌شود که روند واضح باشد
// (کراس تازه یا ادامه‌ی روند) و قیمت از EMA سریع زیاد دور نشده باشد.

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
    const { high, low } = candles[i];
    const prevClose = candles[i - 1].close;
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
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

export const EMA_SL_ATR = 1.5;
export const EMA_TP_ATR = 2.25;

export function runStrategy(candles, opts = {}) {
  const fastPeriod = opts.fastPeriod || 9;
  const slowPeriod = opts.slowPeriod || 21;
  const atrPeriod = opts.atrPeriod || 14;
  const lookback = opts.lookback || 8;
  const minGap = opts.minGap ?? 0.8; // حداقل فاصله‌ی EMAها (برحسب ATR) برای روند واضح
  const minCrossGap = opts.minCrossGap ?? 0.1; // حداقل فاصله بعد از کراس تازه
  const maxStretch = opts.maxStretch ?? 1.5; // حداکثر دوری قیمت از EMA سریع (برحسب ATR)

  const base = {
    decision: "NO_SIGNAL",
    fastEMA: [],
    slowEMA: [],
    lastPrice: candles?.length ? candles[candles.length - 1].close : null,
    lastATR: null,
    info: "",
  };

  if (!candles || candles.length < slowPeriod + 5) {
    return { ...base, reason: "داده‌ی کافی برای محاسبه نیست." };
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

  if (!(lastATR > 0)) {
    return { ...base, fastEMA, slowEMA, lastPrice, reason: "نوسان قیمت صفر است." };
  }

  // آخرین کراس در lookback کندل اخیر
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

  const gapAtr = (lastFast - lastSlow) / lastATR; // + یعنی صعودی
  const slopeAtr = (slowEMA[n - 1] - slowEMA[n - 4]) / lastATR; // شیب EMA کند در ۳ کندل
  const distAtr = (lastPrice - lastFast) / lastATR; // فاصله‌ی قیمت از EMA سریع

  const upTrend = (gapAtr >= minGap || (crossType === "UP" && gapAtr >= minCrossGap)) && slopeAtr > 0;
  const downTrend =
    (gapAtr <= -minGap || (crossType === "DOWN" && gapAtr <= -minCrossGap)) && slopeAtr < 0;

  const buyOk = upTrend && distAtr <= maxStretch && distAtr >= -0.5;
  const sellOk = downTrend && distAtr >= -maxStretch && distAtr <= 0.5;

  const agoText = crossAgo === 0 ? "در آخرین کندل" : `${crossAgo} کندل پیش`;
  let decision = "NO_SIGNAL";
  let reason = "روند واضحی نیست (EMAها به هم نزدیک‌اند یا شیب روند ضعیف است).";

  if (buyOk) {
    decision = "BUY";
    reason =
      crossType === "UP"
        ? `EMA(${fastPeriod}) ${agoText} از EMA(${slowPeriod}) به بالا عبور کرد و روند صعودی هنوز برقرار است.`
        : `روند صعودی واضح است و قیمت نزدیک EMA سریع است (ورود نه‌چندان دیرهنگام).`;
  } else if (sellOk) {
    decision = "SELL";
    reason =
      crossType === "DOWN"
        ? `EMA(${fastPeriod}) ${agoText} از EMA(${slowPeriod}) به پایین عبور کرد و روند نزولی هنوز برقرار است.`
        : `روند نزولی واضح است و قیمت نزدیک EMA سریع است (ورود نه‌چندان دیرهنگام).`;
  } else if (upTrend) {
    reason = "روند صعودی است ولی قیمت از EMA سریع زیادی دور شده؛ دنبال‌کردنش ریسکی است.";
  } else if (downTrend) {
    reason = "روند نزولی است ولی قیمت از EMA سریع زیادی دور شده؛ دنبال‌کردنش ریسکی است.";
  }

  return {
    decision,
    reason,
    fastEMA,
    slowEMA,
    lastPrice,
    lastATR,
    info: `روند: ${gapAtr >= 0 ? "صعودی" : "نزولی"} · فاصله‌ی EMAها: ${Math.abs(gapAtr).toFixed(2)} ATR`,
  };
}

// سطح حد ضرر/حد سود برای جهت دلخواه
export function emaLevels(result, action, price) {
  const atr = result?.lastATR;
  if (!(atr > 0) || typeof price !== "number") return null;
  const dir = action === "BUY" ? 1 : -1;
  return {
    sl: price - dir * atr * EMA_SL_ATR,
    tp: price + dir * atr * EMA_TP_ATR,
  };
}