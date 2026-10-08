"use client";

import { useEffect, useMemo, useState } from "react";
import AssetPanel from "../components/AssetPanel";
import ScanList from "../components/ScanList";
import StatsPanel from "../components/StatsPanel";
import { ASSETS, getAsset } from "../lib/assets";
import { fetchPrices } from "../lib/dataSources";
import { loadTrades, closeTrade, clearTrades } from "../lib/storage";

export default function Home() {
  const [selectedId, setSelectedId] = useState(ASSETS[0].id);
  const [trades, setTrades] = useState([]);
  const [prices, setPrices] = useState({});
  const [priceError, setPriceError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    setTrades(loadTrades());
  }, []);

  const idsKey = useMemo(() => {
    const ids = new Set([selectedId]);
    trades.forEach((t) => {
      if (!t.closed) ids.add(t.assetId);
    });
    return Array.from(ids).sort().join(",");
  }, [selectedId, trades]);

  useEffect(() => {
    let stopped = false;
    const ids = idsKey.split(",");

    async function tick() {
      try {
        const p = await fetchPrices(ids);
        if (stopped) return;
        setPrices((prev) => ({ ...prev, ...p }));
        setPriceError(null);
        setUpdatedAt(new Date());
      } catch (e) {
        if (!stopped) setPriceError(e.message);
      }
    }

    tick();
    const iv = setInterval(tick, 30000);
    return () => {
      stopped = true;
      clearInterval(iv);
    };
  }, [idsKey]);

  function handleClose(trade) {
    const price = prices[trade.assetId];
    if (typeof price !== "number") return;
    closeTrade(trade.id, price);
    setTrades(loadTrades());
  }

  function handleClear() {
    if (confirm("همه‌ی تاریخچه پاک شود؟ این کار قابل بازگشت نیست.")) {
      clearTrades();
      setTrades([]);
    }
  }

  const asset = getAsset(selectedId);

  return (
    <main dir="rtl" className="max-w-3xl mx-auto px-4 py-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold">Signal Lab</h1>
        <p className="text-sm text-slate-400 mt-1">
          سیگنال EMA + ATR، همه‌چیز فقط در مرورگر خودت ذخیره می‌شود. معامله‌ی واقعی انجام
          نمی‌شود.
        </p>
      </header>

      <ScanList onSaved={() => setTrades(loadTrades())} />

      <p className="text-xs mt-2 text-slate-500">
        {priceError
          ? `خطا در به‌روزرسانی قیمت: ${priceError}`
          : updatedAt
          ? `آخرین به‌روزرسانی قیمت معاملات باز: ${updatedAt.toLocaleTimeString("fa-IR")} (هر ۳۰ ثانیه)`
          : "در حال دریافت قیمت..."}
      </p>

      <StatsPanel trades={trades} prices={prices} onClose={handleClose} onClear={handleClear} />

      <h2 className="text-lg font-semibold mt-8 mb-3">چارت و جزئیات یک ارز</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        {ASSETS.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelectedId(a.id)}
            className={`text-sm px-3 py-1.5 rounded-xl border transition ${
              a.id === selectedId
                ? "bg-cyan-600 border-cyan-500 text-white"
                : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {a.symbol}
          </button>
        ))}
      </div>

      <AssetPanel
        key={asset.id}
        asset={asset}
        livePrice={prices[asset.id]}
        onSaved={() => setTrades(loadTrades())}
      />

      <footer className="mt-8 text-xs text-slate-600 leading-relaxed">
        <p>
          این ابزار فقط اطلاعات نشان می‌دهد و توصیه‌ی مالی نیست. سود و زیان‌ها فرضی هستند و
          روی دستگاه خودت محاسبه می‌شوند. هیچ تضمینی برای سود وجود ندارد.
        </p>
      </footer>
    </main>
  );
}