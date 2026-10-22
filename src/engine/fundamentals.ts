/**
 * engine/fundamentals.ts — metrik turunan dari snapshot laporan keuangan (murni, tanpa I/O).
 * Prinsip PRD §4.5: data tidak tersedia → null (disajikan "—"), BUKAN 0 dan BUKAN,
 * dan tidak pernah dihitung dari data yang tak relevan (mis. span tahun terpotong).
 *
 * Konvensi capex: EDGAR menulisPaymentsToAcquirePPE sebagai angka NEGATIF; file CSV
 * pengguna sering positif. Keduanya dinormalisasi: FCF = opCashFlow − |capex|.
 */
import { computeCagr } from "./growth";

export type StatementKind = "income_statement" | "balance_sheet" | "cash_flow";

export interface StatementSnapshot {
  statementType: StatementKind;
  periodEnd: string; // YYYY-MM-DD
  data: Record<string, number>;
}

export type Metric = number | null;

export interface FundamentalsResult {
  latestPeriodEnd: string | null;
  revenue: Metric;
  netIncome: Metric;
  totalAssets: Metric;
  totalEquity: Metric;
  cash: Metric;
  operatingCashFlow: Metric;
  freeCashFlow: Metric;
  netMargin: Metric;
  operatingMargin: Metric;
  /** Laba bersih / rata-rata ekuitas (ekuitas tahun sejajar; fallback ekuitas terbaru). */
  roe: Metric;
  revenueGrowth1y: Metric;
  revenueGrowth3y: Metric;
  revenueGrowth5y: Metric;
  netIncomeGrowth1y: Metric;
}

const YEAR_MS = 365.25 * 86_400_000;
/** Petak kecocokan periode tahunan: 350..400 hari. */
const MIN_SPAN = 350 / 365.25;
const MAX_SPAN = 400 / 365.25;
/** Toleransi mencari statement yang mengapit target ±3 bulan. */
const MATCH_TOLERANCE_MS = 92 * 86_400_000;

function yearsBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / YEAR_MS;
}

function ascending(rows: StatementSnapshot[]): StatementSnapshot[] {
  return [...rows].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
}

function adjacentYears(prevEnd: string, end: string): boolean {
  const span = yearsBetween(prevEnd, end);
  return span >= MIN_SPAN && span <= MAX_SPAN;
}

/** Statement terdekat menjelang target (±92 hari) */
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

function growthRatio(
  endValue: Metric,
  startValue: Metric,
): Metric {
  if (endValue === null || startValue === null) return null;
  if (startValue <= 0 || endValue <= 0) return null;
  return endValue / startValue - 1;
}

function pick(data: Record<string, number>, key: string): Metric {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function margin(numerator: Metric, denominator: Metric): Metric {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return numerator / denominator;
}

function spanCagr(rows: StatementSnapshot[], latest: StatementSnapshot, years: number): Metric {
  const targetMs = Date.parse(latest.periodEnd) - years * YEAR_MS;
  const base = closestTo(rows, targetMs);
  if (!base) return null;
  const span = yearsBetween(base.periodEnd, latest.periodEnd);
  if (span < 0.5) return null;
  return computeCagr({
    startValue: base.data.revenue ?? Number.NaN,
    endValue: latest.data.revenue ?? Number.NaN,
    years: span,
  });
}

export function computeFundamentals(statements: StatementSnapshot[]): FundamentalsResult {
  const income = ascending(statements.filter((s) => s.statementType === "income_statement"));
  const balance = ascending(statements.filter((s) => s.statementType === "balance_sheet"));
  const cashflow = ascending(statements.filter((s) => s.statementType === "cash_flow"));

  const latest = income.at(-1) ?? null;
  const latestPeriodEnd = latest?.periodEnd ?? null;

  const revenue = latest ? pick(latest.data, "revenue") : null;
  const netIncome = latest ? pick(latest.data, "net_income") : null;

  const latestBalance = balance.at(-1) ?? null;
  const totalAssets = latestBalance ? pick(latestBalance.data, "total_assets") : null;
  const totalEquity = latestBalance ? pick(latestBalance.data, "total_equity") : null;
  const cash = latestBalance ? pick(latestBalance.data, "cash") : null;

  const latestCashflow = cashflow.at(-1) ?? null;
  const operatingCashFlow = latestCashflow ? pick(latestCashflow.data, "operating_cash_flow") : null;
  const capex = latestCashflow ? pick(latestCashflow.data, "capex") : null;
  const freeCashFlow =
    operatingCashFlow !== null && capex !== null ? operatingCashFlow - Math.abs(capex) : null;

  // Pertumbuhan tahunan: hanya bila tahun sebelumnya SEJAJAR (≈1 tahun).
  const prevIncome = latest && income.length >= 2 ? income[income.length - 2] : null;
  const prevIsAdjacent =
    latest && prevIncome ? adjacentYears(prevIncome.periodEnd, latest.periodEnd) : false;
  const revenueGrowth1y =
    prevIsAdjacent && latest ? growthRatio(pick(latest.data, "revenue"), pick(prevIncome!.data, "revenue")) : null;
  const netIncomeGrowth1y =
    prevIsAdjacent && latest ? growthRatio(pick(latest.data, "net_income"), pick(prevIncome!.data, "net_income")) : null;

  const revenueGrowth3y = latest ? spanCagr(income, latest, 3) : null;
  const revenueGrowth5y = latest ? spanCagr(income, latest, 5) : null;

  // ROE: laba bersih / ekuitas yang BERSEDARA PERIODE dengan laporan laba (±92 hari);
  // rata-rata E_t & E_{t-1} bila keduanya ada, fallback E_t saja. Tanpa ekuitas
  // periode-matched → null (tidak dipasangkan dengan neraca tahun lain).
  let roe: Metric = null;
  if (latest && netIncome !== null) {
    const eqNowRow = closestTo(balance, Date.parse(latest.periodEnd));
    const eqNow = eqNowRow ? pick(eqNowRow.data, "total_equity") : null;
    const eqPrevRow = prevIsAdjacent && prevIncome ? closestTo(balance, Date.parse(prevIncome.periodEnd)) : null;
    const eqPrev = eqPrevRow ? pick(eqPrevRow.data, "total_equity") : null;
    if (eqNow !== null && eqPrev !== null) {
      roe = margin(netIncome, (eqNow + eqPrev) / 2);
    } else if (eqNow !== null) {
      roe = margin(netIncome, eqNow);
    }
  }

  return {
    latestPeriodEnd,
    revenue,
    netIncome,
    totalAssets,
    totalEquity,
    cash,
    operatingCashFlow,
    freeCashFlow,
    netMargin: margin(netIncome, revenue),
    operatingMargin: latest ? margin(pick(latest.data, "operating_income"), revenue) : null,
    roe,
    revenueGrowth1y,
    revenueGrowth3y,
    revenueGrowth5y,
    netIncomeGrowth1y,
  };
}
