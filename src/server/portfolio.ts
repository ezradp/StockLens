/**
 * Data akses Fase 7 (Portfolio) — server-only. Semua tabel personal: lewat USER
 * client (RLS baris milik sendiri; transactions lewat parent portfolio).
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  computePortfolio,
  type PortfolioSummary,
  type PortfolioTx,
  type CompanyRef,
  type LatestPrice,
  type TransactionType,
} from "@/engine/portfolio";

export interface PortfolioRow {
  id: string;
  name: string;
  baseCurrency: string;
  createdAt: string;
}

const NAME_MAX = 60;

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Portofolio
// ---------------------------------------------------------------------------

export async function listPortfolios(): Promise<PortfolioRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("portfolios")
    .select("id, name, base_currency, created_at")
    .order("created_at", { ascending: true })
    .limit(50);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    baseCurrency: row.base_currency,
    createdAt: row.created_at,
  }));
}

export async function createPortfolio(
  name: string,
  baseCurrency = "USD",
): Promise<ActionResult<PortfolioRow>> {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, error: "Nama portofolio tidak boleh kosong." };
  if (trimmed.length > NAME_MAX) return { ok: false, error: `Nama maks ${NAME_MAX} karakter.` };
  const currency = baseCurrency.trim().toUpperCase() || "USD";
  if (currency.length !== 3 || !/^[A-Z]{3}$/.test(currency)) {
    return { ok: false, error: "Kode mata uang 3 huruf, mis. USD." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("portfolios")
    .insert({ name: trimmed, base_currency: currency })
    .select("id, name, base_currency, created_at")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: `Nama "${trimmed}" sudah dipakai.` };
    return { ok: false, error: error.message };
  }
  return {
    ok: true,
    data: { id: data.id, name: data.name, baseCurrency: data.base_currency, createdAt: data.created_at },
  };
}

export async function deletePortfolio(id: string): Promise<ActionResult<null>> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "ID portofolio tidak valid." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("portfolios").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Transaksi
// ---------------------------------------------------------------------------

export interface TransactionRow {
  id: string;
  transactionType: TransactionType;
  transactionDate: string;
  companyId: string | null;
  ticker: string | null;
  quantity: number | null;
  price: number | null;
  amount: number | null;
  fees: number;
  notes: string | null;
}

export async function listTransactionRows(
  portfolioId: string,
): Promise<{ transactions: TransactionRow[]; companyOptions: CompanyRef[] } | null> {
  const supabase = await createSupabaseServerClient();
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) return null;

  const [{ data: portfolio }, { data: txRows }, { data: companyRows }] = await Promise.all([
    supabase.from("portfolios").select("id").eq("id", portfolioId).maybeSingle(),
    supabase
      .from("portfolio_transactions")
      .select(
        "id, transaction_type, transaction_date, company_id, quantity, price, amount, fees, notes, companies(ticker)",
      )
      .eq("portfolio_id", portfolioId)
      .order("transaction_date", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(2_000),
    supabase.from("companies").select("id, ticker, name, sector, currency").order("ticker").limit(500),
  ]);

  if (!portfolio) return null;

  const transactions: TransactionRow[] = (txRows ?? []).map((row) => {
    const embedded = row.companies as { ticker?: string } | { ticker?: string }[] | null;
    const ticker = Array.isArray(embedded) ? embedded[0]?.ticker : embedded?.ticker;
    return {
      id: row.id,
      transactionType: row.transaction_type as TransactionType,
      transactionDate: row.transaction_date,
      companyId: row.company_id,
      ticker: ticker ?? null,
      quantity: row.quantity,
      price: row.price,
      amount: row.amount,
      fees: row.fees,
      notes: row.notes,
    };
  });

  const companyOptions: CompanyRef[] = (companyRows ?? []).map((row) => ({
    companyId: row.id,
    ticker: row.ticker,
    name: row.name,
    sector: row.sector,
    currency: row.currency,
  }));

  return { transactions, companyOptions };
}

export function validateTransaction(obj: {
  transactionType: string;
  transactionDate: string;
  companyId: string | null;
  quantity: string | null;
  price: string | null;
  amount: string | null;
  fees: string | null;
}): { ok: true; value: Omit<PortfolioTx, "currency"> } | { ok: false; error: string } {
  const type = obj.transactionType as TransactionType;
  const VALID: TransactionType[] = ["buy", "sell", "deposit", "withdrawal", "dividend", "fee"];
  if (!VALID.includes(type)) return { ok: false, error: "Jenis transaksi tidak dikenal." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(obj.transactionDate)) {
    return { ok: false, error: "Tanggal wajib format YYYY-MM-DD." };
  }

  const fees = obj.fees === null ? 0 : Number(obj.fees);
  if (!Number.isFinite(fees) || fees < 0) {
    return { ok: false, error: "Fee harus angka ≥ 0." };
  }

  if (type === "buy" || type === "sell") {
    const quantity = Number(obj.quantity);
    const price = Number(obj.price);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, error: `${type === "buy" ? "Pembelian" : "Penjualan"} butuh jumlah saham > 0.` };
    }
    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, error: "Harga harus angka ≥ 0." };
    }
    if (!obj.companyId) return { ok: false, error: "Pilih perusahaan dulu." };
    return {
      ok: true,
      value: {
        transactionType: type,
        transactionDate: obj.transactionDate,
        companyId: obj.companyId,
        quantity,
        price,
        amount: null,
        fees,
      },
    };
  }

  const amount = Number(obj.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: "Nominal harus angka ≥ 0." };
  }
  if ((type === "deposit" || type === "withdrawal") && obj.companyId) {
    return { ok: false, error: "Deposit/withdrawal murni kas — tanpa perusahaan." };
  }
  return {
    ok: true,
    value: {
      transactionType: type,
      transactionDate: obj.transactionDate,
      companyId: type === "dividend" || type === "fee" ? (obj.companyId ?? null) : null,
      quantity: null,
      price: null,
      amount,
      fees,
    },
  };
}

export async function addTransaction(
  portfolioId: string,
  parsed: Omit<PortfolioTx, "currency">,
  currency = "USD",
  notes?: string | null,
): Promise<ActionResult<null>> {
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) return { ok: false, error: "ID portofolio tidak valid." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("portfolio_transactions").insert({
    portfolio_id: portfolioId,
    transaction_type: parsed.transactionType,
    transaction_date: parsed.transactionDate,
    company_id: parsed.companyId,
    quantity: parsed.quantity,
    price: parsed.price,
    amount: parsed.amount,
    fees: parsed.fees,
    currency,
    notes: notes ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function deleteTransaction(
  portfolioId: string,
  transactionId: string,
): Promise<ActionResult<null>> {
  if (!/^[0-9a-f-]{36}$/i.test(transactionId)) return { ok: false, error: "ID transaksi tidak valid." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("portfolio_transactions")
    .delete()
    .eq("id", transactionId)
    .eq("portfolio_id", portfolioId); // tetap terpegang portofolio milik sendiri
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Agregat utama: transaksi → ringkasan (dipakai halaman)
// ---------------------------------------------------------------------------

export interface PortfolioBundle {
  portfolio: PortfolioRow;
  transactions: TransactionRow[];
  companyOptions: CompanyRef[];
  summary: PortfolioSummary;
  warnings: string[];
}

export async function getPortfolioBundle(portfolioId: string): Promise<PortfolioBundle | null> {
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) return null;
  const supabase = await createSupabaseServerClient();

  const [{ data: portfolio }] = await Promise.all([
    supabase
      .from("portfolios")
      .select("id, name, base_currency, created_at")
      .eq("id", portfolioId)
      .maybeSingle(),
  ]);
  if (!portfolio) return null;
  const baseCurrency = portfolio.base_currency as string;

  const listing = await listTransactionRows(portfolioId);
  if (listing === null) return null;

  // Perusahaan yang dipakai transaksi + harga terakhir masing-masing (limit 1, paralel).
  const usedCompanyIds = [
    ...new Set(listing.transactions.map((tx) => tx.companyId).filter((id): id is string => id !== null)),
  ];
  const allCompanies: CompanyRef[] = listing.companyOptions.filter((company) =>
    usedCompanyIds.includes(company.companyId),
  );

  const priceResponses = await Promise.all(
    usedCompanyIds.map((companyId) =>
      supabase
        .from("market_prices")
        .select("date, close")
        .eq("company_id", companyId)
        .order("date", { ascending: false })
        .limit(1)
        .then((result) => result.data?.[0] ?? null),
    ),
  );
  const latestPrices = new Map<string, LatestPrice>();
  usedCompanyIds.forEach((companyId, index) => {
    const row = priceResponses[index];
    latestPrices.set(companyId, {
      price: typeof row?.close === "number" ? row.close : null,
      date: row?.date ?? null,
    });
  });

  const engineTransactions: PortfolioTx[] = listing.transactions.map((row) => ({
    transactionType: row.transactionType,
    transactionDate: row.transactionDate,
    companyId: row.companyId,
    quantity: row.quantity,
    price: row.price,
    amount: row.amount,
    fees: row.fees,
    currency: baseCurrency, // transaksi mengikuti mata uang dasar portofolio (catatan UI)
  }));

  const summary = computePortfolio({
    transactions: engineTransactions,
    companies: allCompanies,
    latestPrices,
    baseCurrency,
  });

  return {
    portfolio: {
      id: portfolio.id,
      name: portfolio.name,
      baseCurrency,
      createdAt: portfolio.created_at,
    },
    transactions: listing.transactions,
    companyOptions: listing.companyOptions,
    summary,
    warnings: summary.warnings,
  };
}
