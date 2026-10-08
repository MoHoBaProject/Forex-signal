"use client";

import { useState } from "react";
import Chart from "./Chart";
import StrategyRow from "./StrategyRow";
import { STRATEGIES, runAll } from "../lib/strategies";
import { fetchCandles } from "../lib/dataSources";
import { fmtPrice } from "../lib/assets";

export default function AssetPanel({ asset, livePrice, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [candles, setCandles] = useState([]);
  const [results, setResults] = useState(null);

  async function handleCalculate() {
    setLoading(true);
    setError(null);
    try {
      const c = await fetchCandles(asset.id);
      setCandles(c);
      setResults(runAll(c));
    } catch (e) {
      setError(e.message || "دریافت داده ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  const price = livePrice ?? results?.ema?.lastPrice;

  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">{asset.label}</h2>
          <p className="text-sm text-slate-400">
            قیمت لحظه‌ای: {livePrice ? `$${fmtPrice(livePrice)}` : "..."}
          </p>
        </div>
        <button
          onClick={handleCalculate}
          disabled={loading}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
        >
          {loading ? "در حال محاسبه..." : "محاسبه"}
        </button>
      </div>

      {candles.length > 0 && (
        <Chart candles={candles} fastEMA={results?.ema?.fastEMA} slowEMA={results?.ema?.slowEMA} />
      )}

      {results && (
        <div className="mt-3 space-y-2">
          {STRATEGIES.map((s) => (
            <StrategyRow
              key={s.id}
              asset={asset}
              strategy={s}
              result={results[s.id]}
              price={price}
              onSaved={onSaved}
            />
          ))}
        </div>
      )}

      {error && <p className="text-rose-400 text-sm mt-2">{error}</p>}
    </div>
  );
}