"use client";

import { useState, useEffect, useCallback } from "react";
import Chart from "./Chart";
import { runStrategy } from "../lib/strategy";
import { fetchCurrentPrice, fetchBitcoinPriceFallback, synthesizeCandles } from "../lib/dataSources";
import { saveSignal, loadPriceHistory, appendPriceHistory, updateSignal, loadSignals } from "../lib/storage";

export default function AssetPanel({ asset, label, symbol }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [candles, setCandles] = useState([]);
  const [lastSaved, setLastSaved] = useState(null);

  const handleCalculate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let price;
      try {
        const r = await fetchCurrentPrice(symbol);
        price = r.price;
      } catch (e) {
        if (asset === "BTC") {
          const r = await fetchBitcoinPriceFallback();
          price = r.price;
        } else {
          throw e;
        }
      }

      const history = appendPriceHistory(asset, { time: Date.now(), price });
      const builtCandles = synthesizeCandles(history, price);
      setCandles(builtCandles);

      const strat = runStrategy(builtCandles, {});
      setResult(strat);

      if (strat.decision !== "NO_SIGNAL") {
        const signal = {
          id: `${asset}_${Date.now()}`,
          asset,
          label,
          decision: strat.decision,
          entryPrice: strat.lastPrice,
          stopLoss: strat.stopLoss,
          takeProfit: strat.takeProfit,
          reason: strat.reason,
          createdAt: Date.now(),
          outcomePct: null,
          outcomeCheckedAt: null,
        };
        saveSignal(signal);
        setLastSaved(signal);
      }
    } catch (e) {
      setError(e.message || "Failed to fetch price data.");
    } finally {
      setLoading(false);
    }
  }, [asset, label, symbol]);

  // On mount, re-check any pending (unevaluated) signals for this asset against current price
  useEffect(() => {
    async function checkPending() {
      try {
        let price;
        try {
          const r = await fetchCurrentPrice(symbol);
          price = r.price;
        } catch (e) {
          if (asset === "BTC") {
            const r = await fetchBitcoinPriceFallback();
            price = r.price;
          } else {
            return;
          }
        }
        const all = loadSignals().filter((s) => s.asset === asset);
        const pending = all.filter((s) => s.outcomePct === null && s.decision !== "NO_SIGNAL");
        const oneHourMs = 60 * 60 * 1000;
        pending.forEach((s) => {
          if (Date.now() - s.createdAt >= oneHourMs) {
            const direction = s.decision === "BUY" ? 1 : -1;
            const pct = ((price - s.entryPrice) / s.entryPrice) * 100 * direction;
            updateSignal(s.id, { outcomePct: pct, outcomeCheckedAt: Date.now(), exitPrice: price });
          }
        });
      } catch (e) {
        // silent - this is a background check
      }
    }
    checkPending();
  }, [asset, symbol]);

  const decisionColor =
    result?.decision === "BUY"
      ? "text-emerald-400"
      : result?.decision === "SELL"
      ? "text-rose-400"
      : "text-slate-400";

  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{label}</h2>
        <button
          onClick={handleCalculate}
          disabled={loading}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
        >
          {loading ? "Calculating..." : "Calculate"}
        </button>
      </div>

      {error && (
        <p className="text-rose-400 text-sm mb-2">{error}</p>
      )}

      {candles.length > 0 && (
        <Chart candles={candles} fastEMA={result?.fastEMA} slowEMA={result?.slowEMA} />
      )}

      {result && (
        <div className="mt-3 space-y-1">
          <p className={`text-xl font-bold ${decisionColor}`}>
            {result.decision === "NO_SIGNAL" ? "No signal" : result.decision}
          </p>
          <p className="text-sm text-slate-400">{result.reason}</p>
          {result.lastPrice && (
            <p className="text-sm text-slate-300">
              Price: ${result.lastPrice.toFixed(2)}
              {result.stopLoss && (
                <> &middot; SL: ${result.stopLoss.toFixed(2)} &middot; TP: ${result.takeProfit.toFixed(2)}</>
              )}
            </p>
          )}
          {lastSaved && (
            <p className="text-xs text-emerald-500">Saved locally - check back in an hour to see the result.</p>
          )}
        </div>
      )}

      {candles.length > 0 && candles.length < 30 && (
        <p className="text-xs text-amber-500 mt-2">
          Warming up: using a short synthetic series until more real price history builds up locally.
        </p>
      )}
    </div>
  );
}
