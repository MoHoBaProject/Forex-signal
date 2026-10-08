"use client";

import { calcPnl, computeStats, STAKE } from "../lib/storage";
import { fmtPrice, fmtSigned } from "../lib/assets";

const ACTION_FA = { BUY: "خرید", SELL: "فروش", SKIP: "رد شد" };
const DECISION_FA = { BUY: "خرید", SELL: "فروش", NO_SIGNAL: "بدون سیگنال" };

export default function StatsPanel({ trades, prices, onClose, onClear }) {
  const stats = computeStats(trades, prices);

  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">تاریخچه و آمار</h2>
        <button
          onClick={onClear}
          className="text-xs bg-rose-900 hover:bg-rose-800 px-3 py-1.5 rounded-lg"
        >
          پاک کردن همه
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
          <p className="text-xs text-slate-500 mb-1">نرخ برد</p>
          <p className="text-lg font-semibold">
            {stats.winRate === null ? "-" : `${stats.winRate.toFixed(0)}%`}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {stats.wins} برد از {stats.counted} معامله · {stats.skipCount} رد شده
          </p>
        </div>
        <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
          <p className="text-xs text-slate-500 mb-1">مجموع سود/زیان (هر معامله ${STAKE})</p>
          <p
            className={`text-lg font-semibold ${
              stats.totalUsd >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {fmtSigned(stats.totalUsd)} $
          </p>
          <p className="text-xs text-slate-500 mt-1">شامل معاملات باز و بسته</p>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {trades.length === 0 && (
          <p className="text-sm text-slate-500">
            هنوز چیزی ذخیره نشده. یک دارایی را محاسبه کن و یکی از دکمه‌ها را بزن.
          </p>
        )}
        {trades.map((t) => (
          <TradeRow key={t.id} trade={t} price={prices[t.assetId]} onClose={onClose} />
        ))}
      </div>
    </div>
  );
}

function TradeRow({ trade, price, onClose }) {
  const pnl = calcPnl(trade, price);
  const isSkip = trade.action === "SKIP";
  const moved =
    typeof price === "number" ? ((price - trade.entryPrice) / trade.entryPrice) * 100 : null;

  const actionColor =
    trade.action === "BUY"
      ? "text-emerald-400"
      : trade.action === "SELL"
      ? "text-rose-400"
      : "text-slate-400";

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-medium">{trade.label}</span>{" "}
          <span className={actionColor}>{ACTION_FA[trade.action]}</span>
          <div className="text-xs text-slate-500">
            {new Date(trade.createdAt).toLocaleString("fa-IR")} · ورود: $
            {fmtPrice(trade.entryPrice)}
          </div>
          <div className="text-xs text-slate-600">
            استراتژی آن لحظه: {DECISION_FA[trade.strategyDecision] || "-"}
          </div>
        </div>

        <div className="text-left shrink-0">
          {isSkip ? (
            <span className="text-xs text-slate-400">
              حرکت قیمت از آن زمان: {moved === null ? "-" : `${fmtSigned(moved)}%`}
            </span>
          ) : pnl ? (
            <>
              <div
                className={`font-semibold ${
                  pnl.usd >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {fmtSigned(pnl.usd)} $ ({fmtSigned(pnl.pct)}%)
              </div>
              <div className="text-xs text-slate-500">
                {trade.closed ? "بسته شد" : "باز"} · قیمت: ${fmtPrice(pnl.price)}
              </div>
            </>
          ) : (
            <span className="text-xs text-amber-500">در انتظار قیمت...</span>
          )}
        </div>
      </div>

      {!isSkip && !trade.closed && (
        <button
          onClick={() => onClose(trade)}
          disabled={typeof price !== "number"}
          className="mt-2 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-3 py-1.5 rounded-lg"
        >
          بستن معامله
        </button>
      )}
    </div>
  );
}