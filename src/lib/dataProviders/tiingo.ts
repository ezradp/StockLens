/**
 * Klien harga EOD Tiingo (https://apitest.tiingo.com/docs/tiingo/daily) — free tier.
 * Kuota Starter gratis: 500 simbol/bulan, 50 req/jam, 1.000 req/hari (cek ulang
 * di halaman resmi Tiingo saat mengganti provider).
 * Lisensi: personal/internal untuk seed pengembangan — BUKAN konten publik.
 */

const TIINGO_BASE = "https://api.tiingo.com";
const REQUEST_TIMEOUT_MS = 30_000;

export function tiingoApiKey(): string | null {
  return process.env.PRICE_PROVIDER_API_KEY?.trim() || null;
}

export interface TiingoPriceRow {
  /** ISO datetime → dipotong jadi YYYY-MM-DD. */
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  [key: string]: unknown;
}

/** GET /daily/{ticker}/prices — full riwayat bila startDate tidak diisi. */
export async function fetchTiingoEod(
  ticker: string,
  opts: { startDate?: string; endDate?: string } = {},
): Promise<TiingoPriceRow[]> {
  const token = tiingoApiKey();
  if (!token) throw new Error("PRICE_PROVIDER_API_KEY belum diisi — seed harga dilewati.");

  const params = new URLSearchParams({ token });
  if (opts.startDate) params.set("startDate", opts.startDate);
  if (opts.endDate) params.set("endDate", opts.endDate);

  const encoded = encodeURIComponent(ticker.replace(/\./g, "").toLowerCase());
  const response = await fetch(`${TIINGO_BASE}/tiingo/daily/${encoded}/prices?${params}`, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const snippet = await response.text().catch(() => "");
    throw new Error(`Tiingo ${ticker} → HTTP ${response.status} ${snippet.slice(0, 120)}`);
  }
  const rows = (await response.json()) as TiingoPriceRow[];
  if (!Array.isArray(rows)) throw new Error(`Tiingo ${ticker} → respons bukan array`);
  return rows;
}

/** Konversi ke baris market_prices — field transaparan: provider & tanggal jujur. */
export function toMarketPriceRows(ticker: string, rows: TiingoPriceRow[], companyId: string) {
  return rows
    .filter((row) => row.close !== null && row.close !== undefined)
    .map((row) => ({
      company_id: companyId,
      date: row.date.slice(0, 10),
      open: row.open!,
      high: row.high!,
      low: row.low!,
      close: row.close!,
      volume: row.volume ?? 0,
      source_type: "provider",
      source_name: `Tiingo (${ticker})`,
      import_batch_id: null,
    }));
}
