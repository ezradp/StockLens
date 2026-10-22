import { describe, expect, it } from "vitest";
import {
  buildFcfHistory,
  computeDcf,
  sensitivityPerShare,
  type DcfInput,
} from "@/engine/dcf";

function input(overrides: Partial<DcfInput> = {}): DcfInput {
  return {
    baseFcf: 100,
    yearlyGrowth: [0.1, 0.1, 0.1, 0.1, 0.1],
    discountRate: 0.1,
    terminalGrowth: 0.02,
    netDebt: 0,
    sharesOutstanding: 10,
    currentPrice: null,
    ...overrides,
  };
}

describe("computeDcf — golden numbers", () => {
  it("g = r = 10%, gT 2%: PV tiap FCF = 100 persis, PV TV = 1275 persis", () => {
    // FCF: 110, 121, 133.1, 146.41, 161.051 — dibagi 1.1^t masing-masing = 100.
    const result = computeDcf(input());
    expect(result.errors).toEqual([]);
    expect(result.projectedFcf!.map((value, i) => [value, [110, 121, 133.1, 146.41, 161.051][i]]).every(([a, b]) => Math.abs(a - b!) < 1e-9)).toBe(true);
    expect(Math.abs(result.pvExplicit! - 500)).toBeLessThan(1e-9);

    // TV = 161.051 × 1.02 / (0.1 − 0.02); PV = TV / 1.1^5 = 102/0.08 × 1 = 1275.
    expect(Math.abs(result.terminalValue! - 2053.40025)).toBeLessThan(1e-9);
    expect(Math.abs(result.pvTerminalValue! - 1275)).toBeLessThan(1e-9);
    expect(Math.abs(result.enterpriseValue! - 1775)).toBeLessThan(1e-9);
    expect(result.equityValue).toBeCloseTo(1775, 6); // netDebt 0
    expect(result.perShare).toBeCloseTo(177.5, 6);
    expect(result.marginOfSafety).toBeNull(); // tanpa harga acuan
  });

  it("g = 0, gT = 0 (annuity): EV = FCF/r = 1000 persis", () => {
    const flat = computeDcf(input({ yearlyGrowth: [0, 0, 0, 0, 0], terminalGrowth: 0 }));
    expect(Math.abs(flat.enterpriseValue! - 1000)).toBeLessThan(1e-9);
  });

  it("netDebt mengurangi equity; kas bersih menaikkan; perShare dari saham", () => {
    const debt = computeDcf(input({ yearlyGrowth: [0, 0, 0, 0, 0], terminalGrowth: 0, netDebt: 200, sharesOutstanding: 4 }));
    expect(debt.equityValue).toBeCloseTo(800, 6);
    expect(debt.perShare).toBeCloseTo(200, 6);
    expect(debt.marginOfSafety).toBeNull();

    const netCash = computeDcf(input({ yearlyGrowth: [0, 0, 0, 0, 0], terminalGrowth: 0, netDebt: -300 }));
    expect(netCash.equityValue).toBeCloseTo(1300, 6);
  });

  it("margin of safety = 1 − harga/nilai intrinsik (sign tepat)", () => {
    const withPrice = computeDcf(input({
      yearlyGrowth: [0, 0, 0, 0, 0],
      terminalGrowth: 0,
      sharesOutstanding: 10,
      netDebt: 0,
      currentPrice: 80, // intrinsik 100 → MoS +20%
    }));
    expect(withPrice.perShare).toBeCloseTo(100, 6);
    expect(withPrice.marginOfSafety).toBeCloseTo(0.2, 6);

    const above = computeDcf(input({
      yearlyGrowth: [0, 0, 0, 0, 0],
      terminalGrowth: 0,
      netDebt: 0,
      currentPrice: 125,
    }));
    expect(above.marginOfSafety).toBeCloseTo(-0.25, 6);
  });

  it("saham kosong → perShare null, EV tetap dihitung", () => {
    const noShares = computeDcf(input({ sharesOutstanding: null }));
    expect(noShares.enterpriseValue).not.toBeNull();
    expect(noShares.perShare).toBeNull();
    expect(noShares.marginOfSafety).toBeNull();
  });

  it("gT ≥ r → TV dilucuti + galat eksplisit; PV eksplisit tetap", () => {
    const bad = computeDcf(input({ terminalGrowth: 0.12 }));
    expect(bad.pvExplicit).not.toBeNull();
    expect(bad.terminalValue).toBeNull();
    expect(bad.enterpriseValue).toBeNull();
    expect(bad.errors.join(" ")).toContain("terminal value dilucuti");
  });

  it("input kacau → semua null + masalah eksplisit", () => {
    expect(computeDcf(input({ baseFcf: 0 })).errors[0]).toContain("FCF dasar");
    expect(computeDcf(input({ yearlyGrowth: [] })).errors[0]).toContain("minimal satu tahun");
    expect(computeDcf(input({ discountRate: -0.05 })).errors[0]).toContain("Diskonto");
    expect(computeDcf(input({ sharesOutstanding: 0 })).errors[0]).toContain("tidak valid");
  });
});

describe("sensitivityPerShare", () => {
  it("sel = computeDcf(r', gT') per-saham; gT ≥ r' → null", () => {
    const rates = [0.08, 0.1, 0.12];
    const growths = [0, 0.02, 0.05];
    const grid = sensitivityPerShare(input(), rates, growths);

    expect(grid.rows).toBe(rates);
    expect(grid.columns).toBe(growths);
    expect(grid.errors).toEqual([]);
    expect(grid.values).toHaveLength(3);
    expect(grid.values[0]).toHaveLength(3);

    const spot = computeDcf(input({ discountRate: 0.08, terminalGrowth: 0.05 }));
    expect(grid.values[0][2]).toBeCloseTo(spot.perShare!, 6); // baris pertama, kolom gT terakhir
    expect(grid.values[0][2]).not.toBeNull(); // 0.05 < 0.08 masih valid

    // Sel gT ≥ r: r = 0.12, gT = 0.05 valid semua; cek yang tak valid langsung:
    const invalidGrid = sensitivityPerShare(input(), [0.04], [0.05]);
    expect(invalidGrid.values[0][0]).toBeNull();
  });

  it("tanpa saham → seluruh sel null + galat jelaskan", () => {
    const grid = sensitivityPerShare({ ...input(), sharesOutstanding: null }, [0.1], [0.02]);
    expect(grid.values).toStrictEqual([[null]]);
    expect(grid.errors[0]).toContain("butuh jumlah saham");
  });
});

describe("buildFcfHistory", () => {
  it("FCF = operasi − |capex| per periode, ASC", () => {
    const history = buildFcfHistory([
      { statementType: "cash_flow", periodEnd: "2024-12-31", data: { operating_cash_flow: 300, capex: -50 } },
      { statementType: "cash_flow", periodEnd: "2023-12-31", data: { operating_cash_flow: 250, capex: 40 } },
      { statementType: "income_statement", periodEnd: "2024-12-31", data: { revenue: 1000 } },
    ]);
    expect(history.map((row) => row.periodEnd)).toStrictEqual(["2023-12-31", "2024-12-31"]);
    expect(history[0].fcf).toBe(210); // 250 − |40|
    expect(history[1].fcf).toBe(250); // 300 − |−50|
  });

  it("operasi tanpa capex → FCF null, bukan 0", () => {
    const history = buildFcfHistory([
      { statementType: "cash_flow", periodEnd: "2024-12-31", data: { operating_cash_flow: 300 } },
    ]);
    expect(history[0].capex).toBeNull();
    expect(history[0].fcf).toBeNull();
  });
});
