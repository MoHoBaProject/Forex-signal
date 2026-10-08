export const ASSETS = [
  { id: "pax-gold", symbol: "XAU", label: "طلا (PAXG)", bn: "PAXGUSDT" },
  { id: "bitcoin", symbol: "BTC", label: "Bitcoin", bn: "BTCUSDT" },
  { id: "ethereum", symbol: "ETH", label: "Ethereum", bn: "ETHUSDT" },
  { id: "binancecoin", symbol: "BNB", label: "BNB", bn: "BNBUSDT" },
  { id: "solana", symbol: "SOL", label: "Solana", bn: "SOLUSDT" },
  { id: "ripple", symbol: "XRP", label: "XRP", bn: "XRPUSDT" },
  { id: "dogecoin", symbol: "DOGE", label: "Dogecoin", bn: "DOGEUSDT" },
  { id: "cardano", symbol: "ADA", label: "Cardano", bn: "ADAUSDT" },
  { id: "tron", symbol: "TRX", label: "TRON", bn: "TRXUSDT" },
  { id: "avalanche-2", symbol: "AVAX", label: "Avalanche", bn: "AVAXUSDT" },
  { id: "chainlink", symbol: "LINK", label: "Chainlink", bn: "LINKUSDT" },
];

export function getAsset(id) {
  return ASSETS.find((a) => a.id === id);
}

export function fmtPrice(p) {
  if (typeof p !== "number" || isNaN(p)) return "-";
  if (p >= 1000) return p.toFixed(2);
  if (p >= 1) return p.toFixed(3);
  return p.toFixed(5);
}

export function fmtSigned(n, digits = 2) {
  if (typeof n !== "number" || isNaN(n)) return "-";
  return (n >= 0 ? "+" : "") + n.toFixed(digits);
}