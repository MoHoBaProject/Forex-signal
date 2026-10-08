"use client";

import AssetPanel from "../components/AssetPanel";
import StatsPanel from "../components/StatsPanel";

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Signal Lab</h1>
        <p className="text-sm text-slate-400 mt-1">
          Rule-based EMA + ATR signal tracker. Runs entirely in your browser -
          no backend, no account, no auto-trading. Everything is saved locally
          on this device only.
        </p>
      </header>

      <div className="space-y-5">
        <AssetPanel asset="XAU" label="Gold (XAU/USD)" symbol="XAU" />
        <AssetPanel asset="BTC" label="Bitcoin (BTC/USD)" symbol="BTC" />
      </div>

      <StatsPanel />

      <footer className="mt-8 text-xs text-slate-600 leading-relaxed">
        <p>
          This tool only generates informational signals based on a simple
          EMA crossover confirmed by an ATR volatility filter. It does not
          place trades, connect to any broker, or guarantee profit. Past
          performance shown here is hypothetical and calculated locally on
          your device. Nothing here is financial advice.
        </p>
      </footer>
    </main>
  );
}
