"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { ScreenerRow } from "@/engine/screener";

const MAX_COMPARE = 5;

type MetricFormat = "money" | "pct" | "pctSigned" | "num" | "iso";

interface MetricDef {
  key: keyof ScreenerRow;
  label: string;
  fmt: MetricFormat;
}

/**
 * Definisi metrik perbandingan — P/E hanya bila EPS + harga tersedia; P/B dan
 * EV/EBITDA sengaja TIDAK ADA (butuh jumlah saham yang tidak tersimpan).
 */
export const COMPARE_METRICS: MetricDef[] = [
  { key: "latestClose", label: "Harga terakhir", fmt: "money" },
  { key: "latestPriceDate", label: "Tanggal harga", fmt: "iso" },
  { key: "priceReturn1y", label: "Imbal hasil 1 th (dari harga)", fmt: "pctSigned" },
  { key: "revenue", label: "Pendapatan (th terakhir)", fmt: "money" },
  { key: "netIncome", label: "Laba bersih", fmt: "money" },
  { key: "netMargin", label: "Margin laba bersih", fmt: "pct" },
  { key: "operatingMargin", label: "Margin operasi", fmt: "pct" },
  { key: "roe", label: "ROE", fmt: "pct" },
  { key: "roa", label: "ROA", fmt: "pct" },
  { key: "revenueGrowth1y", label: "Pertumbuhan pendapatan (1 th)", fmt: "pctSigned" },
  { key: "revenueGrowth3y", label: "Pendapatan CAGR (3 th)", fmt: "pctSigned" },
  { key: "netIncomeGrowth1y", label: "Pertumbuhan laba (1 th)", fmt: "pctSigned" },
  { key: "fcf", label: "Arus kas bebas (turunan)", fmt: "money" },
  { key: "fcfMargin", label: "Margin arus kas bebas", fmt: "pct" },
  { key: "de", label: "Hutang ÷ ekuitas", fmt: "num" },
  { key: "liabilitiesToAssets", label: "Liabilitas ÷ aset", fmt: "pct" },
  { key: "pe", label: "P/E", fmt: "num" },
  { key: "score", label: "Skor fundamental (0–100)", fmt: "num" },
  { key: "latestPeriodEnd", label: "Periode laporan terakhir", fmt: "iso" },
];

function renderValue(row: ScreenerRow, metric: MetricDef): string {
  const value = row[metric.key];
  switch (metric.fmt) {
    case "money":
      return formatCompactCurrency(value as number | null, row.currency);
    case "pct":
      return formatPercent(value as number | null);
    case "pctSigned":
      return formatPercent(value as number | null, { signed: true });
    case "num":
      return formatNumber(value as number | null, 2);
    case "iso":
      return value === null ? "—" : String(value);
  }
}

export function CompareView({ rows }: { rows: ScreenerRow[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return rows;
    return rows.filter((row) =>
      `${row.ticker} ${row.name} ${row.sector ?? ""}`.toLowerCase().includes(needle),
    );
  }, [rows, query]);

  const selectedRows = useMemo(
    () => selected.map((ticker) => rows.find((row) => row.ticker === ticker)).filter((row): row is ScreenerRow => row !== undefined),
    [selected, rows],
  );

  function addTicker(ticker: string) {
    setNotice(null);
    if (selected.includes(ticker)) return;
    if (selected.length >= MAX_COMPARE) {
      setNotice(`Maksimum ${MAX_COMPARE} perusahaan dalam satu perbandingan.`);
      return;
    }
    setSelected((current) => [...current, ticker]);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pilih perusahaan ({selected.length}/{MAX_COMPARE})</CardTitle>
          <CardDescription>
            2–5 perusahaan; satu kolom tabel. Metrik yang tidak tersimpan tampil — (tidak
            pernah 0 dan tidak pernah angka karangan).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari ticker, nama, atau sektor…"
            aria-label="Cari perusahaan untuk dibandingkan"
            className="h-9 w-full max-w-xs rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          {selected.length > 0 ? (
            <ul className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
              {selectedRows.map((row) => (
                <li key={row.ticker}>
                  <button
                    type="button"
                    onClick={() => setSelected((current) => current.filter((t) => t !== row.ticker))}
                    className="rule-active inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-foreground"
                    aria-label={`Lepaskan ${row.ticker} dari perbandingan`}
                  >
                    {row.ticker}
                    <X className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Belum ada perusahaan terpilih — klik salah satu di bawah.
            </p>
          )}

          {notice ? <p className="text-xs text-negative">{notice}</p> : null}

          <ul className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
            {candidates
              .filter((row) => !selected.includes(row.ticker))
              .slice(0, 24)
              .map((row) => (
                <li key={row.ticker}>
                  <button
                    type="button"
                    onClick={() => addTicker(row.ticker)}
                    title={row.name}
                    className="cursor-pointer text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    + {row.ticker}
                  </button>
                </li>
              ))}
            {candidates.length === 0 ? (
              <li className="text-xs text-muted-foreground">Tidak ada yang cocok dengan pencarian.</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>

      {selectedRows.length < 2 ? (
        <p className="border-t border-rule px-6 py-10 text-center text-[13px] text-muted-foreground">
          Pilih minimal 2 perusahaan untuk melihat tabel perbandingan.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Perbandingan ({selectedRows.length} perusahaan)</CardTitle>
            <CardDescription>
              Periode disajikan per kolom; unit mata uang per perusahaan mengikuti currency
              tersimpan (USD). Angka = metrik setahun terakhir yang tersimpan.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto px-2 pb-2 pt-0">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="h-9 px-2 text-left text-[11px] font-normal text-muted-foreground">
                    Metrik
                  </th>
                  {selectedRows.map((row) => (
                    <th scope="col" className="h-9 px-2 text-right" key={row.ticker}>
                      <span className="block text-[12px] font-semibold text-foreground">{row.ticker}</span>
                      <span
                        className="block max-w-[160px] truncate text-[11px] font-normal text-muted-foreground"
                        title={row.name}
                      >
                        {row.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_METRICS.map((metric) => (
                  <tr key={metric.key} className="border-b border-rule last:border-b-0">
                    <th
                      scope="row"
                      className="h-[42px] px-2 text-left text-xs font-normal text-muted-foreground"
                    >
                      {metric.label}
                    </th>
                    {selectedRows.map((row) => (
                      <td key={row.ticker} className="tnum h-[42px] px-2 text-right text-[13px]">
                        {renderValue(row, metric)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        P/B dan EV/EBITDA tidak ditampilkan: keduanya butuh jumlah saham beredar yang belum
        tersimpan di database. Imbal hasil 1 th dihitung harga-ke-harga bila ada patokan di
        sekitar (terbaru − 365 hari ±92 hari); dengan data harga kosong, seluruh kolom harga
        tinggal —. Beberapa CSV impor bisa menyertakan EPS — P/E menghitung close ÷ EPS bila
        keduanya positif; selainnya —.
      </p>
    </div>
  );
}
