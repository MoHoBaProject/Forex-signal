"use client";

import { useState } from "react";
import StrategyRow from "./StrategyRow";
import { ASSETS, fmtPrice } from "../lib/assets";
import { STRATEGIES, runAll } from "../lib/strategies";
import { fetchCandles, fetchPrices } from "../lib/dataSources";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function ScanList({ onSaved }) {
  const [rows, setRows] = useState({});
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState(null);

  function patch(id, data) {
    setRows((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...data } }));
  }

  async function scanOne(a, price) {
    patch(a.id, { status: "loading", error: null });
    try {
      const c = await fetchCandles(a.id);
      const results = runAll(c);
      patch(a.id, {
        status: "done",
        results,
        price: typeof price === "number" ? price : results.ema.lastPrice,
      });
      return true;
    } catch (e) {
      patch(a.id, { status: "error", error: e.message });
      return false;
    }
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

    ASSETS.forEach((a) => patch(a.id, { status: "loading", price: prices[a.id] }));

    const failed = [];
    for (const a of ASSETS) {
      const ok = await scanOne(a, prices[a.id]);
      if (!ok) failed.push(a);
      await sleep(300);
    }

    // یک دور دیگر فقط برای ارزهایی که خطا دادند
    for (const a of failed) {
      await sleep(1500);
      await scanOne(a, prices[a.id]);
    }
    setScanning(false);
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
          دکمه‌ی «محاسبه‌ی همه» را بزن تا نتیجه‌ی هر دو استراتژی برای همه‌ی ارزها یک‌جا بیاید.
        </p>
      )}

      <div className="space-y-2">
        {ASSETS.map((a) => {
          const row = rows[a.id];
          if (!row) return null;

          const decisions = row.results
            ? STRATEGIES.map((s) => row.results[s.id]?.decision)
            : [];
          const hasBuy = decisions.includes("BUY");
          const hasSell = decisions.includes("SELL");
          const border =
            hasBuy && hasSell
              ? "border-amber-700"
              : hasBuy
              ? "border-emerald-700"
              : hasSell
              ? "border-rose-700"
              : "border-slate-800";

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
                <div className="mt-1">
                  <p className="text-xs text-rose-400">{row.error}</p>
                  <button
                    onClick={() => scanOne(a, row.price)}
                    className="mt-1 text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg"
                  >
                    تلاش مجدد
                  </button>
                </div>
              )}

              {row.status === "done" && (
                <div className="mt-2 space-y-2">
                  {STRATEGIES.map((s) => (
                    <StrategyRow
                      key={s.id}
                      asset={a}
                      strategy={s}
                      result={row.results[s.id]}
                      price={row.price}
                      onSaved={onSaved}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}