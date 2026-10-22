/**
 * Logika pemetaan & validasi CSV Import Wizard — murni, tanpa I/O (teruji golden).
 * Prinsip:
 *  - Kolom dipetakan lewat alias (EN/ID) → nama kanonik snake_case.
 *  - Baris tidak valid DILAPORKAN dengan alasan per baris, tidak pernah diam-diam dibuang.
 *  - Duplikasi & konflik nilai terlihat di laporan — salah satunya ditolak, bukan diselipkan.
 */
import { parseCsv, parseNumberLoose } from "./parse";

export type ImportDataType = "prices" | "fundamentals";

export interface ImportRejection {
  line: number;
  reason: string;
}

export interface HeaderMapping {
  source: string;
  target: string;
}

interface CommonResult {
  headers: string[];
  mapping: HeaderMapping[];
  totalRows: number;
  ignoredColumns: string[]; // header tak dikenal — tidak valid tapi disebut
}

/** Batas hard kewajaran file (perlindungan kuota free tier). */
export const MAX_CSV_ROWS = 100_000;

// ---------------------------------------------------------------------------
// Harga OHLCV
// ---------------------------------------------------------------------------

export interface ParsedPriceRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceImportResult extends CommonResult {
  rows: ParsedPriceRow[];
  rejected: ImportRejection[];
  duplicateDates: number;
  /** Kolom wajib yang tidak ada di file — import tak bisa jalan sampai dilengkapi. */
  missingColumns: string[];
}

const PRICE_ALIASES: Array<{ target: keyof ParsedPriceRow | "date"; aliases: string[] }> = [
  { target: "date", aliases: ["date", "dates", "tanggal", "time", "day"] },
  { target: "open", aliases: ["open", "o", "openprice", "harga_buka"] },
  { target: "high", aliases: ["high", "h", "highprice"] },
  { target: "low", aliases: ["low", "l", "lowprice"] },
  { target: "close", aliases: ["close", "c", "closing", "harga_tutup"] },
  { target: "volume", aliases: ["volume", "vol", "v"] },
];

export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "_");
}

/** ISO (YYYY-MM-DD) atau tafsiran US (MM/DD/YYYY, default Date.parse). */
export function normalizeDate(raw: string): string | null {
  const value = raw.trim();
  if (value === "") return null;
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const probe = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(probe.getTime()) ? null : value.slice(0, 10);
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function findIndexByAliases(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const index = normalized.indexOf(alias);
    if (index >= 0) return index;
  }
  return -1;
}

function firstCandleIssue(row: ParsedPriceRow): string | null {
  if (row.open <= 0) return "open harus > 0";
  if (row.low <= 0) return "low harus > 0";
  if (row.high < Math.max(row.open, row.close)) return "high harus ≥ max(open, close)";
  if (row.close < row.low) return "close harus ≥ low";
  if (row.volume < 0) return "volume tidak boleh negatif";
  return null;
}

export function buildPriceImport(csvText: string): PriceImportResult {
  const parsed = parseCsv(csvText);
  const mapping: HeaderMapping[] = [];
  const indexByField = new Map<keyof ParsedPriceRow | "date", number>();

  for (const { target, aliases } of PRICE_ALIASES) {
    const index = findIndexByAliases(parsed.headers, aliases);
    if (index >= 0) {
      indexByField.set(target, index);
      mapping.push({ source: parsed.headers[index], target });
    }
  }

  const required: Array<keyof ParsedPriceRow | "date"> = ["date", "open", "high", "low", "close"];
  const missing = required.filter((field) => !indexByField.has(field));

  const knownTargets = new Set(PRICE_ALIASES.flatMap((entry) => entry.aliases));
  const ignoredColumns = parsed.headers
    .map(normalizeHeader)
    .filter((header) => header !== "" && !knownTargets.has(header));

  const rows: ParsedPriceRow[] = [];
  const rejected: ImportRejection[] = [];
  const seenDates = new Set<string>();
  let duplicateDates = 0;

  if (missing.length > 0) {
    return {
      headers: parsed.headers,
      mapping,
      totalRows: parsed.rows.length,
      ignoredColumns,
      rows: [],
      rejected: [],
      duplicateDates: 0,
      missingColumns: missing.map((field) => String(field)),
    };
  }

  if (parsed.rows.length > MAX_CSV_ROWS) {
    return {
      headers: parsed.headers,
      mapping,
      totalRows: parsed.rows.length,
      ignoredColumns,
      rows: [],
      rejected: [{ line: 1, reason: `File melebihi ${MAX_CSV_ROWS} baris — potong CSV terlebih dahulu` }],
      duplicateDates: 0,
      missingColumns: [],
    };
  }

    parsed.rows.forEach((row, rowIndex) => {
      const line = rowIndex + 2; // header = baris 1
      const date = normalizeDate(row[indexByField.get("date")!] ?? "");
      if (!date) {
        rejected.push({ line, reason: "tanggal tidak terbaca (harus YYYY-MM-DD atau MM/DD/YYYY)" });
        return;
      }
      const read = (field: keyof ParsedPriceRow): number => {
        const index = indexByField.get(field);
        if (index === undefined) return field === "volume" ? 0 : Number.NaN;
        return parseNumberLoose(row[index] ?? "") ?? Number.NaN;
      };
      const candidate: ParsedPriceRow = {
        date,
        open: read("open"),
        high: read("high"),
        low: read("low"),
        close: read("close"),
        volume: read("volume"),
      };
      if (!Number.isFinite(candidate.open) || !Number.isFinite(candidate.high) || !Number.isFinite(candidate.low) || !Number.isFinite(candidate.close)) {
        rejected.push({ line, reason: "ada kolom harga yang tidak numerik" });
        return;
      }
      const issue = firstCandleIssue(candidate);
      if (issue) {
        rejected.push({ line, reason: issue });
        return;
      }
      if (seenDates.has(date)) {
        duplicateDates += 1;
        rejected.push({ line, reason: `tanggal duplikat: ${date} (baris pertama yang menang)` });
        return;
      }
      seenDates.add(date);
      rows.push(candidate);
    });

  rows.sort((a, b) => a.date.localeCompare(b.date));
  return {
    headers: parsed.headers,
    mapping,
    totalRows: parsed.rows.length,
    ignoredColumns,
    rows,
    rejected,
    duplicateDates,
    missingColumns: [],
  };
}

// ---------------------------------------------------------------------------
// Fundamentals — format lebar: period_end [, ticker] [, statement_type] [, metrik...]
// ---------------------------------------------------------------------------

const INCOME_METRICS = new Set([
  "revenue", "net_income", "operating_income", "gross_profit", "eps", "ebitda",
]);
const BALANCE_METRICS = new Set([
  "total_assets", "total_liabilities", "total_equity", "cash", "total_debt", "book_value",
]);
const CASHFLOW_METRICS = new Set([
  "operating_cash_flow", "capex", "free_cash_flow", "dividends_paid",
]);

export function statementTypeForMetric(metric: string): "income_statement" | "balance_sheet" | "cash_flow" | null {
  if (INCOME_METRICS.has(metric)) return "income_statement";
  if (BALANCE_METRICS.has(metric)) return "balance_sheet";
  if (CASHFLOW_METRICS.has(metric)) return "cash_flow";
  return null;
}

/** Nilai kolom statement_type (opsional) dipetakan ke 3 jenis resmi DB. */
export function asStatementType(raw: string): "income_statement" | "balance_sheet" | "cash_flow" | null {
  const value = normalizeHeader(raw);
  if (value === "income_statement" || value === "income") return "income_statement";
  if (value === "balance_sheet" || value === "balance") return "balance_sheet";
  if (value === "cash_flow" || value === "cashflow" || value === "cash") return "cash_flow";
  return null;
}

export const SUPPORTED_METRICS = [
  ...[...INCOME_METRICS], ...[...BALANCE_METRICS], ...[...CASHFLOW_METRICS],
].sort();

const PERIOD_ALIASES = ["period_end", "periode", "period", "fiscal_end", "end_date"];
const TICKER_ALIASES = ["ticker", "symbol", "saham", "kode"];
const STATEMENT_ALIASES = ["statement_type", "statement", "jenis_laporan"];

export interface StatementGroupDraft {
  statementType: "income_statement" | "balance_sheet" | "cash_flow";
  periodEnd: string;
  data: Record<string, number>;
}

export interface FundamentalImportResult extends CommonResult {
  groups: StatementGroupDraft[];
  rejected: ImportRejection[];
  mergedDuplicates: number;
}

export function buildFundamentalImport(csvText: string): FundamentalImportResult {
  const parsed = parseCsv(csvText);
  const mapping: HeaderMapping[] = [];

  const periodIndex = findIndexByAliases(parsed.headers, PERIOD_ALIASES);
  const tickerIndex = findIndexByAliases(parsed.headers, TICKER_ALIASES);
  const statementIndex = findIndexByAliases(parsed.headers, STATEMENT_ALIASES);

  if (periodIndex >= 0) mapping.push({ source: parsed.headers[periodIndex], target: "period_end" });
  if (tickerIndex >= 0) mapping.push({ source: parsed.headers[tickerIndex], target: "ticker (opsional)" });
  if (statementIndex >= 0) mapping.push({ source: parsed.headers[statementIndex], target: "statement_type (opsional)" });

  // Metrik = kolom selain kolom yang sudah dikenal.
  const reserved = new Set([...PERIOD_ALIASES, ...TICKER_ALIASES, ...STATEMENT_ALIASES]);
  const metricColumns = parsed.headers
    .map((header, index) => ({ index, normalized: normalizeHeader(header) }))
    .filter((column) => column.normalized !== "" && !reserved.has(column.normalized));

  const unknownMetrics: string[] = [];
  for (const column of metricColumns) {
    const metric = column.normalized;
    const known = statementTypeForMetric(metric) !== null;
    if (!known && !unknownMetrics.includes(metric)) unknownMetrics.push(metric);
    mapping.push({
      source: parsed.headers[column.index],
      target: known ? metric : `${metric} (tidak dikenal — baris berisi nilainya ditolak)`,
    });
  }

  const groups = new Map<string, StatementGroupDraft>();
  const rejected: ImportRejection[] = [];
  let mergedDuplicates = 0;
  const totalRows = parsed.rows.length;

  if (parsed.rows.length > MAX_CSV_ROWS) {
    return {
      headers: parsed.headers,
      mapping,
      totalRows,
      ignoredColumns: [],
      groups: [],
      rejected: [{ line: 1, reason: `File melebihi ${MAX_CSV_ROWS} baris — potong CSV terlebih dahulu` }],
      mergedDuplicates: 0,
    };
  }

  if (periodIndex < 0) {
    return {
      headers: parsed.headers,
      mapping,
      totalRows,
      ignoredColumns: unknownMetrics,
      groups: [],
      rejected: [{ line: 1, reason: "kolom period_end tidak ditemukan (alias: period_end, periode, period)" }],
      mergedDuplicates: 0,
    };
  }

  parsed.rows.forEach((row, rowIndex) => {
    const line = rowIndex + 2;
    const periodEnd = normalizeDate(row[periodIndex] ?? "");
    if (!periodEnd) {
      rejected.push({ line, reason: "period_end tidak terbaca" });
      return;
    }

    const fileStatementRaw = statementIndex >= 0 ? normalizeHeader(row[statementIndex] ?? "") : "";

    for (const column of metricColumns) {
      const rawValue = row[column.index] ?? "";
      if (rawValue.trim() === "") continue;
      const metric = column.normalized;
      const statementType = asStatementType(fileStatementRaw) ?? statementTypeForMetric(metric);
      if (!statementType) {
        rejected.push({ line, reason: `metrik tidak dikenal: ${metric} (didukung: ${SUPPORTED_METRICS.join(", ")})` });
        continue;
      }
      const value = parseNumberLoose(rawValue);
      if (value === null) {
        rejected.push({ line, reason: `${metric} tidak numerik: "${rawValue.trim().slice(0, 40)}"` });
        continue;
      }

      const key = `${statementType}|${periodEnd}`;
      const group = groups.get(key) ?? {
        statementType,
        periodEnd,
        data: {} as Record<string, number>,
      };
      const previous = group.data[metric];
      if (previous !== undefined) {
        if (previous === value) {
          mergedDuplicates += 1;
        } else {
          rejected.push({
            line,
            reason: `${metric} bertentangan untuk ${periodEnd} (${previous} vs ${value}) — nilai pertama menang`,
          });
          groups.set(key, group);
          continue;
        }
      } else {
        group.data[metric] = value;
      }
      groups.set(key, group);
    }
  });

  return {
    headers: parsed.headers,
    mapping,
    totalRows,
    ignoredColumns: unknownMetrics,
    groups: [...groups.values()].sort(
      (a, b) => a.statementType.localeCompare(b.statementType) || a.periodEnd.localeCompare(b.periodEnd),
    ),
    rejected,
    mergedDuplicates,
  };
}
