/**
 * Seed fundamentals — companies + financial_statements dari SEC EDGAR (gratis).
 * Idempoten: upsert pada unique (ticker) & (company_id, statement_type, period_type, period_end).
 *
 * Jalur env: --env-file-if-exists=.env (SUPABASE_* via supabase-js service client).
 * Data seed dilabeli source_type='seed', source_name='SEC EDGAR', tanpa import_batch_id.
 *
 * Jalankan: npm run db:seed
 */
import { createClient } from "@supabase/supabase-js";
import {
  buildStatementsFromCompanyFacts,
  fetchCompanyFacts,
  fetchCompanyProfile,
  fetchTickerMap,
  type StatementDraft,
} from "../src/lib/dataProviders/secEdgar.ts";

const DEFAULT_TICKERS = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "BRK-B", "JPM", "V", "UNH",
  "XOM", "LLY", "PG", "JNJ", "MA", "AVGO", "HD", "KO", "ADBE", "NFLX",
] as const;

/** Peta ticker SEC kadang memetakan ke entitas holding baru yang XBRL-nya masih
 *  kosong (contoh: XOM → "ExxonMobil Holdings Corp" CIK 2115436 berisi 1 laporan).
 *  Paksa CIK legacy yang history-nya utuh hingga peta SEC kembali normal. */
const CIK_OVERRIDES: Record<string, number> = {
  XOM: 34088, // Exxon Mobil Corporation (CIK legacy, XBRL lengkap)
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) {
  console.error(
    [
      "Kredensial Supabase belum lengkap untuk seed.",
      "Isi NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.",
    ].join("\n"),
  );
  process.exit(1);
}

const tickersArg = process.argv[2];
const tickers = tickersArg
  ? tickersArg.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean)
  : [...DEFAULT_TICKERS];

const service = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type CompanyRow = { id: string; ticker: string };

async function upsertCompany(entry: {
  ticker: string;
  name: string;
  sector: string | null;
  industry: string | null;
}): Promise<CompanyRow> {
  const { data: existing } = await service
    .from("companies")
    .select("id, ticker")
    .eq("ticker", entry.ticker)
    .maybeSingle();

  if (existing) {
    const updates: Record<string, string | null> = {};
    if (entry.name) updates.name = entry.name;
    if (entry.sector) updates.sector = entry.sector;
    if (entry.industry) updates.industry = entry.industry;
    if (Object.keys(updates).length > 0) {
      await service.from("companies").update(updates).eq("id", existing.id);
    }
    return { id: existing.id, ticker: existing.ticker };
  }

  const { data, error } = await service
    .from("companies")
    .insert({
      ticker: entry.ticker,
      name: entry.name || entry.ticker,
      sector: entry.sector,
      industry: entry.industry,
      currency: "USD",
    })
    .select("id, ticker")
    .single();
  if (error || !data) throw new Error(`insert companies ${entry.ticker}: ${error?.message ?? "null"}`);
  return { id: data.id, ticker: data.ticker };
}

async function upsertStatements(companyId: string, statements: StatementDraft[]): Promise<number> {
  // Full-refresh baris seed milik perusahaan ini — hasil re-seed deterministik.
  // Baris impor user (source_type='import') tidak tersentuh di sini.
  const { error: deleteError } = await service
    .from("financial_statements")
    .delete()
    .eq("company_id", companyId)
    .eq("source_type", "seed");
  if (deleteError) throw new Error(`hapus seed financial_statements: ${deleteError.message}`);

  if (statements.length === 0) return 0;

  const rows = statements.map((statement) => ({
    company_id: companyId,
    statement_type: statement.statementType,
    period_type: "annual",
    period_end: statement.periodEnd,
    currency: "USD",
    data_json: statement.data,
    source_type: "seed",
    source_name: "SEC EDGAR",
    import_batch_id: null,
  }));
  const { error } = await service.from("financial_statements").insert(rows);
  if (error) throw new Error(`insert financial_statements: ${error.message}`);
  return rows.length;
}

async function main() {
  const startedAt = Date.now();
  console.log(`Seed fundamentals untuk ${tickers.length} ticker via SEC EDGAR...`);

  const tickerMap = await fetchTickerMap();
  let okCompanies = 0;
  let okStatements = 0;
  const failed: Array<{ ticker: string; reason: string }> = [];

  for (const ticker of tickers) {
    const overrideCik = CIK_OVERRIDES[ticker];
    // Normalisasi: BRK-B memakai tanda hubung; peta SEC menormalisasi titik hilang.
    const entry = overrideCik
      ? { ticker, cik: overrideCik, title: ticker }
      : tickerMap.get(ticker.replace(/\./g, ""));
    if (!entry) {
      failed.push({ ticker, reason: "tidak ada di peta ticker SEC" });
      continue;
    }
    try {
      const [facts, profile] = await Promise.all([
        fetchCompanyFacts(entry.cik),
        fetchCompanyProfile(entry.cik),
      ]);
      const built = buildStatementsFromCompanyFacts(facts, { maxYears: 10 });
      const company = await upsertCompany({
        ticker: entry.ticker,
        name: profile?.name ?? facts.entityName ?? entry.title,
        sector: profile?.sector ?? null,
        industry: profile?.industry ?? null,
      });
      const count = await upsertStatements(company.id, built.statements);
      okCompanies += 1;
      okStatements += count;
      console.log(`✓ ${ticker} (CIK ${entry.cik}) — ${count} laporan${built.missingConcepts.length ? `, tanpa: ${built.missingConcepts.join(", ")}` : ""}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failed.push({ ticker, reason });
      console.error(`× ${ticker} — ${reason}`);
    }
  }

  console.log("");
  console.log(
    `Selesai: ${okCompanies}/${tickers.length} perusahaan, ${okStatements} baris financial_statements ` +
      `(${((Date.now() - startedAt) / 1000).toFixed(1)}s)`,
  );
  if (failed.length > 0) {
    console.error(`Gagal ${failed.length}: ${failed.map((f) => `${f.ticker} (${f.reason})`).join("; ")}`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
