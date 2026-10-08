t# Signal Lab

Rule-based technical signal tracker for Gold (XAU/USD) and Bitcoin (BTC/USD).
Built with Next.js, runs **entirely client-side** - no backend, no server,
no API keys, no auto-trading. Everything is saved in your browser's
localStorage only.

## What this does

- Click "Calculate" on a chart -> it fetches the current price, computes an
  EMA crossover strategy confirmed by an ATR volatility filter, and shows
  you a Buy / Sell / No-signal decision with suggested stop-loss and
  take-profit.
- Every non-neutral decision is saved locally with a timestamp and entry
  price.
- After an hour has passed, the app automatically checks that saved signal
  against the current price and records whether it would have been
  profitable (hypothetically, on $100 per trade).
- The History & Stats panel shows your win rate % and total hypothetical
  P&L, overall and split by asset.

## What this does NOT do

- It does **not** place real trades or connect to any broker.
- It does **not** predict the market - it's pure rule-based technical
  analysis (EMA crossover + ATR), the same kind of thing you'd do by hand
  drawing lines on a chart.
- It is not financial advice.

## Local development

```
npm install
npm run dev
```

Open http://localhost:3000

## Build for deployment (static export)

```
npm run build
```

This outputs a static site into the `out/` folder (configured via
`output: 'export'` in `next.config.js`). No Node.js server is needed to run
it - any static host works.

## Deploy on Cloudflare Pages

1. Push this project to a GitHub repository.
2. In the Cloudflare dashboard, go to **Workers & Pages -> Create ->
   Pages -> Connect to Git**, and select your repo.
3. Build settings:
   - Framework preset: **Next.js (Static HTML Export)**
   - Build command: `npm run build`
   - Build output directory: `out`
4. Deploy. Cloudflare will give you a `*.pages.dev` URL.

## PWA / installing as an app

The app includes a `manifest.json` and a service worker (`sw.js`) so once
deployed over HTTPS (Cloudflare Pages gives you this automatically), you
can "Add to Home Screen" on mobile or "Install" in desktop Chrome/Edge, and
it behaves like a native app with basic offline caching of the app shell.
Price data itself always requires an internet connection, since it's fetched
live.

## Data sources

- Gold and Bitcoin spot prices: [gold-api.com](https://gold-api.com) - free,
  no API key required.
- Bitcoin fallback: CoinGecko public API, used only if gold-api.com is
  unreachable.

## Notes on the strategy

This is intentionally simple and transparent:

- **Fast EMA (12)** and **Slow EMA (26)** are computed over recent price
  points.
- A **crossover** (fast EMA crossing above/below slow EMA) generates a
  candidate Buy/Sell signal.
- An **ATR (Average True Range)** filter checks that the crossover gap is
  large enough relative to recent volatility to be meaningful, filtering
  out noise/chop.
- Stop-loss and take-profit are calculated as multiples of ATR from the
  entry price.

You can tune `fastPeriod`, `slowPeriod`, `atrPeriod`, and `atrMultiplier`
in `lib/strategy.js`.

### A note on candle data

Since this app has no backend and uses only free, no-key price endpoints
(which return current spot price, not historical OHLC candles), it builds
its own short-term candle series locally over time, from your own repeated
"Calculate" clicks, stored in localStorage. Until you've clicked Calculate
enough times to build up ~30 real data points, it uses a short synthetic
warm-up series (clearly labeled in the UI) just so the EMA/ATR math has
something to run on. The more you use it, the more the chart reflects real
price history on your device.
