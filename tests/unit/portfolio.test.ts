import { describe, expect, it } from "vitest";
import {
  allocationBreakdown,
  computeCashSummary,
  computePortfolio,
  type CompanyRef,
  type ComputePortfolioArgs,
  type PortfolioTx,
} from "@/engine/portfolio";

const companies: CompanyRef[] = [
  { companyId: "a", ticker: "AAAA", name: "Perusahaan A", sector: "Teknologi", currency: "USD" },
  { companyId: "b", ticker: "BBBB", name: "Perusahaan B", sector: "Keuangan", currency: "USD" },
];

function tx(partial: Partial<PortfolioTx> & Pick<PortfolioTx, "transactionType">): PortfolioTx {
  return {
    transactionDate: "2025-01-01",
    companyId: null,
    quantity: null,
    price: null,
    amount: null,
    fees: 0,
    currency: "USD",
    ...partial,
  };
}

const baseArgs: ComputePortfolioArgs = {
  transactions: [],
  companies,
  latestPrices: new Map([["a", { price: 130, date: "2025-06-30" }]]),
  baseCurrency: "USD",
};

describe("computePortfolio — average cost", () => {
  it("buy 2x lalu unrealized dari basis rata-rata termasuk fee", () => {
    const summary = computePortfolio({
      ...baseArgs,
      transactions: [
        tx({ transactionType: "buy", companyId: "a", transactionDate: "2025-01-05", quantity: 10, price: 100, fees: 10 }),
        // total basis = 1000 + 10 = 1010 → avg 101
        tx({ transactionType: "buy", companyId: "a", transactionDate: "2025-02-05", quantity: 10, price: 120, fees: 14 }),
        // total basis = 1010 + 1214 = 2224 → avg 111.2
      ],
    });

    expect(summary.positions).toHaveLength(1);
    const position = summary.positions[0];
    expect(position.quantity).toBe(20);
    expect(position.averageCost).toBeCloseTo(111.2, 6);
    expect(position.costBasis).toBeCloseTo(2224, 6);
    expect(position.marketValue).toBeCloseTo(20 * 130, 6); // 2600
    expect(position.unrealizedPl).toBeCloseTo(2600 - 2224, 6); // 376
    expect(position.unrealizedPlPct).toBeCloseTo(376 / 2224, 6);
    expect(position.realizedPl).toBe(0);
    // kena fee: kas = −(1010 + 1214)
    expect(summary.cashBalance).toBeCloseTo(-2224, 6);
    expect(summary.investedCostOpen).toBeCloseTo(2224, 6);
    expect(summary.totalValue).toBeCloseTo(-2224 + 2600, 6); // kas + pasar; tanpa deposit dulu
    expect(summary.warnings).toEqual([]);
  });

  it("sell sebagian → realized + sisa basis; deposit & dividen hanya lewat kas", () => {
    const transactions: PortfolioTx[] = [
      tx({ transactionType: "deposit", transactionDate: "2025-01-02", amount: 5000 }),
      tx({ transactionType: "buy", companyId: "a", transactionDate: "2025-01-05", quantity: 10, price: 100, fees: 0 }),
      tx({ transactionType: "dividend", transactionDate: "2025-03-01", amount: 50 }),
      tx({ transactionType: "sell", companyId: "a", transactionDate: "2025-04-01", quantity: 4, price: 110, fees: 4 }),
      tx({ transactionType: "fee", transactionDate: "2025-04-10", amount: 6 }),
    ];
    const summary = computePortfolio({ ...baseArgs, transactions });

    const position = summary.positions[0];
    expect(position.quantity).toBe(6);
    expect(position.averageCost).toBeCloseTo(100, 6);
    expect(position.realizedPl).toBeCloseTo(4 * 110 - 4 - 4 * 100, 6); // 36
    // kas = 5000 − 1000 + 50 + (440 − 4) − 6 = 4480
    expect(summary.cashBalance).toBeCloseTo(4480, 6);
    expect(summary.netDeposits).toBe(5000); // withdrawal tak ada
    expect(summary.dividendsTotal).toBe(50); // BUKAN bagian P/L investasi
    expect(summary.feesTotal).toBe(6);
    expect(summary.realizedPlTotal).toBeCloseTo(36, 6);
    expect(summary.investedCostOpen).toBeCloseTo(600, 6);
  });

  it("sell habis → posisi tertutup: qty null, realized kekal", () => {
    const summary = computePortfolio({
      ...baseArgs,
      transactions: [
        tx({ transactionType: "buy", companyId: "b", quantity: 5, price: 40 }),
        tx({ transactionType: "sell", companyId: "b", quantity: 5, price: 46 }),
      ],
    });
    expect(summary.positions).toHaveLength(1);
    expect(summary.positions[0].quantity).toBeNull();
    expect(summary.positions[0].costBasis).toBeNull();
    expect(summary.positions[0].marketValue).toBeNull();
    expect(summary.positions[0].realizedPl).toBeCloseTo(30, 6);
    expect(summary.positionsWithoutPrice).toBe(0);
    // Total nilai: tidak ada posisi terbuka → kas saja (0 − 200 + 230 = 30)
    expect(summary.totalValue).toBeCloseTo(30, 6);
  });

  it("oversell → warning jujur, tak difabikasi", () => {
    const summary = computePortfolio({
      ...baseArgs,
      transactions: [
        tx({ transactionType: "buy", companyId: "a", quantity: 2, price: 100 }),
        tx({ transactionType: "sell", companyId: "a", quantity: 5, price: 110 }),
      ],
    });
    expect(summary.warnings[0]).toContain("melebihi qty");
    expect(summary.positions[0].realizedPl).toBeCloseTo(2 * 110 - 2 * 100, 6);
    expect(summary.positions[0].quantity).toBeNull();
  });

  it("posisi tanpa harga → marketValue/totalValue null, dilaporkan", () => {
    const summary = computePortfolio({
      ...baseArgs,
      latestPrices: new Map(),
      transactions: [tx({ transactionType: "buy", companyId: "a", quantity: 1, price: 100 })],
    });
    expect(summary.positions[0].marketValue).toBeNull();
    expect(summary.positions[0].unrealizedPl).toBeNull();
    expect(summary.positionsWithoutPrice).toBe(1);
    expect(summary.totalValue).toBeNull();
    expect(summary.marketValueKnown).toBeNull();
  });

  it("mata uang asing → warning tanpa konversi palsu", () => {
    const summary = computePortfolio({
      ...baseArgs,
      companies: [...companies, { companyId: "c", ticker: "CCCC", name: "C", sector: null, currency: "IDR" }],
      transactions: [tx({ transactionType: "buy", companyId: "c", quantity: 1, price: 5000, currency: "IDR" })],
    });
    expect(summary.warnings.join(" ")).toContain("CCCC");
  });
});

describe("computeCashSummary", () => {
  it("withdrawal mengurangi, tanpa menyentuh P/L", () => {
    const cash = computeCashSummary([
      tx({ transactionType: "deposit", amount: 3000 }),
      tx({ transactionType: "withdrawal", amount: 1000 }),
    ]);
    expect(cash.cashBalance).toBe(2000);
    expect(cash.netDeposits).toBe(2000);
    expect(cash.dividendsTotal).toBe(0);
  });
});

describe("allocationBreakdown", () => {
  it("share per perusahaan atas nilai yang dikenal; posisi tanpa harga dikeluarkan", () => {
    const summary = computePortfolio({
      ...baseArgs,
      latestPrices: new Map([
        ["a", { price: 130, date: "2025-06-30" }],
        ["b", { price: 60, date: "2025-06-30" }],
      ]),
      transactions: [
        tx({ transactionType: "buy", companyId: "a", quantity: 10, price: 100 }), // MV 1300
        tx({ transactionType: "buy", companyId: "b", quantity: 10, price: 50 }),  // MV 600
      ],
    });
    const byCompany = allocationBreakdown(summary.positions, "company");
    expect(byCompany.excluded).toBe(0);
    expect(byCompany.slices).toHaveLength(2);
    expect(byCompany.slices[0].label).toBe("AAAA");
    expect(byCompany.slices[0].share).toBeCloseTo(1300 / 1900, 6);
    expect(byCompany.slices.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 6);

    const bySector = allocationBreakdown(summary.positions, "sector");
    expect(bySector.slices.map((s) => s.label)).toStrictEqual(["Teknologi", "Keuangan"]);
    expect(bySector.slices[1].share).toBeCloseTo(600 / 1900, 6);
  });

  it("semua posisi tanpa harga → slices kosong + excluded terhitung", () => {
    const empty = allocationBreakdown(
      [{ marketValue: null } as never],
      "company",
    );
    expect(empty.slices).toEqual([]);
    expect(empty.excluded).toBe(1);
  });
});
