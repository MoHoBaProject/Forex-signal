import { runStrategy, emaLevels } from "./strategy";
import { runRsiBollinger, rsiBollingerLevels } from "./rsiBollinger";

export const STRATEGIES = [
  { id: "ema", name: "EMA Trend", run: runStrategy, levels: emaLevels },
  { id: "rsibb", name: "RSI + Bollinger", run: runRsiBollinger, levels: rsiBollingerLevels },
];

export function getStrategy(id) {
  return STRATEGIES.find((s) => s.id === id);
}

export function runAll(candles) {
  const out = {};
  STRATEGIES.forEach((s) => {
    out[s.id] = s.run(candles);
  });
  return out;
}