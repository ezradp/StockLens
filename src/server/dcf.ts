/**
 * Data akses Fase 6 (DCF) — server-only:
 *  - Konteks perusahaan untuk mesin DCF (neraca beropi histori FCF + harga acuan).
 *  - CRUD valuation_scenarios via USER client (RLS baris milik sendiri).
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StatementKind } from "@/engine/fundamentals";
import { computeFundamentals, type StatementSnapshot } from "@/engine/fundamentals";
import {
  buildFcfHistory,
  type DcfHistoryContext,
  type FcfHistoryPoint,
} from "@/engine/dcf";

export interface DcfCompanyContext extends DcfHistoryContext {
  company: {
    id: string;
    ticker: string;
    name: string;
    currency: string;
    /** companies.shares_outstanding (kolom 0009) — null bila belum diisi. */
    sharesOutstanding: number | null;
  };
  /** Hutang bersih dari neraca: (total_debt ?? total_liabilities) − cash. */
  netDebt: number | null;
  netDebtBasis: "debt" | "liabilities" | null;
  latestClose: { date: string; close: number } | null;
}

const MAX_ANNUAL_ROWS = 2_000;

export async function getDcfContext(ticker: string): Promise<DcfCompanyContext | null> {
  const supabase = await createSupabaseServerClient();
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return null;

  const { data: company } = await supabase
    .from("companies")
    .select("id, ticker, name, currency, shares_outstanding")
    .eq("ticker", normalized)
    .maybeSingle();
  if (!company) return null;

  const [statementsResponse, latestPriceRow] = await Promise.all([
    supabase
      .from("financial_statements")
      .select("statement_type, period_end, data_json")
      .eq("company_id", company.id)
      .eq("period_type", "annual")
      .order("period_end", { ascending: true })
      .limit(MAX_ANNUAL_ROWS),
    supabase
      .from("market_prices")
      .select("date, close")
      .eq("company_id", company.id)
      .order("date", { ascending: false })
      .limit(1)
      .then((result) => result.data?.[0] ?? null),
  ]);

  const statementRows = statementsResponse.data;

  const statements: StatementSnapshot[] = (statementRows ?? []).map((row) => ({
    statementType: row.statement_type as StatementKind,
    periodEnd: row.period_end,
    data: (row.data_json ?? {}) as Record<string, number>,
  }));

  const fundamentals = computeFundamentals(statements);
  const fcfHistory: FcfHistoryPoint[] = buildFcfHistory(statements);

  // Neraca pilihan: TERDEKAT dengan period_end income terbaru (±92 hari) —
  // sama dengan aturan ROE/ROA agar semua metrik berasal dari periode yang sejajar.
  const income = statements
    .filter((row) => row.statementType === "income_statement")
    .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const latestIncomePeriodEnd = income.at(-1)?.periodEnd ?? null;
  const toleranceMs = 92 * 86_400_000;

  let netDebt: number | null = null;
  let netDebtBasis: "debt" | "liabilities" | null = null;
  if (latestIncomePeriodEnd) {
    const targetMs = Date.parse(latestIncomePeriodEnd);
    const balance = statements.filter((row) => row.statementType === "balance_sheet");
    const matched = balance
      .map((row) => ({ row, delta: Math.abs(Date.parse(row.periodEnd) - targetMs) }))
      .sort((a, b) => a.delta - b.delta)[0];
    if (matched && matched.delta <= toleranceMs) {
      const data = matched.row.data;
      const debt = typeof data.total_debt === "number" && Number.isFinite(data.total_debt)
        ? data.total_debt
        : null;
      const liabilities = typeof data.total_liabilities === "number" && Number.isFinite(data.total_liabilities)
        ? data.total_liabilities
        : null;
      const cash = typeof data.cash === "number" && Number.isFinite(data.cash) ? data.cash : null;
      const grossBasis = debt ?? liabilities;
      if (grossBasis !== null) {
        netDebtBasis = debt !== null ? "debt" : "liabilities";
        // Tanpa kas: hutang bersih ≈ hutang kotor (asumsi dilabeli di UI).
        netDebt = cash !== null ? grossBasis - cash : grossBasis;
      }
    }
  }

  const latestClose =
    latestPriceRow && typeof latestPriceRow.close === "number"
      ? { date: latestPriceRow.date, close: latestPriceRow.close }
      : null;

  return {
    company: {
      id: company.id,
      ticker: company.ticker,
      name: company.name,
      currency: company.currency,
      sharesOutstanding:
        typeof company.shares_outstanding === "number" && company.shares_outstanding > 0
          ? company.shares_outstanding
          : null,
    },
    fcfHistory,
    revenueCagr3y: fundamentals.revenueGrowth3y,
    revenueCagr5y: fundamentals.revenueGrowth5y,
    netDebt,
    netDebtBasis,
    latestClose,
  };
}

// ---------------------------------------------------------------------------
// valuation_scenarios — skenario tersimpan milik user
// ---------------------------------------------------------------------------

export interface ValuationScenario {
  id: string;
  companyId: string | null;
  name: string;
  assumptions: Record<string, unknown>;
  results: Record<string, unknown>;
  updatedAt: string;
}

const MAX_SCENARIOS = 24;
const MAX_JSON_BYTES = 24_000;

export async function listValuationScenarios(companyId: string): Promise<ValuationScenario[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("valuation_scenarios")
    .select("id, company_id, name, assumptions_json, results_json, updated_at")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false })
    .limit(MAX_SCENARIOS);
  return (data ?? []).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    assumptions: (row.assumptions_json ?? {}) as Record<string, unknown>,
    results: (row.results_json ?? {}) as Record<string, unknown>,
    updatedAt: row.updated_at,
  }));
}

function validateJsonPayload(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return "Payload asumsi/hasil tidak valid.";
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return "Payload asumsi/hasil tidak dapat diserialisasi.";
  }
  if (serialized.length > MAX_JSON_BYTES) return "Payload asumsi/hasil terlalu besar.";
  return null;
}

export async function saveValuationScenario(
  companyId: string,
  name: string,
  assumptions: unknown,
  results: unknown,
): Promise<{ ok: true; data: ValuationScenario } | { ok: false; error: string }> {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, error: "Nama skenario tidak boleh kosong." };
  if (trimmed.length > 80) return { ok: false, error: "Nama skenario maks 80 karakter." };
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) return { ok: false, error: "ID perusahaan tidak valid." };
  const assumptionError = validateJsonPayload(assumptions);
  if (assumptionError) return { ok: false, error: assumptionError };
  const resultError = validateJsonPayload(results);
  if (resultError) return { ok: false, error: resultError };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("valuation_scenarios")
    .insert({
      company_id: companyId,
      name: trimmed,
      assumptions_json: assumptions,
      results_json: results ?? {},
    })
    .select("id, company_id, name, assumptions_json, results_json, updated_at")
    .single();
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    data: {
      id: data.id,
      companyId: data.company_id,
      name: data.name,
      assumptions: data.assumptions_json,
      results: data.results_json,
      updatedAt: data.updated_at,
    },
  };
}

export async function deleteValuationScenario(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "ID skenario tidak valid." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("valuation_scenarios").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
