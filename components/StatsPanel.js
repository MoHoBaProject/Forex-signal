"use client";

import {
  calcPnl,
  getAccount,
  START_BALANCE,
  RISK_PCT,
  MAX_POSITION_PCT,
  MAX_OPEN_TRADES,
  FEE_PCT,
  SPREAD_PCT,
} from "../lib/storage";
import { fmtPrice, fmtSigned } from "../lib/assets";

const ACTION_FA = { BUY: "خرید", SELL: "فروش", SKIP: "رد شد" };
const DECISION_FA = { BUY: "خرید", SELL: "فروش", NO_SIGNAL: "بدون سیگنال" };
const REASON_FA = { TP: "حد سود", SL: "حد ضرر", MANUAL: "دستی" };

export default function StatsPanel({
  trades = [],
  prices = {},
  onClose = () => {},
  onClear = () => {},
}) {
  const acc = getAccount(trades, prices);

  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">حساب فرضی و تاریخچه</h2>
        <button
          onClick={onClear}
          className="text-xs bg-rose-900 hover:bg-rose-800 px-3 py-1.5 rounded-lg"
        >
          پاک کردن همه
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <Card title="موجودی (معاملات بسته‌شده)">
          <p className="text-lg font-semibold">${acc.balance.toFixed(2)}</p>
          <p className="text-xs text-slate-500 mt-1">شروع: ${START_BALANCE}</p>
        </Card>
        <Card title="دارایی با سود/زیان باز">
          <p
            className={`text-lg font-semibold ${
              acc.equity >= START_BALANCE ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            ${acc.equity.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            باز: {fmtSigned(acc.unrealized)} $
          </p>
        </Card>
        <Card title="آزاد / درگیر معامله">
          <p className="text-lg font-semibold">
            ${acc.free.toFixed(2)} <span className="text-slate-500 text-sm">/ ${acc.used.toFixed(2)}</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {acc.open} از {MAX_OPEN_TRADES} معامله‌ی باز
          </p>
        </Card>
        <Card title="نرخ برد (فقط بسته‌شده‌ها)">
          <p className="text-lg font-semibold">
            {acc.winRate === null ? "-" : `${acc.winRate.toFixed(0)}%`}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {acc.wins} برد از {acc.closed} · {acc.skipped} رد شده
          </p>
        </Card>
      </div>

      <p className="text-xs text-slate-500 mb-3 leading-relaxed">
        سود/زیان بسته‌شده: {fmtSigned(acc.realized)} $ · کارمزد کل: ${acc.fees.toFixed(2)}.
        قوانین: ریسک هر معامله {RISK_PCT}٪، سقف حجم {MAX_POSITION_PCT}٪ موجودی، کارمزد{" "}
        {FEE_PCT}٪ و اسپرد {SPREAD_PCT}٪ در هر طرف. حد ضرر و سود خودکار بسته می‌شوند.
      </p>

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

function Card({ title, children }) {
  return (
    <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
      <p className="text-xs text-slate-500 mb-1">{title}</p>
      {children}
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

  const status = trade.closed
    ? `بسته شد (${REASON_FA[trade.closeReason] || "دستی"})`
    : "باز";

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
          {!isSkip && trade.size && (
            <div className="text-xs text-slate-500">
              حجم: ${trade.size.toFixed(2)} · حد ضرر: ${fmtPrice(trade.sl)} · حد سود: $
              {fmtPrice(trade.tp)}
            </div>
          )}
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
                  pnl.net >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {fmtSigned(pnl.net)} $ ({fmtSigned(pnl.pct)}%)
              </div>
              <div className="text-xs text-slate-500">
                {status} · قیمت: ${fmtPrice(pnl.price)}
              </div>
              <div className="text-xs text-slate-600">کارمزد: ${pnl.fees.toFixed(3)}</div>
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
          بستن دستی معامله
        </button>
      )}
    </div>
  );
}