/**
 * engine/screener.ts — mesin saring, sortir, dan skor fundamental (murni, tanpa I/O).
 * Semua metrik dihitung hanya dari data yang benar-benar tersimpan; nilai tidak
 * tersedia tetap `null` (disajikan "—"). Baris tanpa metrik tidak bisa membuktikan
 * lulus filter suatu ambang — jadi dikecualikan dari hasil.
 *
 * Konvensi angka: rasio 0.12 = 12%; UI menampilkan persen, filters_json DB
 * menyimpan rasio apa adanya agar bebas ambigu.
 */
import { computeFundamentals, type StatementSnapshot } from "./fundamentals";

export interface CompanyMeta {
  id: string;
  ticker: string;
  name: string;
  sector: string | null;
  currency: string;
}

export interface NewestPrice {
  date: string; // YYYY-MM-DD
  close: number;
}

/** Sumber per perusahaan: hanya array serializable — mudah diuji & dikirim ke browser. */
export interface ScreenerSourceRow {
  meta: CompanyMeta;
  statements: StatementSnapshot[]; // hanya periode annual
  /**
   * Harga penutupan ASC (lama → baru), maksimal ~400 bar.
   * Engine memilih sendiri harga terbaru + patokan ±1 tahun.
   */
  prices: NewestPrice[];
}

export interface ScreenerRow {
  ticker: string;
  name: string;
  sector: string | null;
  currency: string;
  latestPeriodEnd: string | null;
  revenue: number | null;
  netIncome: number | null;
  eps: number | null;
  netMargin: number | null;
  operatingMargin: number | null;
  roe: number | null;
  roa: number | null;
  revenueGrowth1y: number | null;
  revenueGrowth3y: number | null;
  netIncomeGrowth1y: number | null;
  fcf: number | null;
  fcfMargin: number | null;
  /** total_debt ÷ ekuitas bila debt ada, else total_liabilities ÷ ekuitas. */
  de: number | null;
  liabilitiesToAssets: number | null;
  /** close ÷ EPS — hanya bila keduanya tersedia dan positif. */
  pe: number | null;
  latestClose: number | null;
  latestPriceDate: string | null;
  /** Harga terbaru vs harga di sekitar (terbaru − 365 hari ±92) — bila ada. */
  priceReturn1y: number | null;
  /** Skor aturan 0–100 dari metrik yang ADA; < 2 metrik tersedia → null. */
  score: number | null;
}

const MATCH_TOLERANCE_MS = 92 * 86_400_000;
const YEAR_LOOKBACK_MS = 365 * 86_400_000;

function ascending(rows: StatementSnapshot[]): StatementSnapshot[] {
  return [...rows].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
}

function pickNum(data: Record<string, number>, key: string): number | null {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Baris terdekat ke target (±92 hari) — dipakai agar metrik terpasang seperiode. */
function closestTo(rows: StatementSnapshot[], targetMs: number): StatementSnapshot | null {
  let best: StatementSnapshot | null = null;
  let bestDelta = Infinity;
  for (const row of rows) {
    const delta = Math.abs(Date.parse(row.periodEnd) - targetMs);
    if (delta < bestDelta && delta <= MATCH_TOLERANCE_MS) {
      bestDelta = delta;
      best = row;
    }
  }
  return best;
}

function safeRatio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return numerator / denominator;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// ---------------------------------------------------------------------------
// Skor aturan — transparan dan daftar bobotnya diekspos untuk UI catatan.
// ---------------------------------------------------------------------------

export const SCORE_DEFS: ReadonlyArray<{
  key: "netMargin" | "roe" | "revenueGrowth1y" | "fcfMargin" | "de";
  label: string;
  /** Nilai yang dianggap "baik penuh" (skor metrik = 1). */
  good: number;
}> = [
  { key: "netMargin", label: "Margin laba bersih", good: 0.15 },
  { key: "roe", label: "ROE", good: 0.18 },
  { key: "revenueGrowth1y", label: "Pertumbuhan pendapatan 1 th", good: 0.15 },
  { key: "fcfMargin", label: "Margin arus kas bebas", good: 0.08 },
  { key: "de", label: "Hutang ÷ ekuitas (rendah lebih baik)", good: 1.0 },
] as const;

/** Subset metrik yang menentukan skor — semua nullable, sisanya diabaikan. */
export type ScoreInput = Partial<
  Record<"netMargin" | "roe" | "revenueGrowth1y" | "fcfMargin" | "de", number | null>
>;

export function computeScore(row: ScoreInput): number | null {
  const parts: number[] = [];
  for (const def of SCORE_DEFS) {
    const value = row[def.key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (def.key === "de") {
      // Ekuitas negatif membuat D/E tak bermakna → metrik ini dilewati.
      if (value < 0) continue;
      parts.push(clamp01((def.good * 2 - value) / (def.good * 2)));
      continue;
    }
    // Margin/pertumbuhan negatif tetap dihitung (skor metrik 0) — jujur.
    parts.push(clamp01(value / def.good));
  }
  if (parts.length < 2) return null;
  const mean = parts.reduce((sum, part) => sum + part, 0) / parts.length;
  return Math.round(mean * 100);
}

// ---------------------------------------------------------------------------
// Filter — kunci datar supaya nyaman disimpan sebagai filters_json.
// ---------------------------------------------------------------------------

export type ScreenerFilterKey =
  | "sector"
  | "minNetMargin"
  | "minRoe"
  | "minRoa"
  | "minRevenueGrowth1y"
  | "minRevenueGrowth3y"
  | "minFcfMargin"
  | "maxDe"
  | "maxLiabToAssets"
  | "minPe"
  | "maxPe";

export type ScreenFilters = Partial<Record<ScreenerFilterKey, number | string>>;

const FILTER_FIELD: Record<Exclude<ScreenerFilterKey, "sector">, keyof ScreenerRow> = {
  minNetMargin: "netMargin",
  minRoe: "roe",
  minRoa: "roa",
  minRevenueGrowth1y: "revenueGrowth1y",
  minRevenueGrowth3y: "revenueGrowth3y",
  minFcfMargin: "fcfMargin",
  maxDe: "de",
  maxLiabToAssets: "liabilitiesToAssets",
  minPe: "pe",
  maxPe: "pe",
};

export type FilterThresholdKey = Exclude<ScreenerFilterKey, "sector">;

export const FILTER_DEFS: ReadonlyArray<{
  key: FilterThresholdKey;
  label: string;
  mode: "min" | "max" | "both";
  /** UI menampilkan input dalam % (rasio × 100). */
  asPercent: boolean;
}> = [
  { key: "minNetMargin", label: "Margin laba bersih", mode: "min", asPercent: true },
  { key: "minRoe", label: "ROE", mode: "min", asPercent: true },
  { key: "minRoa", label: "ROA", mode: "min", asPercent: true },
  { key: "minRevenueGrowth1y", label: "Pertumbuhan pendapatan (1 th)", mode: "min", asPercent: true },
  { key: "minRevenueGrowth3y", label: "Pendapatan CAGR (3 th)", mode: "min", asPercent: true },
  { key: "minFcfMargin", label: "Margin arus kas bebas", mode: "min", asPercent: true },
  { key: "maxDe", label: "Hutang ÷ ekuitas — maksimum", mode: "max", asPercent: false },
  { key: "maxLiabToAssets", label: "Liabilitas ÷ aset — maksimum", mode: "max", asPercent: true },
  { key: "minPe", label: "P/E — minimum", mode: "min", asPercent: false },
  { key: "maxPe", label: "P/E — maksimum", mode: "max", asPercent: false },
] as const;

/** Terima JSON mentah dari DB/user → kunci yang dikenal saja. */
export function sanitizeFilters(raw: unknown): ScreenFilters {
  if (typeof raw !== "object" || raw === null) return {};
  const source = raw as Record<string, unknown>;
  const result: ScreenFilters = {};
  const sector = source.sector;
  if (typeof sector === "string" && sector.trim() !== "") result.sector = sector;
  for (const { key } of FILTER_DEFS) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) result[key] = value;
  }
  return result;
}

export function applyFilters(rows: ScreenerRow[], filters: ScreenFilters): ScreenerRow[] {
  return rows.filter((row) => {
    const { sector, ...thresholds } = filters;
    if (typeof sector === "string" && sector !== "" && row.sector !== sector) return false;
    for (const [key, threshold] of Object.entries(thresholds)) {
      if (typeof threshold !== "number") continue;
      const metric = row[FILTER_FIELD[key as FilterThresholdKey]];
      // Baris tanpa metrik tidak bisa lulus filter — dikecualikan, bukan diperlakukan 0.
      if (typeof metric !== "number" || !Number.isFinite(metric)) return false;
      if (key.startsWith("min") && metric < threshold) return false;
      if (key.startsWith("max") && metric > threshold) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Sortir
// ---------------------------------------------------------------------------

export const SORT_FIELDS = [
  "ticker", "name", "sector", "latestPeriodEnd", "score",
  "revenue", "netIncome", "netMargin", "operatingMargin", "roe", "roa",
  "revenueGrowth1y", "revenueGrowth3y", "netIncomeGrowth1y",
  "fcf", "fcfMargin", "de", "liabilitiesToAssets", "pe",
  "latestClose", "latestPriceDate", "priceReturn1y",
] as const;

export type SortField = (typeof SORT_FIELDS)[number];
export type SortDir = "asc" | "desc";

/** Nilai null SELALU diurutkan paling bawah, apapun arah — bukan diperlakukan 0. */
export function sortRows(rows: ScreenerRow[], field: SortField, dir: SortDir): ScreenerRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av === null || bv === null) {
      if (av === null && bv === null) return a.ticker.localeCompare(b.ticker);
      return av === null ? 1 : -1;
    }
    if (typeof av === "number" && typeof bv === "number") {
      if (av !== bv) return sign * (av - bv);
    } else {
      const cmp = String(av).localeCompare(String(bv));
      if (cmp !== 0) return sign * cmp;
    }
    return a.ticker.localeCompare(b.ticker);
  });
}

// ---------------------------------------------------------------------------
// Pembangun baris
// ---------------------------------------------------------------------------

export function buildScreenerRows(sources: ScreenerSourceRow[]): ScreenerRow[] {
  return sources.map((source) => {
    const { meta, statements, prices } = source;

    const income = ascending(statements.filter((s) => s.statementType === "income_statement"));
    const balance = ascending(statements.filter((s) => s.statementType === "balance_sheet"));
    const cashflow = ascending(statements.filter((s) => s.statementType === "cash_flow"));

    const latestIncome = income.at(-1) ?? null;
    const fundamentals = computeFundamentals(statements);

    // Kelengkapan periodik: pakai baris yang SEPERIODE dengan laporan laba terbaru.
    const periodMs = latestIncome ? Date.parse(latestIncome.periodEnd) : null;
    const balanceNow = periodMs !== null ? closestTo(balance, periodMs) : null;
    const cashflowNow = periodMs !== null ? closestTo(cashflow, periodMs) : null;

    const totalDebt = balanceNow ? pickNum(balanceNow.data, "total_debt") : null;
    const totalLiabilities = balanceNow ? pickNum(balanceNow.data, "total_liabilities") : null;
    const totalEquity = balanceNow ? pickNum(balanceNow.data, "total_equity") : null;
    const totalAssets = balanceNow ? pickNum(balanceNow.data, "total_assets") : null;

    const debtValue = totalDebt ?? totalLiabilities;
    const de =
      debtValue !== null && totalEquity !== null && totalEquity > 0
        ? debtValue / totalEquity
        : null;
    const liabilitiesToAssets = safeRatio(totalLiabilities, totalAssets);

    const roa = periodMs !== null && totalAssets !== null
      ? safeRatio(fundamentals.netIncome, totalAssets)
      : null;

    // FCF konsisten periode: pasangan kas operasi & capex dari baris yang sama periode.
    const opcfNow = cashflowNow ? pickNum(cashflowNow.data, "operating_cash_flow") : null;
    const capexNow = cashflowNow ? pickNum(cashflowNow.data, "capex") : null;
    const latestRevenue = latestIncome ? pickNum(latestIncome.data, "revenue") : null;
    const fcf = opcfNow !== null && capexNow !== null ? opcfNow - Math.abs(capexNow) : null;
    const fcfMargin = safeRatio(fcf, latestRevenue);

    const eps = latestIncome ? pickNum(latestIncome.data, "eps") : null;

    // Harga: terbaru + patokan sekitar −365 hari (±92 hari), dari array ASC.
    const sortedPrices = [...prices].sort((a, b) => a.date.localeCompare(b.date));
    const latestPrice = sortedPrices.at(-1) ?? null;
    let priceReturn1y: number | null = null;
    if (latestPrice && latestPrice.close > 0) {
      const targetMs = Date.parse(latestPrice.date) - YEAR_LOOKBACK_MS;
      const targetIso = new Date(targetMs).toISOString().slice(0, 10);
      const candidate = [...sortedPrices]
        .reverse()
        .find((p) => p.date <= targetIso && p.close > 0 && Date.parse(p.date) >= targetMs - MATCH_TOLERANCE_MS);
      if (candidate) priceReturn1y = latestPrice.close / candidate.close - 1;
    }

    const pe =
      eps !== null && eps > 0 && latestPrice !== null && latestPrice.close > 0
        ? latestPrice.close / eps
        : null;

    const row: ScreenerRow = {
      ticker: meta.ticker,
      name: meta.name,
      sector: meta.sector,
      currency: meta.currency,
      latestPeriodEnd: latestIncome ? latestIncome.periodEnd : null,
      revenue: latestIncome ? pickNum(latestIncome.data, "revenue") : null,
      netIncome: fundamentals.netIncome,
      eps,
      netMargin: fundamentals.netMargin,
      operatingMargin: fundamentals.operatingMargin,
      roe: fundamentals.roe,
      roa,
      revenueGrowth1y: fundamentals.revenueGrowth1y,
      revenueGrowth3y: fundamentals.revenueGrowth3y,
      netIncomeGrowth1y: fundamentals.netIncomeGrowth1y,
      fcf,
      fcfMargin,
      de,
      liabilitiesToAssets,
      pe,
      latestClose: latestPrice ? latestPrice.close : null,
      latestPriceDate: latestPrice ? latestPrice.date : null,
      priceReturn1y,
      score: null,
    };
    row.score = computeScore(row);
    return row;
  });
}
