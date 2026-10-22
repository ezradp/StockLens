import { describe, expect, it } from "vitest";
import type { StatementSnapshot } from "@/engine/fundamentals";
import {
  applyFilters,
  buildScreenerRows,
  computeScore,
  sanitizeFilters,
  sortRows,
  type ScreenerRow,
  type ScreenerSourceRow,
} from "@/engine/screener";

function snapshot(
  statementType: StatementSnapshot["statementType"],
  periodEnd: string,
  data: Record<string, number>,
): StatementSnapshot {
  return { statementType, periodEnd, data };
}

/** Perusahaan A: 4 tahun income + neraca 2 tahun berdekatan + kas & harga 2 titik. */
const richSource: ScreenerSourceRow = {
  meta: { id: "a", ticker: "AAAA", name: "Perusahaan A", sector: "Teknologi", currency: "USD" },
  prices: [
    { date: "2023-06-28", close: 100 },
    { date: "2024-06-28", close: 120 },
  ],
  statements: [
    snapshot("income_statement", "2021-12-31", { revenue: 1000, net_income: 100 }),
    snapshot("income_statement", "2022-12-31", { revenue: 1100, net_income: 130 }),
    snapshot("income_statement", "2023-12-31", { revenue: 1210, net_income: 140 }),
    snapshot("income_statement", "2024-12-31", { revenue: 1331, net_income: 155, operating_income: 300, eps: 3 }),
    snapshot("balance_sheet", "2023-12-31", { total_assets: 1050, total_liabilities: 605, total_equity: 480 }),
    snapshot("balance_sheet", "2024-12-31", { total_assets: 1110, total_liabilities: 610, total_equity: 500, cash: 160 }),
    snapshot("cash_flow", "2024-12-31", { operating_cash_flow: 300, capex: -50 }),
  ],
};

const poorSource: ScreenerSourceRow = {
  meta: { id: "b", ticker: "BBBB", name: "Perusahaan B", sector: "Keuangan", currency: "USD" },
  prices: [],
  statements: [
    snapshot("income_statement", "2023-12-31", { revenue: 500, net_income: 10 }),
  ],
};

const rows: ScreenerRow[] = buildScreenerRows([richSource, poorSource]);
const [a, b] = rows;

describe("buildScreenerRows", () => {
  it("metrik terisi dari data kaya (periode sejajar)", () => {
    expect(a.latestPeriodEnd).toBe("2024-12-31");
    expect(a.revenue).toBe(1331);
    expect(a.netIncome).toBe(155);
    expect(a.netMargin).toBeCloseTo(155 / 1331, 6);
    expect(a.operatingMargin).toBeCloseTo(300 / 1331, 6);
    expect(a.roe).toBeCloseTo(155 / 490, 6); // rata-rata ekuitas 2023+2024
    expect(a.roa).toBeCloseTo(155 / 1110, 6); // aset seperiode 2024
    expect(a.revenueGrowth1y).toBeCloseTo(0.1, 6); // 1210 → 1331
    expect(a.revenueGrowth3y).toBeCloseTo(0.1, 4); // 1000 → 1331; span riil 2.9993 th (365.25 hari/th)
    expect(a.fcf).toBe(250); // 300 − |−50|
    expect(a.fcfMargin).toBeCloseTo(250 / 1331, 6);
    expect(a.de).toBeCloseTo(610 / 500, 6); // fallback liabilitas bila debt tak ada
    expect(a.liabilitiesToAssets).toBeCloseTo(610 / 1110, 6);
    expect(a.pe).toBe(40); // 120 / eps 3
    expect(a.latestClose).toBe(120);
    expect(a.priceReturn1y).toBeCloseTo(0.2, 6); // 100 → 120
  });

  it("data miskin → jujur null, bukan nol", () => {
    expect(b.roe).toBeNull();
    expect(b.roa).toBeNull();
    expect(b.fcf).toBeNull();
    expect(b.de).toBeNull();
    expect(b.pe).toBeNull();
    expect(b.latestClose).toBeNull();
    expect(b.priceReturn1y).toBeNull();
    expect(b.netMargin).not.toBeNull(); // satu-satunya metrik yang terhitung
  });

  it("imbal hasil 1 th null bila harga patokan jauh dari −365 hari", () => {
    const sparse = buildScreenerRows([
      {
        meta: richSource.meta,
        prices: [
          { date: "2020-01-02", close: 100 }, // > 92 hari dari target
          { date: "2024-06-28", close: 120 },
        ],
        statements: [],
      },
    ]);
    expect(sparse[0].priceReturn1y).toBeNull();
    expect(sparse[0].score).toBeNull(); // tanpa statement → < 2 metrik
  });
});

describe("computeScore", () => {
  it("skor aturan transparan (rata-rata metrik yang ada)", () => {
    const parts = [
      Math.min(1, (155 / 1331) / 0.15), // netMargin
      Math.min(1, (155 / 490) / 0.18),  // roe → 1.0
      Math.min(1, 0.1 / 0.15),          // growth 1 th
      Math.min(1, (250 / 1331) / 0.08), // fcfMargin → 1.0
      Math.min(1, Math.max(0, (2 * 1.0 - 610 / 500) / (2 * 1.0))), // de
    ];
    const expected = Math.round((parts.reduce((s, p) => s + p, 0) / parts.length) * 100);
    expect(a.score).toBe(expected);
  });

  it("kurang dari 2 metrik → null", () => {
    expect(computeScore(b)).toBeNull();
  });

  it("D/E negatif (ekuitas negatif) melewati metrik hutang, bukan memalsukannya", () => {
    const negative = computeScore({
      netMargin: 0.3, roe: 0.25, revenueGrowth1y: 0.2, fcfMargin: 0.1, de: -0.5,
    });
    const withoutDe = computeScore({
      netMargin: 0.3, roe: 0.25, revenueGrowth1y: 0.2, fcfMargin: 0.1, de: null,
    });
    expect(negative).toBe(withoutDe);
  });
});

describe("applyFilters", () => {
  it("ambang angka menyaring; nilai null dikecualikan", () => {
    const strongRoe = applyFilters(rows, { minRoe: 0.3 });
    expect(strongRoe.map((row) => row.ticker)).toEqual(["AAAA"]);

    const anyRoe = applyFilters(rows, { minRoe: 0.001 });
    expect(anyRoe.map((row) => row.ticker)).toEqual(["AAAA"]); // B punya ROE null → gugur

    const peCap = applyFilters(rows, { maxPe: 50 });
    expect(peCap.map((row) => row.ticker)).toEqual(["AAAA"]);

    const peTooLow = applyFilters(rows, { minPe: 50 });
    expect(peTooLow).toEqual([]);
  });

  it("filter sektor perbandingan tepat", () => {
    const tech = applyFilters(rows, { sector: "Teknologi" });
    expect(tech.map((row) => row.ticker)).toEqual(["AAAA"]);
  });

  it("sanitizeFilters menolak kunci dan nilai asing", () => {
    const clean = sanitizeFilters({
      sector: "Teknologi", minRoe: 0.2, maxDe: "bukan-angka", hack: true, minNetMargin: Number.NaN,
    });
    expect(clean).toEqual({ sector: "Teknologi", minRoe: 0.2 });
    expect(sanitizeFilters(null)).toEqual({});
  });
});

describe("sortRows", () => {
  it("angka desc, null selalu paling bawah", () => {
    const sorted = sortRows(rows, "roe", "desc");
    expect(sorted.map((row) => row.ticker)).toEqual(["AAAA", "BBBB"]);
    const asc = sortRows(rows, "roe", "asc");
    expect(asc.map((row) => row.ticker)).toEqual(["AAAA", "BBBB"]); // null tidak maju ke atas
  });

  it("ticker sebagai tiebreak saat angka seri", () => {
    const twinSource: ScreenerSourceRow = {
      ...richSource,
      meta: { ...richSource.meta, ticker: "ZZZZ", name: "Twin" },
    };
    const twinRows = buildScreenerRows([twinSource]).map((row) => ({ ...row, roe: a.roe }));
    const sorted = sortRows([...rows, ...twinRows], "roe", "asc");
    expect(sorted.slice(0, 2).map((row) => row.ticker)).toEqual(["AAAA", "ZZZZ"]);
  });
});
