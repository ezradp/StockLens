/**
 * Data akses untuk Screener & Compare (Fase 5) — server-only.
 * Satu round-robin kecil: 1 query perusahaan, 1 query laporan tahunan,
 * 1 query harga per perusahaan (≤400 bar terbaru, ASC) — semuanya paralel.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StatementKind, StatementSnapshot } from "@/engine/fundamentals";
import {
  buildScreenerRows,
  type ScreenerRow,
  type ScreenerSourceRow,
} from "@/engine/screener";

const MAX_ANNUAL_ROWS = 20_000;
const MAX_PRICE_ROWS = 400; // ~1.6 tahun harian — cukup untuk return 1 th ± patokan

export async function getScreenerSources(): Promise<ScreenerSourceRow[]> {
  const supabase = await createSupabaseServerClient();

  const [{ data: companies }, { data: statementRows }] = await Promise.all([
    supabase.from("companies").select("id, ticker, name, sector, currency").order("ticker"),
    supabase
      .from("financial_statements")
      .select("company_id, statement_type, period_end, data_json")
      .eq("period_type", "annual")
      .order("period_end", { ascending: false })
      .limit(MAX_ANNUAL_ROWS),
  ]);

  const metaRows = companies ?? [];
  if (metaRows.length === 0) return [];

  const priceResponses = await Promise.all(
    metaRows.map(async (company) => {
      const { data } = await supabase
        .from("market_prices")
        .select("date, close")
        .eq("company_id", company.id)
        .order("date", { ascending: false })
        .limit(MAX_PRICE_ROWS);
      return data ?? [];
    }),
  );

  const statementsByCompany = new Map<string, StatementSnapshot[]>();
  for (const row of statementRows ?? []) {
    const list = statementsByCompany.get(row.company_id) ?? [];
    list.push({
      statementType: row.statement_type as StatementKind,
      periodEnd: row.period_end,
      data: (row.data_json ?? {}) as Record<string, number>,
    });
    statementsByCompany.set(row.company_id, list);
  }

  return metaRows.map((company, index) => ({
    meta: {
      id: company.id,
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      currency: company.currency,
    },
    statements: statementsByCompany.get(company.id) ?? [],
    prices: priceResponses[index].map((row) => ({ date: row.date, close: row.close })),
  }));
}

/** Baris siap-render untuk UI screener/compare — serializable murni. */
export async function getScreenerBundle(): Promise<ScreenerRow[]> {
  const sources = await getScreenerSources();
  return buildScreenerRows(sources);
}
