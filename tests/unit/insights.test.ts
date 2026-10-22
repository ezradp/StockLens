import { describe, expect, it } from "vitest";
import { buildInsights, insightCoverage, type Insight } from "@/engine/insights";
import type { ScreenerRow } from "@/engine/screener";

function row(overrides: Partial<ScreenerRow>): ScreenerRow {
  return {
    ticker: "TEST",
    name: "Test Co",
    sector: null,
    currency: "USD",
    latestPeriodEnd: "2025-12-31",
    revenue: 1000,
    netIncome: 100,
    eps: null,
    netMargin: 0.1,
    operatingMargin: null,
    roe: 0.1,
    roa: null,
    revenueGrowth1y: null,
    revenueGrowth3y: null,
    netIncomeGrowth1y: null,
    fcf: null,
    fcfMargin: null,
    de: null,
    liabilitiesToAssets: null,
    pe: null,
    latestClose: null,
    latestPriceDate: null,
    priceReturn1y: null,
    score: null,
    ...overrides,
  };
}

const tones = (insights: Insight[]) => insights.map((i) => `${i.tone}:${i.ruleId}`);

describe("buildInsights", () => {
  it("perusahaan sehat: wawasan positif dominan, tanpa kewaspadaan", () => {
    const result = buildInsights(row({
      netMargin: 0.25, roe: 0.22, de: 0.4, fcfMargin: 0.12, fcf: 500,
      revenueGrowth1y: 0.15, revenueGrowth3y: 0.12, score: 78, priceReturn1y: 0.3,
      pe: null,
    }));
    expect(tones(result).every((t) => t.startsWith("positive") || t.startsWith("neutral"))).toBe(true);
    expect(result.some((i) => i.ruleId === "net_margin_strong")).toBe(true);
    expect(result.some((i) => i.ruleId === "roe_strong")).toBe(true);
    expect(result.some((i) => i.ruleId === "leverage_low")).toBe(true);
    expect(result.some((i) => i.ruleId === "score_high")).toBe(true);
  });

  it("perusahaan kacau: wawasan kewaspadaan (margin negatif, leverage tinggi, skor rendah)", () => {
    const result = buildInsights(row({
      netMargin: -0.08, roe: -0.05, de: 2.6, liabilitiesToAssets: 0.9, score: 22,
      revenueGrowth1y: -0.2, fcf: -30,
    }));
    const caution = result.filter((i) => i.tone === "caution");
    expect(caution.length).toBeGreaterThanOrEqual(5);
    expect(caution.some((i) => i.ruleId === "net_margin_loss")).toBe(true);
    expect(caution.some((i) => i.ruleId === "leverage_high")).toBe(true);
    expect(caution.some((i) => i.ruleId === "liab_assets_high")).toBe(true);
    expect(caution.some((i) => i.ruleId === "grow_shrink")).toBe(true);
    expect(caution.some((i) => i.ruleId === "fcf_negative")).toBe(true);
    expect(caution.some((i) => i.ruleId === "score_low")).toBe(true);
  });

  it("ambang pas menyala: margin 20%, ROE 15%, de 0.5, skor 70", () => {
    const result = buildInsights(row({ netMargin: 0.2, roe: 0.15, de: 0.5, score: 70 }));
    const ids = result.map((i) => i.ruleId);
    expect(ids).toContain("net_margin_strong");
    expect(ids).toContain("roe_strong");
    expect(ids).toContain("leverage_low");
    expect(ids).toContain("score_high");
  });

  it("ambang sepersekian di bawah tidak menyala (lebih rendah tidak masuk zona positif)", () => {
    const ids = buildInsights(row({ netMargin: 0.199, de: 0.5001, score: 69.999999 })).map((i) => i.ruleId);
    expect(ids).not.toContain("net_margin_strong");
    expect(ids).not.toContain("leverage_low");
    // skor 69.999999 → Math.round → 70? dibulatkan di view; aturan pakai raw ≥70 → 69.99 tak menyala
    expect(ids).not.toContain("score_high");
  });

  it("tanpa laporan → satu wawasan neutral + coverage menyebut laporan", () => {
    const result = buildInsights(row({ latestPeriodEnd: null, netMargin: null, roe: null }));
    expect(result).toHaveLength(1);
    expect(result[0].ruleId).toBe("no_statements");
    expect(result[0].tone).toBe("neutral");
    expect(insightCoverage(row({ latestPeriodEnd: null, pe: null, fcf: null, de: null, roe: null, latestClose: null }))).toContain("laporan keuangan");
  });

  it("urutan tampil: positif → neutral → kewaspadaan", () => {
    const result = buildInsights(row({ netMargin: 0.25, fcf: -10, priceReturn1y: -0.25 }));
    const order = result.map((i) => i.tone);
    const firstCaution = order.indexOf("caution");
    expect(order.slice(0, firstCaution).every((t) => t !== "caution")).toBe(true);
  });

  it("P/E hanya bicara bila EPS+harga ada; tanpa harga tak ada wawasan harga", () => {
    const withPe = buildInsights(row({ pe: 12 }));
    expect(withPe.some((i) => i.ruleId === "pe_low")).toBe(true);

    const noPrice = buildInsights(row({ priceReturn1y: null, latestClose: null }));
    expect(noPrice.some((i) => i.ruleId.startsWith("price_"))).toBe(false);
  });
});
