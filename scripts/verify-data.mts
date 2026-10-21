/**
 * Verifikasi data yang SEBENARNYA ada di database — tanpa data palsu.
 * Menampilkan jumlah baris nyata tabel inti serta sampel terbaru.
 * Jalankan: npm run db:verify
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.");
  process.exit(1);
}

const service = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function headCount(table: string): Promise<number | null> {
  const { count, error } = await service
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    console.error(`${table}: ERROR ${error.message}`);
    return null;
  }
  return count ?? 0;
}

async function latestStatements(): Promise<Array<{
  company: string;
  statement_type: string;
  period_end: string;
  data_json: Record<string, number>;
}>> {
  const { data, error } = await service
    .from("financial_statements")
    .select("statement_type, period_end, data_json, companies(ticker)")
    .order("period_end", { ascending: false })
    .limit(6);
  if (error) {
    console.error(`financial_statements: ERROR ${error.message}`);
    return [];
  }
  return (data ?? []).map((row) => ({
    company: (row.companies as { ticker?: string } | null)?.ticker ?? "?",
    statement_type: row.statement_type as string,
    period_end: row.period_end as string,
    data_json: (row.data_json ?? {}) as Record<string, number>,
  }));
}

async function main(): Promise<void> {
  const [companies, statements, prices, batches] = await Promise.all([
    headCount("companies"),
    headCount("financial_statements"),
    headCount("market_prices"),
    headCount("import_batches"),
  ]);

  console.log("=== Stok data StockLens (nyata, tidak dimanipulasi) ===");
  console.log(`companies            : ${companies ?? "-"}`);
  console.log(`financial_statements : ${statements ?? "-"}`);
  console.log(`market_prices        : ${prices ?? "-"}`);
  console.log(`import_batches       : ${batches ?? "-"}`);

  const samples = await latestStatements();
  if (samples.length > 0) {
    console.log("");
    console.log("=== Sampel laporan terbaru (seed: SEC EDGAR) ===");
    for (const sample of samples) {
      const metrics = Object.entries(sample.data_json)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ");
      console.log(`${sample.company} ${sample.statement_type} ${sample.period_end} | ${metrics}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
