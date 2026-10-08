"use client";

import { useEffect, useRef } from "react";

// Minimal dependency-free canvas chart: price line + fast/slow EMA overlay.
export default function Chart({ candles, fastEMA, slowEMA, height = 220 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !candles || candles.length === 0) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const closes = candles.map((c) => c.close);
    const allValues = [...closes, ...(fastEMA || []), ...(slowEMA || [])].filter(
      (v) => typeof v === "number" && !isNaN(v)
    );
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const pad = (max - min) * 0.1 || 1;
    const yMin = min - pad;
    const yMax = max + pad;

    const n = closes.length;
    const xStep = width / (n - 1 || 1);

    const yToPixel = (v) => height - ((v - yMin) / (yMax - yMin)) * height;

    function drawLine(values, color, lineWidth) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      values.forEach((v, i) => {
        const x = i * xStep;
        const y = yToPixel(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // price line
    drawLine(closes, "#64748b", 1.5);
    // EMAs
    if (fastEMA && fastEMA.length) drawLine(fastEMA, "#22d3ee", 2);
    if (slowEMA && slowEMA.length) drawLine(slowEMA, "#f59e0b", 2);
  }, [candles, fastEMA, slowEMA, height]);

  return (
    <div className="w-full">
      <canvas ref={canvasRef} style={{ width: "100%", height: `${height}px` }} />
      <div className="flex gap-4 text-xs mt-2 text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-slate-500 inline-block" /> Price
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-cyan-400 inline-block" /> Fast EMA
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-amber-500 inline-block" /> Slow EMA
        </span>
      </div>
    </div>
  );
}
