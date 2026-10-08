"use client";

import { useState } from "react";
import { ASSETS, fmtPrice } from "../lib/assets";
import { runStrategy } from "../lib/strategy";
import { fetchCandles, fetchPrices } from "../lib/dataSources";
import { openTrade } from "../lib/storage";

const DECISION_FA = { BUY: "خرید", SELL: "فروش", NO_SIGNAL: "بدون سیگنال" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function ScanList({ onSaved }) {
  const [rows, setRows] = useState({});
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState(null);

  function patch(id, data) {
    setRows((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...data } }));
  }

  async function scanAll() {
    setScanning(true);
    setNote(null);
    setRows({});

    let prices = {};
    try {
      prices = await fetchPrices(ASSETS.map((a) => a.id));
    } catch (e) {
      setNote(e.message);
    }

    for (const a of ASSETS) {
      patch(a.id, { status: "loading", price: prices[a.id] });
    }

    for (const a of ASSETS) {
      try {
        const c = await fetchCandles(a.id);
        const r = runStrategy(c, {});
        const n = r.fastEMA.length;
        const up = n ? r.fastEMA[n - 1] > r.slowEMA[n - 1] : null;
        patch(a.id, {
          status: "done",
          decision: r.decision,
          up,
          atr: r.lastATR,
          stopLoss: r.stopLoss,
          takeProfit: r.takeProfit,
          price: typeof prices[a.id] === "number" ? prices[a.id] : r.lastPrice,
        });
      } catch (e) {
        patch(a.id, { status: "error", error: e.message });
      }
      await sleep(250);
    }
    setScanning(false);
  }

  async function trade(asset, action) {
    const row = rows[asset.id];
    if (!row || row.status !== "done") return;
    patch(asset.id, { busy: true, saved: null });

    let price = row.price;
    try {
      const p = await fetchPrices([asset.id]);
      if (typeof p[asset.id] === "number") price = p[asset.id];
    } catch (e) {
      // اگر قیمت تازه نیامد، از قیمت لحظه‌ی محاسبه استفاده می‌شود
    }

    if (typeof price !== "number") {
      patch(asset.id, { busy: false, saved: "قیمت نامشخص، ذخیره نشد", savedOk: false });
      return;
    }

    const r = openTrade({
      asset,
      action,
      price,
      atr: row.atr,
      decision: row.decision,
    });
    if (r.ok) onSaved();
    patch(asset.id, { busy: false, price, saved: r.message, savedOk: r.ok });
  }

  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">لیست همه‌ی ارزها</h2>
        <button
          onClick={scanAll}
          disabled={scanning}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
        >
          {scanning ? "در حال محاسبه..." : "محاسبه‌ی همه"}
        </button>
      </div>

      {note && <p className="text-rose-400 text-xs mb-2">{note}</p>}

      {Object.keys(rows).length === 0 && !scanning && (
        <p className="text-sm text-slate-500">
          دکمه‌ی «محاسبه‌ی همه» را بزن تا نتیجه‌ی همه‌ی ارزها یک‌جا بیاید.
        </p>
      )}

      <div className="space-y-2">
        {ASSETS.map((a) => {
          const row = rows[a.id];
          if (!row) return null;
          const hasSignal = row.decision === "BUY" || row.decision === "SELL";
          const border = hasSignal
            ? row.decision === "BUY"
              ? "border-emerald-700"
              : "border-rose-700"
            : "border-slate-800";
          const decColor =
            row.decision === "BUY"
              ? "text-emerald-400"
              : row.decision === "SELL"
              ? "text-rose-400"
              : "text-slate-400";

          return (
            <div key={a.id} className={`bg-slate-950 border ${border} rounded-xl p-3`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {a.label} <span className="text-xs text-slate-500">{a.symbol}</span>
                </span>
                <span className="text-sm text-slate-300">
                  {typeof row.price === "number" ? `$${fmtPrice(row.price)}` : "..."}
                </span>
              </div>

              {row.status === "loading" && (
                <p className="text-xs text-slate-500 mt-1">در حال محاسبه...</p>
              )}

              {row.status === "error" && (
                <p className="text-xs text-rose-400 mt-1">{row.error}</p>
              )}

              {row.status === "done" && (
                <>
                  <p className="text-sm mt-1">
                    <span className={`font-semibold ${decColor}`}>
                      استراتژی: {DECISION_FA[row.decision]}
                    </span>
                    <span className="text-xs text-slate-500">
                      {" "}
                      · روند: {row.up === null ? "-" : row.up ? "صعودی" : "نزولی"}
                    </span>
                  </p>
                  {row.stopLoss && (
                    <p className="text-xs text-slate-500">
                      حد ضرر: ${fmtPrice(row.stopLoss)} · حد سود: ${fmtPrice(row.takeProfit)}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <button
                      onClick={() => trade(a, "BUY")}
                      disabled={row.busy}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm py-1.5 rounded-lg"
                    >
                      خرید
                    </button>
                    <button
                      onClick={() => trade(a, "SELL")}
                      disabled={row.busy}
                      className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm py-1.5 rounded-lg"
                    >
                      فروش
                    </button>
                    <button
                      onClick={() => trade(a, "SKIP")}
                      disabled={row.busy}
                      className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm py-1.5 rounded-lg"
                    >
                      رد کردن
                    </button>
                  </div>
                  {row.saved && (
                    <p
                      className={`text-xs mt-1 ${
                        row.savedOk ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {row.saved}
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}