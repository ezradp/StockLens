/**
 * Data akses untuk Stock Explorer (Fase 4) — server-only.
 * Semua query melewati Supabase server client (RLS: data pasar/fondamen dibaca
 * semua user terautentikasi; tidak ada write di sini).
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatementKind, StatementSnapshot } from "@/engine/fundamentals";

export interface CompanySummary {
  id: string;
  ticker: string;
  name: string;
  sector: string | null;
  /** Jumlah laporan tahunan income statement yang tersimpan. */
  incomeYears: number;
  latestIncomePeriodEnd: string | null;
  latestRevenue: number | null;
  latestNetIncome: number | null;
  /** Harga penutupan terakhir yang tersimpan untuk perusahaan ini. */
  latestClose: number | null;
  latestPriceDate: string | null;
}

export interface CompanyDetail {
  company: {
    id: string;
    ticker: string;
    name: string;
    sector: string | null;
    industry: string | null;
    currency: string;
  };
  /** Laporan tahunan ASC — dikonsumsi computeFundamentals & tabel. */
  statements: StatementSnapshot[];
  prices: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

const MAX_ANNUAL_ROWS = 2_000;
const MAX_PRICE_ROWS = 20_000;
/** Batas hard PostgREST per request — paginasi harga harus mengetahuinya. */
const PRICE_PAGE_SIZE = 1_000;

interface RawPriceRow {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

/** Baca market_prices bertingkat (maks 1.000/request) sampai habis / cap. */
async function fetchPriceRows(
  supabase: SupabaseClient,
  companyId: string,
): Promise<RawPriceRow[]> {
  const rows: RawPriceRow[] = [];
  for (let offset = 0; offset < MAX_PRICE_ROWS; offset += PRICE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("market_prices")
      .select("date, open, high, low, close, volume")
      .eq("company_id", companyId)
      .order("date", { ascending: true })
      .range(offset, offset + PRICE_PAGE_SIZE - 1);
    if (error) throw new Error(`market_prices halaman ${offset}: ${error.message}`);
    if (!data || data.length === 0) break; // sudah lewat baris terakhir
    rows.push(...(data as RawPriceRow[]));
    if (data.length < PRICE_PAGE_SIZE) break; // halaman terakhir
  }
  return rows.slice(0, MAX_PRICE_ROWS);
}

export async function listCompanySummaries(): Promise<CompanySummary[]> {
  const supabase = await createSupabaseServerClient();

  const [{ data: companies }, { data: statements }] = await Promise.all([
    supabase.from("companies").select("id, ticker, name, sector").order("ticker"),
    supabase
      .from("financial_statements")
      .select("company_id, period_end, data_json")
      .eq("period_type", "annual")
      .eq("statement_type", "income_statement")
      .order("period_end", { ascending: false })
      .limit(MAX_ANNUAL_ROWS),
  ]);

  const rows = companies ?? [];
  if (rows.length === 0) return [];

  // Harga terakhir per perusahaan: 1 query kecil masing-masing (paralel).
  const priceResponses = await Promise.all(
    rows.map((company) =>
      supabase
        .from("market_prices")
        .select("date, close")
        .eq("company_id", company.id)
        .order("date", { ascending: false })
        .limit(1)
        .then((result) => result.data?.[0] ?? null),
    ),
  );

  const incomeByCompany = new Map<string, { periodEnd: string; revenue: number | null; netIncome: number | null }[]>();
  for (const row of statements ?? []) {
    const metricRow = incomeByCompany.get(row.company_id) ?? [];
    metricRow.push({
      periodEnd: row.period_end,
      revenue: pickFinite(row.data_json, "revenue"),
      netIncome: pickFinite(row.data_json, "net_income"),
    });
    incomeByCompany.set(row.company_id, metricRow);
  }

  return rows.map((company, index) => {
    const income = (incomeByCompany.get(company.id) ?? []).sort((a, b) =>
      b.periodEnd.localeCompare(a.periodEnd),
    );
    const price = priceResponses[index];
    return {
      id: company.id,
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      incomeYears: income.length,
      latestIncomePeriodEnd: income[0]?.periodEnd ?? null,
      latestRevenue: income[0]?.revenue ?? null,
      latestNetIncome: income[0]?.netIncome ?? null,
      latestClose: price?.close ?? null,
      latestPriceDate: price?.date ?? null,
    };
  });
}

export async function getCompanyDetail(ticker: string): Promise<CompanyDetail | null> {
  const supabase = await createSupabaseServerClient();
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return null;

  const { data: company } = await supabase
    .from("companies")
    .select("id, ticker, name, sector, industry, currency")
    .eq("ticker", normalized)
    .maybeSingle();
  if (!company) return null;

  const [{ data: statementRows }, priceRows] = await Promise.all([
    supabase
      .from("financial_statements")
      .select("statement_type, period_end, data_json")
      .eq("company_id", company.id)
      .eq("period_type", "annual")
      .order("period_end", { ascending: true })
      .limit(MAX_ANNUAL_ROWS),
    // PostgREST maks 1.000 baris/request — paginasi via range() agar chart detail
    // memuat SELURUH riwayat (bukan 1.000 bar pertama yang penuh dengan 2020).
    fetchPriceRows(supabase, company.id),
  ]);

  const statements = (statementRows ?? []).map((row) => ({
    statementType: row.statement_type as StatementKind,
    periodEnd: row.period_end,
    data: (row.data_json ?? {}) as Record<string, number>,
  }));

  const prices = priceRows
    .filter(
      (row): row is RawPriceRow & { open: number; high: number; low: number; close: number } =>
        typeof row.close === "number" &&
        typeof row.open === "number" &&
        typeof row.high === "number" &&
        typeof row.low === "number",
    )
    .map((row) => ({
      date: row.date,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume ?? 0,
    }));

  return {
    company: {
      id: company.id,
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      industry: company.industry,
      currency: company.currency,
    },
    statements,
    prices,
  };
}

function pickFinite(raw: unknown, key: string): number | null {
  const value = (raw as Record<string, unknown> | null)?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
