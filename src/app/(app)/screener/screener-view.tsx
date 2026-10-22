"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import {
  applyFilters,
  FILTER_DEFS,
  SCORE_DEFS,
  sortRows,
  type FilterThresholdKey,
  type ScreenerRow,
  type ScreenFilters,
  type SortDir,
  type SortField,
} from "@/engine/screener";
import { deleteScreenAction, saveScreenAction } from "./actions";
import type { SavedScreen } from "@/server/saved-screens";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCompactCurrency, formatNumber, formatPercent } from "@/lib/format";

type InputTuple = [FilterThresholdKey, string];

const NUMERIC_FIELDS = new Set<SortField>([
  "score", "revenue", "netIncome", "netMargin", "operatingMargin", "roe", "roa",
  "revenueGrowth1y", "revenueGrowth3y", "netIncomeGrowth1y", "fcf", "fcfMargin",
  "de", "liabilitiesToAssets", "pe", "latestClose", "priceReturn1y",
]);

type ColumnFormat = "text" | "iso" | "money" | "pct" | "pctSigned" | "num" | "score";

interface ColumnDef {
  field: SortField;
  key: keyof ScreenerRow;
  label: string;
  fmt: ColumnFormat;
}

const COLUMNS: ColumnDef[] = [
  { field: "ticker", key: "ticker", label: "Emiten", fmt: "text" },
  { field: "sector", key: "sector", label: "Sektor", fmt: "text" },
  { field: "latestPeriodEnd", key: "latestPeriodEnd", label: "Periode", fmt: "iso" },
  { field: "revenue", key: "revenue", label: "Pendapatan", fmt: "money" },
  { field: "netIncome", key: "netIncome", label: "Laba bersih", fmt: "money" },
  { field: "netMargin", key: "netMargin", label: "Margin NI", fmt: "pct" },
  { field: "roe", key: "roe", label: "ROE", fmt: "pct" },
  { field: "roa", key: "roa", label: "ROA", fmt: "pct" },
  { field: "revenueGrowth1y", key: "revenueGrowth1y", label: "Pend. 1 th", fmt: "pctSigned" },
  { field: "revenueGrowth3y", key: "revenueGrowth3y", label: "CAGR 3 th", fmt: "pctSigned" },
  { field: "fcfMargin", key: "fcfMargin", label: "Margin FCF", fmt: "pct" },
  { field: "de", key: "de", label: "D/E", fmt: "num" },
  { field: "liabilitiesToAssets", key: "liabilitiesToAssets", label: "Liab/aset", fmt: "pct" },
  { field: "pe", key: "pe", label: "P/E", fmt: "num" },
  { field: "latestClose", key: "latestClose", label: "Harga", fmt: "money" },
  { field: "priceReturn1y", key: "priceReturn1y", label: "Return 1y", fmt: "pctSigned" },
  { field: "score", key: "score", label: "Skor", fmt: "score" },
];

const MAX_VISIBLE_ROWS = 30;

function emptyInputs(): Record<FilterThresholdKey, string> {
  return Object.fromEntries(FILTER_DEFS.map((def) => [def.key, ""])) as Record<FilterThresholdKey, string>;
}

function inputToString(value: number, asPercent: boolean): string {
  const scaled = asPercent ? value * 100 : value;
  const rounded = Math.round(scaled * 100) / 100;
  return String(rounded);
}

function renderCell(row: ScreenerRow, column: ColumnDef): ReactNode {
  const value = row[column.key];
  switch (column.fmt) {
    case "money":
      return formatCompactCurrency(value as number | null, row.currency);
    case "pct":
      return formatPercent(value as number | null, { digits: 2 });
    case "pctSigned":
      return formatPercent(value as number | null, { signed: true });
    case "num":
      return formatNumber(value as number | null, 2);
    case "score":
      return formatNumber(value as number | null, 0);
    case "iso":
      return value === null ? "—" : String(value);
    default:
      return value === null ? "—" : String(value);
  }
}

const inputClass =
  "h-10 w-full rounded-[8px] border border-control bg-surface px-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent";

export function ScreenerView({
  rows,
  savedScreens,
}: {
  rows: ScreenerRow[];
  savedScreens: SavedScreen[];
}) {
  const [sectorInput, setSectorInput] = useState("");
  const [filterInputs, setFilterInputs] = useState<Record<FilterThresholdKey, string>>(emptyInputs());
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [screenName, setScreenName] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sectors = useMemo(
    () => [...new Set(rows.map((row) => row.sector).filter((s): s is string => s !== null))].sort(),
    [rows],
  );

  const filters: ScreenFilters = useMemo(() => {
    const applied: ScreenFilters = {};
    if (sectorInput !== "") applied.sector = sectorInput;
    for (const def of FILTER_DEFS) {
      const raw = filterInputs[def.key].trim();
      if (raw === "") continue;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) continue;
      applied[def.key] = def.asPercent ? parsed / 100 : parsed;
    }
    return applied;
  }, [sectorInput, filterInputs]);

  const visible = useMemo(
    () => sortRows(applyFilters(rows, filters), sortField, sortDir),
    [rows, filters, sortField, sortDir],
  );
  const shownRows = visible.slice(0, MAX_VISIBLE_ROWS);
  const activeFilterCount =
    (sectorInput !== "" ? 1 : 0) +
    FILTER_DEFS.filter((def) => filterInputs[def.key].trim() !== "").length;

  function handleHeaderClick(column: ColumnDef) {
    if (sortField === column.field) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(column.field);
    setSortDir(NUMERIC_FIELDS.has(column.field) ? "desc" : "asc");
  }

  function handleReset() {
    setSectorInput("");
    setFilterInputs(emptyInputs());
  }

  function handleApply(screen: SavedScreen) {
    const next = emptyInputs();
    const { sector, ...thresholds } = screen.filters;
    for (const [key, value] of Object.entries(thresholds) as InputTuple[]) {
      const def = FILTER_DEFS.find((d) => d.key === key);
      if (!def || typeof value !== "number") continue;
      next[key] = inputToString(value, def.asPercent);
    }
    setSectorInput(typeof sector === "string" ? sector : "");
    setFilterInputs(next);
  }

  function handleSave() {
    setActionError(null);
    startTransition(async () => {
      const result = await saveScreenAction(screenName, filters);
      if (!result.ok) {
        setActionError(result.error ?? "Gagal menyimpan layar.");
        return;
      }
      setScreenName("");
    });
  }

  function handleDelete(id: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await deleteScreenAction(id);
      if (!result.ok) setActionError(result.error ?? "Gagal menghapus layar.");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>
            Serangkaian metrik harus terbukti terisi dan lulus ambang; baris tanpa metrik
            tidak memenuhi filter dan tersaring keluar (tidak pernah dipalsukan 0).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Sektor</span>
              <select
                value={sectorInput}
                onChange={(event) => setSectorInput(event.target.value)}
                className={inputClass}
              >
                <option value="">Semua sektor</option>
                {sectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </label>
            {FILTER_DEFS.filter((def) => def.key !== "maxPe").map((def) => {
              if (def.key === "minPe") {
                const maxDef = FILTER_DEFS.find((item) => item.key === "maxPe");
                return (
                  <div key="pe-range" className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">
                      P/E (min – maks)
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step={0.1}
                        value={filterInputs.minPe}
                        onChange={(event) =>
                          setFilterInputs((current) => ({ ...current, minPe: event.target.value }))
                        }
                        className={inputClass}
                        placeholder="min"
                        aria-label="P/E minimum"
                      />
                      <span className="text-xs text-muted-foreground">–</span>
                      <input
                        type="number"
                        step={0.1}
                        value={filterInputs.maxPe}
                        onChange={(event) =>
                          setFilterInputs((current) => ({ ...current, maxPe: event.target.value }))
                        }
                        className={inputClass}
                        placeholder="maks"
                        aria-label={maxDef?.label ?? "P/E maksimum"}
                      />
                    </div>
                  </div>
                );
              }
              return (
                <label key={def.key} className="block">
                  <span className="mb-1 block text-xs text-muted-foreground">
                    {def.label}
                    {def.asPercent ? " (%)" : ""}
                  </span>
                  <input
                    type="number"
                    step={def.asPercent ? 1 : 0.1}
                    value={filterInputs[def.key]}
                    onChange={(event) =>
                      setFilterInputs((current) => ({ ...current, [def.key]: event.target.value }))
                    }
                    className={inputClass}
                    aria-label={def.label}
                  />
                </label>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Atur ulang semua filter
            </button>
            <span className="text-xs text-muted-foreground">
              {activeFilterCount === 0
                ? "Tanpa filter aktif — menampilkan seluruh perusahaan"
                : `${activeFilterCount} filter aktif`}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hasil ({visible.length} dari {rows.length} perusahaan)</CardTitle>
          <CardDescription>
            Klik judul kolom untuk mengurutkan; nilai — selalu berada di paling bawah
            {visible.length > MAX_VISIBLE_ROWS
              ? ` — tabel menampilkan ${MAX_VISIBLE_ROWS} baris pertama dari ${visible.length}`
              : ""}
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                {COLUMNS.map((column) => {
                  const numeric = column.fmt !== "text";
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      className={
                        numeric
                          ? "h-9 whitespace-nowrap px-1 text-right text-[11px] font-normal text-muted-foreground"
                          : "h-9 whitespace-nowrap px-1.5 text-left text-[11px] font-normal text-muted-foreground"
                      }
                      aria-sort={
                        sortField === column.field
                          ? sortDir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      <button
                        type="button"
                        onClick={() => handleHeaderClick(column)}
                        className="cursor-pointer hover:text-foreground"
                      >
                        {column.label}
                        {sortField === column.field ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {shownRows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-2 py-10 text-center text-muted-foreground">
                    Tidak ada perusahaan yang memenuhi kombinasi filter ini.
                  </td>
                </tr>
              ) : (
                shownRows.map((row) => (
                  <tr key={row.ticker} className="border-b border-rule last:border-b-0">
                    {COLUMNS.map((column) => {
                      const numeric = column.fmt !== "text";
                      return (
                        <td
                          key={column.key}
                          className={
                            numeric
                              ? "tnum h-[42px] whitespace-nowrap px-1 text-right text-[11px]"
                              : "h-[42px] px-1.5 text-[13px]"
                          }
                        >
                          {column.key === "ticker" ? (
                            <span className="flex flex-col">
                              <Link
                                href={`/explorer/${row.ticker}`}
                                className="w-fit text-[13px] font-semibold text-foreground decoration-accent/60 underline-offset-4 hover:underline"
                              >
                                {row.ticker}
                              </Link>
                              <span
                                className="max-w-[120px] truncate text-[11px] text-muted-foreground"
                                title={row.name}
                              >
                                {row.name}
                              </span>
                            </span>
                          ) : column.key === "sector" ? (
                            <span
                              className="block max-w-[112px] truncate text-[11px] text-muted-foreground"
                              title={row.sector ?? undefined}
                            >
                              {row.sector ?? "—"}
                            </span>
                          ) : column.key === "latestClose" ? (
                            <span className="flex flex-col items-end">
                              <span>{renderCell(row, column)}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {row.latestPriceDate ?? "—"}
                              </span>
                            </span>
                          ) : (
                            renderCell(row, column)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Layar tersimpan</CardTitle>
          <CardDescription>
            Kombinasi filter saat ini disimpan ke akun Anda (tabel saved_screens).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={screenName}
              onChange={(event) => setScreenName(event.target.value)}
              placeholder="Nama layar, mis. ROE tinggi rapi hutang"
              aria-label="Nama layar"
              className={`${inputClass} max-w-xs`}
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || screenName.trim() === ""}
              className={buttonVariants({ size: "sm" })}
            >
              Simpan layar
            </button>
            {actionError ? <span className="text-xs text-danger">{actionError}</span> : null}
          </div>

          {savedScreens.length === 0 ? (
            <p className="text-xs text-muted-foreground">Belum ada layar tersimpan.</p>
          ) : (
            <ul className="space-y-2">
              {savedScreens.map((screen) => (
                <li
                  key={screen.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card/50 px-3 py-2"
                >
                  <span className="text-sm">{screen.name}</span>
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApply(screen)}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Terapkan
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(screen.id)}
                      disabled={isPending}
                      className={buttonVariants({ variant: "ghost", size: "icon" })}
                      aria-label={`Hapus layar ${screen.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Aturan skor fundamental (0–100, rata-rata poin metrik yang tersedia; kurang dari 2
        metrik tersedia → skornya —):{" "}
        {SCORE_DEFS.map(
          (def) =>
            `${def.label} (${def.key === "de" ? "≤" : "≥"} ${
              def.key === "de" ? formatNumber(def.good, 1) : formatNumber(def.good * 100, 0) + "%"
            })`,
        ).join("; ")}
        . P/E hanya terisi bila EPS terimpor dan harga tersedia dalam jendela mendekati
        periode laporan; P/B dan EV/EBITDA tidak dihitung (jumlah saham tidak tersedia) —
        bukan angka karangan.
      </p>
    </div>
  );
}
