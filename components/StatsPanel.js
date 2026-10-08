"use client";

import { useEffect, useState } from "react";
import { loadSignals, computeStats, clearSignals } from "../lib/storage";

export default function StatsPanel() {
  const [signals, setSignals] = useState([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setSignals(loadSignals());
  }, [tick]);

  const refresh = () => setTick((t) => t + 1);

  const overall = computeStats(signals);
  const gold = computeStats(signals, "XAU");
  const btc = computeStats(signals, "BTC");

  const handleClear = () => {
    if (confirm("Clear all saved signal history? This cannot be undone.")) {
      clearSignals();
      refresh();
    }
  };

  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">History & stats</h2>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg"
          >
            Refresh
          </button>
          <button
            onClick={handleClear}
            className="text-xs bg-rose-900 hover:bg-rose-800 px-3 py-1.5 rounded-lg"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatBlock title="Overall" stats={overall} />
        <StatBlock title="Gold" stats={gold} />
        <StatBlock title="Bitcoin" stats={btc} />
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {signals.length === 0 && (
          <p className="text-sm text-slate-500">No signals saved yet. Click Calculate on a chart above.</p>
        )}
        {signals.map((s) => (
          <SignalRow key={s.id} signal={s} />
        ))}
      </div>
    </div>
  );
}

function StatBlock({ title, stats }) {
  return (
    <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
      <p className="text-xs text-slate-500 mb-1">{title}</p>
      <p className="text-sm">
        Win rate:{" "}
        <span className="font-semibold">
          {stats.winRate === null ? "-" : `${stats.winRate.toFixed(0)}%`}
        </span>
      </p>
      <p className="text-sm">
        P&L on $100/trade:{" "}
        <span className={`font-semibold ${stats.totalPnlOn100 >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {stats.totalPnlOn100 >= 0 ? "+" : ""}
          {stats.totalPnlOn100.toFixed(2)}
        </span>
      </p>
      <p className="text-xs text-slate-500 mt-1">
        {stats.evaluatedCount} evaluated, {stats.pendingCount} pending
      </p>
    </div>
  );
}

function SignalRow({ signal }) {
  const pending = signal.outcomePct === null || signal.outcomePct === undefined;
  const win = !pending && signal.outcomePct > 0;
  return (
    <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm">
      <div>
        <span className="font-medium">{signal.label}</span>{" "}
        <span
          className={
            signal.decision === "BUY"
              ? "text-emerald-400"
              : signal.decision === "SELL"
              ? "text-rose-400"
              : "text-slate-400"
          }
        >
          {signal.decision}
        </span>
        <div className="text-xs text-slate-500">
          {new Date(signal.createdAt).toLocaleString()} @ ${signal.entryPrice?.toFixed(2)}
        </div>
      </div>
      <div className="text-right">
        {pending ? (
          <span className="text-xs text-amber-500">Pending (check after 1h)</span>
        ) : (
          <span className={`text-sm font-semibold ${win ? "text-emerald-400" : "text-rose-400"}`}>
            {signal.outcomePct >= 0 ? "+" : ""}
            {signal.outcomePct.toFixed(2)}%
          </span>
        )}
      </div>
    </div>
  );
}
