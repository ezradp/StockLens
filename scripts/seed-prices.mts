/**
 * Seed harga EOD dari Tiingo — HANYA bila PRICE_PROVIDER_API_KEY tersedia di .env.
 * Tanpa key: pesan jujur + exit 0 (aplikasi tetap bisa diisi via CSV import).
 * Upsert idempoten pada unique (company_id, date); chunk 500 baris/request.
 *
 * Jalankan: npm run db:seed:prices
 *   npm run db:seed:prices -- --start=2016-01-01
 *   (opsional) ticker: npm run db:seed:prices -- "AAPL,MSFT"
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchTiingoEod, tiingoApiKey, toMarketPriceRows, type TiingoPriceRow } from "../src/lib/dataProviders/tiingo.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.");
  process.exit(1);
}

if (!tiingoApiKey()) {
  console.log(
    [
      "PRICE_PROVIDER_API_KEY kosong — seed harga Tiingo DILEWATI (exit sukses).",
      "Alasan: PRD zero-cost-first; data harga tetap bisa masuk via CSV Import (Fase 3).",
      "Untuk seed harga gratis, daftar Starter Tiingo lalu isi PRICE_PROVIDER=tiingo & PRICE_PROVIDER_API_KEY di .env.",
    ].join("\n"),
  );
  process.exit(0);
}

const service: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const args = process.argv.slice(2);
const startArg = args.find((arg) => arg.startsWith("--start="))?.slice(8);
const defaultStart = new Date(Date.now() - 3650 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const startDate = startArg ?? defaultStart;
const tickerArg = args.find((arg) => !arg.startsWith("--"));

async function loadTargetCompanies() {
  const query = service.from("companies").select("id, ticker");
  if (tickerArg) {
    const tickers = tickerArg.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
    query.in("ticker", tickers);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Baca companies: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(
      "Tidak ada companies di database — jalankan `npm run db:seed` (fundamentals) lebih dahulu.",
    );
  }
  return data as Array<{ id: string; ticker: string }>;
}

async function upsertPriceRows(rows: ReturnType<typeof toMarketPriceRows>): Promise<void> {
  const CHUNK = 500;
  for (let index = 0; index < rows.length; index += CHUNK) {
    const chunk = rows.slice(index, index + CHUNK);
    const { error } = await service
      .from("market_prices")
      .upsert(chunk, { onConflict: "company_id,date" });
    if (error) throw new Error(`upsert market_prices: ${error.message}`);
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  console.log(`Seed harga Tiingo (mulai ${startDate})...`);
  const companies = await loadTargetCompanies();
  console.log(`Target ${companies.length} perusahaan.`);

  let okCompanies = 0;
  let okRows = 0;
  const failed: string[] = [];

  for (const company of companies) {
    try {
      const eod = await fetchTiingoEod(company.ticker, { startDate });
      const rows = toMarketPriceRows(company.ticker, eod as TiingoPriceRow[], company.id);
      await upsertPriceRows(rows);
      okCompanies += 1;
      okRows += rows.length;
      console.log(`✓ ${company.ticker} — ${rows.length} baris harga (${rows[0]?.date ?? "—"} .. ${rows.at(-1)?.date ?? "—"})`);
    } catch (error) {
      failed.push(company.ticker);
      console.error(`× ${company.ticker} — ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log("");
  console.log(
    `Selesai: ${okCompanies}/${companies.length} perusahaan, ${okRows} baris market_prices (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`,
  );
  if (failed.length > 0) {
    console.error(`Gagal: ${failed.join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
