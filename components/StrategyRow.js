"use client";

import { useState } from "react";
import { fetchPrices } from "../lib/dataSources";
import { openTrade } from "../lib/storage";
import { fmtPrice } from "../lib/assets";

const SIGNAL_FA = { BUY: "خرید", SELL: "فروش", NO_SIGNAL: "بدون سیگنال" };

export default function StrategyRow({ asset, strategy, result, price, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [ok, setOk] = useState(true);

  const decision = result?.decision || "NO_SIGNAL";
  const color =
    decision === "BUY"
      ? "text-emerald-400"
      : decision === "SELL"
      ? "text-rose-400"
      : "text-slate-400";
  const lv =
    decision !== "NO_SIGNAL" ? strategy.levels(result, decision, result.lastPrice) : null;

  async function trade(action) {
    setBusy(true);
    setMsg(null);
    let p = price;
    try {
      const r = await fetchPrices([asset.id]);
      if (typeof r[asset.id] === "number") p = r[asset.id];
    } catch (e) {
      // اگر قیمت تازه نیامد، از قیمت لحظه‌ی محاسبه استفاده می‌شود
    }
    if (typeof p !== "number") p = result?.lastPrice;

    let sl = null;
    let tp = null;
    if (action !== "SKIP") {
      const l = strategy.levels(result, action, p);
      if (l) {
        sl = l.sl;
        tp = l.tp;
      }
    }

    const out = openTrade({
      asset,
      strategyId: strategy.id,
      action,
      price: p,
      sl,
      tp,
      decision,
    });
    setOk(out.ok);
    setMsg(out.message);
    if (out.ok) onSaved();
    setBusy(false);
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-cyan-300">{strategy.name}</span>
        <span className={`text-sm font-semibold ${color}`}>{SIGNAL_FA[decision]}</span>
      </div>
      <p className="text-xs text-slate-400 mt-1">{result?.reason}</p>
      {result?.info && <p className="text-xs text-slate-500">{result.info}</p>}
      {lv && (
        <p className="text-xs text-slate-500">
          حد ضرر: ${fmtPrice(lv.sl)} · حد سود: ${fmtPrice(lv.tp)}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2 mt-2">
        <button
          onClick={() => trade("BUY")}
          disabled={busy}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm py-1.5 rounded-lg"
        >
          خرید
        </button>
        <button
          onClick={() => trade("SELL")}
          disabled={busy}
          className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm py-1.5 rounded-lg"
        >
          فروش
        </button>
        <button
          onClick={() => trade("SKIP")}
          disabled={busy}
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm py-1.5 rounded-lg"
        >
          رد کردن
        </button>
      </div>
      {msg && <p className={`text-xs mt-1 ${ok ? "text-emerald-400" : "text-rose-400"}`}>{msg}</p>}
    </div>
  );
}