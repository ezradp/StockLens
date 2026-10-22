import { describe, expect, it } from "vitest";
import { computeFundamentals, type StatementSnapshot } from "@/engine/fundamentals";

function snapshot(
  statementType: StatementSnapshot["statementType"],
  periodEnd: string,
  data: Record<string, number>,
): StatementSnapshot {
  return { statementType, periodEnd, data };
}

/** Pendapatan 1000 (2021) → 1100 (2022) → 1331 (2024) → 1464.1 (2025) ⇒ CAGR 10% per 3 th. */
const statements: StatementSnapshot[] = [
  snapshot("income_statement", "2021-12-31", { revenue: 1000, net_income: 100, operating_income: 120 }),
  snapshot("income_statement", "2022-12-31", { revenue: 1100, net_income: 130 }),
  snapshot("income_statement", "2024-12-31", { revenue: 1331, net_income: 165 }),
  snapshot("income_statement", "2025-12-31", { revenue: 1464.1, net_income: 180 }),
  snapshot("balance_sheet", "2024-12-31", { total_assets: 1050, total_equity: 480 }),
  snapshot("balance_sheet", "2025-12-31", { total_assets: 1110, total_equity: 500 }),
  snapshot("cash_flow", "2025-12-31", { operating_cash_flow: 300, capex: -50 }),
];

describe("computeFundamentals", () => {
  const result = computeFundamentals(statements);

  it("metrik mutlak diambil dari tahun laporan terbaru", () => {
    expect(result.latestPeriodEnd).toBe("2025-12-31");
    expect(result.revenue).toBe(1464.1);
    expect(result.netIncome).toBe(180);
    expect(result.totalAssets).toBe(1110);
  });

  it("pertumbuhan 1 th menghitung pasangan tahun SEJAJAR (2024→2025)", () => {
    const oneYear = result.revenueGrowth1y;
    expect(oneYear).not.toBeNull();
    expect(oneYear! > 0.09 && oneYear! < 0.11).toBe(true); // 1331 → 1464.1 ≈ +10%
  });

  it("CAGR 3 th = 10.0% (1100 → 1464.1)", () => {
    const cagr = result.revenueGrowth3y;
    expect(cagr).not.toBeNull();
    expect(cagr! > 0.09 && cagr! < 0.11).toBe(true);
  });

  it("CAGR 5 th jujur NULL — span tersedia hanya 4 tahun", () => {
    expect(result.revenueGrowth5y).toBeNull();
  });

  it("margin & ROE period-matched", () => {
    expect(result.netMargin).toBeCloseTo(180 / 1464.1, 6);
    expect(result.operatingMargin).toBeNull(); // tahun 2025 tanpa operating_income
    expect(result.roe).toBeCloseTo(180 / ((500 + 480) / 2), 6); // NI 2025 vs rata2 ekuitas 2024+2025
  });

  it("ROE NULL bila tidak ada ekuitas yang seperiode dengan laporan laba", () => {
    const mismatched = computeFundamentals([
      snapshot("income_statement", "2025-12-31", { revenue: 100, net_income: 10 }),
      snapshot("balance_sheet", "2023-06-30", { total_equity: 50 }), // 2.5 th lalu — bukan seperiode
    ]);
    expect(mismatched.roe).toBeNull();
  });

  it("FCF = operasi kas − |capex| (konvensi EDGAR maupun CSV positif)", () => {
    expect(result.freeCashFlow).toBe(250);
    const positiveCapex = computeFundamentals([
      snapshot("cash_flow", "2025-12-31", { operating_cash_flow: 300, capex: 50 }),
    ]);
    expect(positiveCapex.freeCashFlow).toBe(250);
  });

  it("data kosong → NULL (bukan nol, bukan NaN)", () => {
    const empty = computeFundamentals([]);
    expect(empty.revenue).toBeNull();
    expect(empty.netMargin).toBeNull();
    expect(empty.roe).toBeNull();
    expect(empty.freeCashFlow).toBeNull();
  });
});
