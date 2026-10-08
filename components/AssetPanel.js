"use client";

import { useState } from "react";
import Chart from "./Chart";
import { runStrategy } from "../lib/strategy";
import { fetchCandles, fetchPrices } from "../lib/dataSources";
import { addTrade } from "../lib/storage";
import { fmtPrice } from "../lib/assets";

const DECISION_FA = { BUY: "خرید", SELL: "فروش", NO_SIGNAL: "بدون سیگنال" };
const ACTION_FA = { BUY: "خرید", SELL: "فروش", SKIP: "رد کردن" };

function explain(result) {
  if (!result.fastEMA.length) return "داده‌ی کافی برای محاسبه نیست.";
  const n = result.fastEMA.length;
  const up = result.fastEMA[n - 1] > result.slowEMA[n - 1];
  if (result.decision === "BUY")
    return "EMA سریع (۱۲) از EMA کند (۲۶) به بالا عبور کرد و فیلتر ATR تأیید کرد.";
  if (result.decision === "SELL")
    return "EMA سریع (۱۲) از EMA کند (۲۶) به پایین عبور کرد و فیلتر ATR تأیید کرد.";
  return `در آخرین کندل کراس تأییدشده‌ای نیست. روند فعلی: ${up ? "صعودی" : "نزولی"}.`;
}

export default function AssetPanel({ asset, livePrice, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [candles, setCandles] = useState([]);
  const [result, setResult] = useState(null);

  async function handleCalculate() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const c = await fetchCandles(asset.id);
      setCandles(c);
      setResult(runStrategy(c, {}));
    } catch (e) {
      setError(e.message || "دریافت داده ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTrade(action) {
    if (!result) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const p = await fetchPrices([asset.id]);
      const price = p[asset.id];
      if (typeof price !== "number") throw new Error("قیمت لحظه‌ای دریافت نشد.");
      addTrade({
        id: `${asset.id}_${Date.now()}`,
        assetId: asset.id,
        label: asset.label,
        symbol: asset.symbol,
        action,
        entryPrice: price,
        strategyDecision: result.decision,
        createdAt: Date.now(),
        closed: false,
      });
      onSaved();
      setMessage(`ذخیره شد: ${ACTION_FA[action]} در قیمت $${fmtPrice(price)}`);
    } catch (e) {
      setError(e.message || "ذخیره ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  const decisionColor =
    result?.decision === "BUY"
      ? "text-emerald-400"
      : result?.decision === "SELL"
      ? "text-rose-400"
      : "text-slate-400";

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

      {error && <p className="text-rose-400 text-sm mb-2">{error}</p>}

      {candles.length > 0 && (
        <Chart candles={candles} fastEMA={result?.fastEMA} slowEMA={result?.slowEMA} />
      )}

      {result && (
        <div className="mt-3 space-y-2">
          <p className={`text-xl font-bold ${decisionColor}`}>
            استراتژی: {DECISION_FA[result.decision]}
          </p>
          <p className="text-sm text-slate-400">{explain(result)}</p>
          {result.stopLoss && (
            <p className="text-sm text-slate-300">
              حد ضرر: ${fmtPrice(result.stopLoss)} · حد سود: ${fmtPrice(result.takeProfit)}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2 pt-2">
            <button
              onClick={() => handleTrade("BUY")}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2 rounded-xl"
            >
              خرید
            </button>
            <button
              onClick={() => handleTrade("SELL")}
              disabled={saving}
              className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-medium py-2 rounded-xl"
            >
              فروش
            </button>
            <button
              onClick={() => handleTrade("SKIP")}
              disabled={saving}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-medium py-2 rounded-xl"
            >
              رد کردن
            </button>
          </div>

          {message && <p className="text-xs text-emerald-400">{message}</p>}
        </div>
      )}
    </div>
  );
}