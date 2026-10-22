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
        textColor: "#8a8c92",
        fontFamily: "IBM Plex Mono, ui-monospace, monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      crosshair: {
        vertLine: { color: "#3a3a3e", labelBackgroundColor: "#212023" },
        horzLine: { color: "#3a3a3e", labelBackgroundColor: "#212023" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    chartRef.current = chart;

    const candleSeries: ISeriesApi<"Candlestick"> = chart.addSeries(CandlestickSeries, {
      upColor: "#44a282",
      downColor: "#e5566f",
      borderVisible: false,
      wickUpColor: "#44a282",
      wickDownColor: "#e5566f",
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
                ? "rgba(68, 162, 130, 0.28)"
                : "rgba(229, 86, 111, 0.28)",
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
