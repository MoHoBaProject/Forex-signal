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
import { STRATEGIES, getStrategy } from "../lib/strategies";
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
  const accs = STRATEGIES.map((s) => ({ s, acc: getAccount(trades, prices, s.id) }));
  const ranked = [...accs].sort((x, y) => y.acc.equity - x.acc.equity);
  const anyTrades = accs.some(({ acc }) => acc.open + acc.closed > 0);
  const minClosed = Math.min(...accs.map(({ acc }) => acc.closed));

  const money = (v) => ({ t: `$${v.toFixed(2)}`, c: "" });
  const signed = (v) => ({
    t: `${fmtSigned(v)} $`,
    c: v >= 0 ? "text-emerald-400" : "text-rose-400",
  });

  const rowsDef = [
    ["موجودی (بسته‌شده‌ها)", (a) => money(a.balance)],
    [
      "دارایی با سود/زیان باز",
      (a) => ({
        t: `$${a.equity.toFixed(2)}`,
        c: a.equity >= START_BALANCE ? "text-emerald-400" : "text-rose-400",
      }),
    ],
    ["سود/زیان بسته‌شده", (a) => signed(a.realized)],
    ["سود/زیان باز", (a) => signed(a.unrealized)],
    [
      "نرخ برد",
      (a) => ({ t: a.winRate === null ? "-" : `${a.winRate.toFixed(0)}% (${a.wins}/${a.closed})`, c: "" }),
    ],
    ["بسته / باز", (a) => ({ t: `${a.closed} / ${a.open}`, c: "" })],
    ["کارمزد کل", (a) => money(a.fees)],
    ["رد شده", (a) => ({ t: String(a.skipped), c: "" })],
  ];

  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">مقایسه‌ی استراتژی‌ها</h2>
        <button
          onClick={onClear}
          className="text-xs bg-rose-900 hover:bg-rose-800 px-3 py-1.5 rounded-lg"
        >
          پاک کردن همه
        </button>
      </div>

      <div className="overflow-x-auto mb-2">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-right text-xs text-slate-500 font-normal pb-2"></th>
              {accs.map(({ s }) => (
                <th key={s.id} className="text-xs text-cyan-300 font-medium pb-2">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowsDef.map(([label, fn]) => (
              <tr key={label} className="border-t border-slate-800">
                <td className="py-1.5 text-xs text-slate-400">{label}</td>
                {accs.map(({ s, acc }) => {
                  const cell = fn(acc);
                  return (
                    <td key={s.id} className={`py-1.5 text-center font-medium ${cell.c}`}>
                      {cell.t}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {anyTrades && (
        <p className="text-xs text-slate-300 mb-1">
          فعلاً جلوتر: <span className="text-cyan-300">{ranked[0].s.name}</span>
          {ranked.length > 1 &&
            ` (اختلاف دارایی: ${fmtSigned(ranked[0].acc.equity - ranked[1].acc.equity)} $)`}
        </p>
      )}
      <p className="text-xs text-slate-500 mb-3 leading-relaxed">
        {minClosed < 20
          ? "نمونه‌ی هنوز کم است؛ برای مقایسه‌ی معنادار حداقل حدود ۲۰ تا ۳۰ معامله‌ی بسته‌شده برای هر استراتژی لازم است."
          : "تعداد معاملات برای مقایسه‌ی اولیه کافی است، ولی باز هم تضمینی برای آینده نیست."}{" "}
        هر استراتژی حساب ${START_BALANCE} جدا دارد؛ ریسک هر معامله {RISK_PCT}٪، سقف حجم{" "}
        {MAX_POSITION_PCT}٪، حداکثر {MAX_OPEN_TRADES} معامله‌ی باز، کارمزد {FEE_PCT}٪ و اسپرد{" "}
        {SPREAD_PCT}٪ در هر طرف. حد ضرر و سود خودکار بسته می‌شوند.
      </p>

      <h3 className="text-sm font-semibold mb-2">تاریخچه</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {trades.length === 0 && (
          <p className="text-sm text-slate-500">
            هنوز چیزی ذخیره نشده. «محاسبه‌ی همه» را بزن و زیر هر استراتژی یکی از دکمه‌ها را بزن.
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
  const strategyName = getStrategy(trade.strategyId)?.name || "-";

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
          <span className={actionColor}>{ACTION_FA[trade.action]}</span>{" "}
          <span className="text-xs bg-slate-800 text-cyan-300 px-1.5 py-0.5 rounded">
            {strategyName}
          </span>
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
            سیگنال استراتژی آن لحظه: {DECISION_FA[trade.strategyDecision] || "-"}
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
                className={`font-semibold ${pnl.net >= 0 ? "text-emerald-400" : "text-rose-400"}`}
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