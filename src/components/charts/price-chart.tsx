"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type CandlestickData,
  type HistogramData,
  type Time,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";

export interface PricePoint {
  date: string; // YYYY-MM-DD — BusinessDay lightweight-charts
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Candlestick + volume (overlay) — lightweight-charts v5 (addSeries API).
 * Client-only: dibuat sekali di useEffect, dihapus rapi saat unmount.
 * Warna mengikuti palet dark charcoal (up hijau / down merah muted).
 */
export function PriceChart({ points }: { points: PricePoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "#8a8f98",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    chartRef.current = chart;

    const candleSeries: ISeriesApi<"Candlestick"> = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    candleSeries.setData(
      points.map(
        (point) =>
          ({
            time: point.date as Time,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
          }) satisfies CandlestickData,
      ),
    );

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.72, bottom: 0 },
    });
    volumeSeries.setData(
      points.map(
        (point) =>
          ({
            time: point.date as Time,
            value: point.volume,
            color:
              point.close >= point.open
                ? "rgba(34, 197, 94, 0.35)"
                : "rgba(239, 68, 68, 0.35)",
          }) satisfies HistogramData,
      ),
    );

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [points]);

  if (points.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="h-80 w-full"
      role="img"
      aria-label={`Chart harga: ${points.length} bar`}
    />
  );
}
