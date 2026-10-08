export const ASSETS = [
  { id: "pax-gold", symbol: "XAU", label: "طلا (PAXG)" },
  { id: "bitcoin", symbol: "BTC", label: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", label: "Ethereum" },
  { id: "binancecoin", symbol: "BNB", label: "BNB" },
  { id: "solana", symbol: "SOL", label: "Solana" },
  { id: "ripple", symbol: "XRP", label: "XRP" },
  { id: "dogecoin", symbol: "DOGE", label: "Dogecoin" },
  { id: "cardano", symbol: "ADA", label: "Cardano" },
  { id: "tron", symbol: "TRX", label: "TRON" },
  { id: "avalanche-2", symbol: "AVAX", label: "Avalanche" },
  { id: "chainlink", symbol: "LINK", label: "Chainlink" },
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